
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { RadioControl } from './components/RadioControl';
import { TeamList } from './components/TeamList';
import { EmergencyModal } from './components/EmergencyModal';
import { TeamMember, ConnectionState } from './types';
import { RadioService } from './services/radioService';
import { supabase, getDeviceId } from './services/supabase';
import { User, ShieldCheck } from 'lucide-react';

const DEVICE_ID = getDeviceId();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(2)}km`;
}

function App() {
  const [userName, setUserName] = useState<string>(localStorage.getItem('user_callsign') || '');
  const [isProfileSet, setIsProfileSet] = useState<boolean>(!!localStorage.getItem('user_callsign'));
  const [tempName, setTempName] = useState('');
  
  const [currentChannel, setCurrentChannel] = useState<string>(localStorage.getItem('tactical_channel') || '1');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [teamMembersRaw, setTeamMembersRaw] = useState<TeamMember[]>([]);
  const [isTalking, setIsTalking] = useState(false);
  const [remoteTalker, setRemoteTalker] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [systemLog, setSystemLog] = useState<string>("INICIALIZANDO...");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const radioRef = useRef<RadioService | null>(null);

  // Sincronización manual para cambios inmediatos (como cambio de canal)
  const syncNow = useCallback(async (overrides = {}) => {
    if (!isProfileSet) return;
    const { data: { session } } = await supabase.auth.getSession();
    
    await supabase.from('locations').upsert({
      id: DEVICE_ID,
      name: userName,
      lat: userLocation?.lat || 0,
      lng: userLocation?.lng || 0,
      channel_id: currentChannel,
      status: isTalking ? 'talking' : 'online',
      last_seen: new Date().toISOString(),
      ...overrides
    });
  }, [isProfileSet, userName, userLocation, currentChannel, isTalking]);

  useEffect(() => {
    const handleGlobalMouseUp = () => { if (isTalking) handleTalkEnd(); };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isTalking]);

  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  useEffect(() => {
    if (!isProfileSet) return;

    const fetchInitial = async () => {
      const { data } = await supabase.from('locations').select('*');
      if (data) setTeamMembersRaw(data.filter(m => m.id !== DEVICE_ID));
    };
    fetchInitial();

    const channel = supabase.channel('tactical-global-sync')
      .on('postgres_changes', { event: '*', table: 'locations', schema: 'public' }, (payload: any) => {
        if (payload.new && payload.new.id !== DEVICE_ID) {
          setTeamMembersRaw(prev => {
            const index = prev.findIndex(m => m.id === payload.new.id);
            if (index === -1) return [...prev, payload.new];
            const next = [...prev]; 
            next[index] = payload.new; 
            return next;
          });
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [isProfileSet]);

  useEffect(() => {
    if (!isProfileSet || !navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSystemLog("GPS_OK");
      syncNow({ lat: latitude, lng: longitude });
    }, (err) => setSystemLog("ERR_GPS"), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isProfileSet, syncNow]);

  const handleConnect = useCallback(async () => {
    if (radioRef.current) {
        await radioRef.current.disconnect();
    }
    
    setConnectionState(ConnectionState.CONNECTING);
    try {
      radioRef.current = new RadioService({
        userId: DEVICE_ID,
        userName: userName,
        channelId: currentChannel,
        onAudioBuffer: () => {
          setAudioLevel(prev => Math.min(100, prev + 30));
          setTimeout(() => setAudioLevel(0), 150);
        },
        onIncomingStreamStart: (name) => setRemoteTalker(name),
        onIncomingStreamEnd: () => setRemoteTalker(null)
      });
      setConnectionState(ConnectionState.CONNECTED);
      setSystemLog(`CONECTADO_CH${currentChannel}`);
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
      setSystemLog("ERROR_RADIO");
    }
  }, [userName, currentChannel]);

  const handleDisconnect = useCallback(async () => {
    if (radioRef.current) await radioRef.current.disconnect();
    radioRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setSystemLog("RADIO_OFF");
  }, []);

  const changeChannel = (id: string) => {
    if (id === currentChannel) return;
    setCurrentChannel(id);
    localStorage.setItem('tactical_channel', id);
    // Forzamos actualización visual inmediata para otros usuarios
    syncNow({ channel_id: id });
  };

  // Efecto para reconectar el audio automáticamente al cambiar el canal si la radio estaba encendida
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      handleConnect();
    }
  }, [currentChannel]);

  const handleTalkStart = () => {
    if (radioRef.current && connectionState === ConnectionState.CONNECTED) {
      setIsTalking(true);
      radioRef.current.startTransmission();
      syncNow({ status: 'talking' });
    }
  };

  const handleTalkEnd = () => {
    if (radioRef.current) {
      radioRef.current.stopTransmission();
      setIsTalking(false);
      syncNow({ status: 'online' });
    }
  };

  const saveProfile = () => {
    if (tempName.trim().length < 3) return;
    const finalName = tempName.trim().toUpperCase();
    localStorage.setItem('user_callsign', finalName);
    setUserName(finalName);
    setIsProfileSet(true);
  };

  if (!isProfileSet) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex items-center justify-center p-6 font-mono">
        <div className="w-full max-w-sm space-y-6 bg-gray-950 border border-orange-500/20 p-8 rounded shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/30">
              <User className="text-orange-500" size={32} />
            </div>
            <h1 className="text-orange-500 font-black tracking-widest text-xl uppercase">Radio Táctica</h1>
          </div>
          <div className="space-y-4 text-center">
            <input 
              autoFocus
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
              placeholder="IDENTIFICATIVO"
              className="w-full bg-black border border-gray-800 p-4 text-orange-500 focus:border-orange-500 outline-none font-bold tracking-widest text-center uppercase"
            />
            <button onClick={saveProfile} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 flex items-center justify-center gap-2 transition-colors">
              <ShieldCheck size={20} /> ENTRAR A MALLA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black overflow-hidden font-mono text-white">
      <div className="flex-1 flex flex-col md:flex-row relative min-h-0">
        <div className="flex-1 relative border-b md:border-b-0 md:border-r border-gray-800">
          <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
          <div className="absolute top-4 left-4 z-[1000] space-y-2 pointer-events-none">
            <div className="bg-black/80 border border-white/10 px-3 py-1.5 rounded-sm backdrop-blur-md shadow-2xl">
              <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-0.5">NET_FREQ</div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[11px] font-bold text-gray-200">CH{currentChannel} - {connectionState.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-1/3 md:h-full md:w-80 bg-gray-950 border-t md:border-t-0 md:border-l border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800 bg-black/40 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">UNIDADES_ACTIVAS</span>
            <span className="text-[10px] font-mono text-gray-600">{teamMembers.length + 1}</span>
          </div>
          <TeamList members={teamMembers} />
        </div>
      </div>

      <div className="h-[350px] md:h-[400px] border-t border-gray-800 shadow-2xl relative z-20">
        <RadioControl 
          connectionState={connectionState}
          isTalking={isTalking}
          onTalkStart={handleTalkStart}
          onTalkEnd={handleTalkEnd}
          lastTranscript={remoteTalker}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onEmergencyClick={() => setShowEmergencyModal(true)}
          audioLevel={audioLevel}
          currentChannel={currentChannel}
          onChannelChange={changeChannel}
        />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
