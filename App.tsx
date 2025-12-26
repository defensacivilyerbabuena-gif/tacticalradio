
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

  // Función para sincronizar estado con Supabase (incluye canal actual)
  const syncStatus = useCallback(async (location?: { lat: number; lng: number }, statusOverride?: string) => {
    if (!isProfileSet) return;
    
    const lat = location?.lat ?? userLocation?.lat ?? 0;
    const lng = location?.lng ?? userLocation?.lng ?? 0;

    await supabase.from('locations').upsert({
      id: DEVICE_ID, 
      name: userName, 
      lat: lat, 
      lng: lng, 
      role: `Canal ${currentChannel}`, 
      status: statusOverride ?? (isTalking ? 'talking' : 'online'), 
      channel_id: currentChannel,
      last_seen: new Date().toISOString()
    }, { onConflict: 'id' });
  }, [isProfileSet, userName, userLocation, currentChannel, isTalking]);

  // Manejo de PTT (Push To Talk)
  useEffect(() => {
    const handleGlobalMouseUp = () => { if (isTalking) handleTalkEnd(); };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isTalking]);

  // Cálculo de distancias en tiempo real
  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  // Suscripción Global a Ubicaciones (Para ver a todos siempre)
  useEffect(() => {
    if (!isProfileSet) return;

    // Carga inicial de unidades
    supabase.from('locations').select('*').then(({ data }) => {
      if (data) setTeamMembersRaw(data.filter(m => m.id !== DEVICE_ID));
    });

    const channel = supabase.channel('global-tactical-sync')
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

  // Seguimiento de GPS
  useEffect(() => {
    if (!isProfileSet || !navigator.geolocation) {
      if (!navigator.geolocation) setSystemLog("SIN_SOPORTE_GPS");
      return;
    }
    
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const newLoc = { lat: latitude, lng: longitude };
      setUserLocation(newLoc);
      setSystemLog("GPS_ACTIVO");
      syncStatus(newLoc);
    }, (err) => {
      setSystemLog(`ERR_GPS: ${err.code}`);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isProfileSet, syncStatus]);

  // Gestión de Conexión de Radio
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
      setSystemLog(`MALLA_CH${currentChannel}_OK`);
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
      setSystemLog("ERR_ENLACE");
    }
  }, [userName, currentChannel]);

  const handleDisconnect = useCallback(async () => {
    if (radioRef.current) await radioRef.current.disconnect();
    radioRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setSystemLog("QRT_DISCONNECT");
  }, []);

  // Cambio de Canal
  const changeChannel = (id: string) => {
    if (id === currentChannel) return;
    setCurrentChannel(id);
    localStorage.setItem('tactical_channel', id);
    // Reiniciar radio en el nuevo canal si estaba conectada
    if (connectionState === ConnectionState.CONNECTED) {
      setTimeout(handleConnect, 100);
    }
    // Forzar actualización de color de punto inmediatamente
    syncStatus(undefined, undefined);
  };

  const handleTalkStart = () => {
    if (radioRef.current && connectionState === ConnectionState.CONNECTED) {
      setIsTalking(true);
      radioRef.current.startTransmission();
      syncStatus(undefined, 'talking');
    }
  };

  const handleTalkEnd = () => {
    if (radioRef.current) {
      radioRef.current.stopTransmission();
      setIsTalking(false);
      syncStatus(undefined, 'online');
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
          <div className="space-y-4">
            <input 
              autoFocus
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
              placeholder="IDENTIFICATIVO"
              className="w-full bg-black border border-gray-800 p-4 text-orange-500 focus:border-orange-500 outline-none font-bold tracking-widest text-center uppercase"
            />
            <button onClick={saveProfile} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 flex items-center justify-center gap-2">
              <ShieldCheck size={20} /> ENTRAR A MALLA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-black overflow-hidden relative text-white font-sans">
      <div className="flex-1 relative border-b md:border-b-0 md:border-r border-white/10 overflow-hidden">
         <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
         
         <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-orange-500/30 rounded shadow-lg">
              <span className="text-[9px] text-orange-500/50 block font-mono">CALLSIGN</span>
              <span className="text-xs font-bold text-orange-500 font-mono">{userName}</span>
            </div>
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-emerald-500/30 rounded shadow-lg">
              <span className="text-[9px] text-emerald-500/50 block font-mono">CHANNEL {currentChannel}</span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono uppercase">{systemLog}</span>
            </div>
         </div>

         <div className="hidden md:block absolute bottom-6 left-6 w-64 bg-black/90 backdrop-blur rounded border border-white/10 shadow-2xl h-64 overflow-hidden z-[500]">
            <div className="p-2 bg-white/5 border-b border-white/10 text-[9px] font-bold text-gray-400 text-center tracking-widest uppercase">Unidades Visibles</div>
            <TeamList members={teamMembers} />
         </div>
      </div>

      <div className="flex-none md:w-[380px] h-auto md:h-full bg-gray-950 z-20">
        <RadioControl 
           connectionState={connectionState}
           isTalking={isTalking}
           onTalkStart={handleTalkStart}
           onTalkEnd={handleTalkEnd}
           lastTranscript={remoteTalker}
           onConnect={handleConnect}
           onDisconnect={handleDisconnect}
           audioLevel={audioLevel}
           onEmergencyClick={() => setShowEmergencyModal(true)}
           currentChannel={currentChannel}
           onChannelChange={changeChannel}
        />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
