
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

// Helper to calculate distance between coordinates
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

  // Helper to sync user status with the database
  const syncUserStatus = useCallback(async (overrides = {}) => {
    if (!isProfileSet || !userLocation) return;
    
    const data = {
      id: DEVICE_ID, 
      name: userName, 
      lat: userLocation.lat, 
      lng: userLocation.lng, 
      role: `Unidad en Canal ${currentChannel}`, 
      status: isTalking ? 'talking' : 'online', 
      channel_id: currentChannel,
      last_seen: new Date().toISOString(),
      ...overrides
    };

    await supabase.from('locations').upsert(data, { onConflict: 'id' });
  }, [isProfileSet, userLocation, userName, currentChannel, isTalking]);

  // Handle global mouse up to stop transmission
  useEffect(() => {
    const handleGlobalMouseUp = () => { if (isTalking) handleTalkEnd(); };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isTalking]);

  // Filter team members and calculate distances
  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  // Subscribe to real-time location updates
  useEffect(() => {
    if (!isProfileSet) return;

    const fetchInitial = async () => {
      const { data } = await supabase.from('locations').select('*');
      if (data) {
        setTeamMembersRaw(data.filter(m => m.id !== DEVICE_ID));
      }
    };
    fetchInitial();

    const channel = supabase.channel('tactical-realtime-global')
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

  // Track GPS location
  useEffect(() => {
    if (!isProfileSet || !navigator.geolocation) {
      if (!navigator.geolocation) setSystemLog("SIN_SOPORTE_GPS");
      return;
    }
    
    setSystemLog("BUSCANDO_GPS...");
    
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const newLoc = { lat: latitude, lng: longitude };
      setUserLocation(newLoc);
      setSystemLog(`GPS_OK_ACTIVO`);
      
      supabase.from('locations').upsert({
        id: DEVICE_ID, 
        name: userName, 
        lat: latitude, 
        lng: longitude, 
        role: `Unidad en Canal ${currentChannel}`, 
        status: isTalking ? 'talking' : 'online', 
        channel_id: currentChannel,
        last_seen: new Date().toISOString()
      }, { onConflict: 'id' });
    }, (error) => {
      setSystemLog(`GPS_ERR: ${error.code}`);
    }, { 
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isProfileSet, userName, currentChannel]);

  useEffect(() => {
    syncUserStatus();
  }, [isTalking]);

  const handleConnect = useCallback(async () => {
    if (radioRef.current) await radioRef.current.disconnect();
    
    setConnectionState(ConnectionState.CONNECTING);
    try {
      radioRef.current = new RadioService({
        userId: DEVICE_ID,
        userName: userName,
        channelId: currentChannel,
        onAudioBuffer: () => {
          setAudioLevel(prev => Math.min(100, prev + 25));
          setTimeout(() => setAudioLevel(0), 100);
        },
        onIncomingStreamStart: (name) => setRemoteTalker(name),
        onIncomingStreamEnd: () => setRemoteTalker(null)
      });
      setConnectionState(ConnectionState.CONNECTED);
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
    }
  }, [userName, currentChannel]);

  const handleDisconnect = useCallback(async () => {
    if (radioRef.current) await radioRef.current.disconnect();
    radioRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
  }, []);

  const changeChannel = (id: string) => {
    if (id === currentChannel) return;
    setCurrentChannel(id);
    localStorage.setItem('tactical_channel', id);
    syncUserStatus({ channel_id: id, role: `Unidad en Canal ${id}` });
  };

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      handleConnect();
    }
  }, [currentChannel, handleConnect]);

  const handleTalkStart = async () => {
    if (radioRef.current && connectionState === ConnectionState.CONNECTED) {
      setIsTalking(true);
      radioRef.current.startTransmission();
    }
  };

  const handleTalkEnd = () => {
    if (radioRef.current) {
      radioRef.current.stopTransmission();
      setIsTalking(false);
    }
  };

  const saveProfile = () => {
    if (tempName.trim().length < 3) return;
    const finalName = tempName.trim().toUpperCase();
    localStorage.setItem('user_callsign', finalName);
    setUserName(finalName);
    setIsProfileSet(true);
  };

  // Profile setup screen
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
              className="w-full bg-black border border-gray-800 p-4 text-orange-500 focus:border-orange-500 outline-none font-bold tracking-widest text-center"
            />
            <button onClick={saveProfile} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 flex items-center justify-center gap-2">
              <ShieldCheck size={20} /> ENTRAR A MALLA
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Tactical Interface
  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black overflow-hidden font-mono text-white">
      {/* Upper area: Map and Team List */}
      <div className="flex-1 flex flex-col md:flex-row relative min-h-0">
        {/* Tactical Map */}
        <div className="flex-1 relative border-b md:border-b-0 md:border-r border-gray-800">
          <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
          
          {/* Status Indicators Overlay */}
          <div className="absolute top-4 left-4 z-[1000] space-y-2 pointer-events-none">
            <div className="bg-black/80 border border-white/10 px-3 py-1.5 rounded-sm backdrop-blur-md shadow-2xl">
              <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-0.5">ESTADO_RED</div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[11px] font-bold text-gray-200">{connectionState.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="bg-black/80 border border-white/10 px-3 py-1.5 rounded-sm backdrop-blur-md shadow-2xl">
              <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-0.5">LOG_SISTEMA</div>
              <div className="text-[11px] font-bold text-orange-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{systemLog}</div>
            </div>
          </div>
        </div>

        {/* Sidebar: Active Units */}
        <div className="h-1/3 md:h-full md:w-80 bg-gray-950 border-t md:border-t-0 md:border-l border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800 bg-black/40 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
              UNIDADES_EN_MALLA
            </span>
            <span className="text-[10px] font-mono text-gray-600">{teamMembers.length + 1} ACT</span>
          </div>
          <TeamList members={teamMembers} />
        </div>
      </div>

      {/* Bottom area: PTT and Radio Controls */}
      <div className="h-[380px] md:h-[450px] border-t border-gray-800 shadow-2xl relative z-20">
        <RadioControl 
          connectionState={connectionState}
          isTalking={isTalking}
          onTalkStart={handleTalkStart}
          onTalkEnd={handleTalkEnd}
          lastTranscript={remoteTalker ? `RECIBIENDO: ${remoteTalker}` : null}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onEmergencyClick={() => setShowEmergencyModal(true)}
          audioLevel={audioLevel}
          currentChannel={currentChannel}
          onChannelChange={changeChannel}
        />
      </div>

      {/* Emergency SOS Modal */}
      <EmergencyModal 
        isOpen={showEmergencyModal} 
        onClose={() => setShowEmergencyModal(false)} 
        location={userLocation} 
      />
    </div>
  );
}

export default App;
