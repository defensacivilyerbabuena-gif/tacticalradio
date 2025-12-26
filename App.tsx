
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { RadioControl } from './components/RadioControl';
import { TeamList } from './components/TeamList';
import { EmergencyModal } from './components/EmergencyModal';
import { TeamMember, ConnectionState } from './types';
import { RadioService } from './services/radioService';
import { supabase, getDeviceId } from './services/supabase';
import { User, ShieldCheck, List, X, Radio } from 'lucide-react';

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
  const [systemLog, setSystemLog] = useState<string>("BUSCANDO_GPS...");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showTeamList, setShowTeamList] = useState(false);

  const radioRef = useRef<RadioService | null>(null);

  // Sincronización inicial para ver a los demás de inmediato (Crucial para móvil)
  useEffect(() => {
    if (!isProfileSet) return;

    const syncUnits = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .gt('last_seen', new Date(Date.now() - 3600000).toISOString());
      
      if (data) {
        setTeamMembersRaw(data.filter(m => m.id !== DEVICE_ID));
      }
    };

    syncUnits();

    const channel = supabase.channel('tactical-realtime')
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

  // Gestión de GPS persistente
  useEffect(() => {
    if (!isProfileSet || !navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSystemLog(`GPS_FIX (${accuracy.toFixed(0)}m)`);
      
      await supabase.from('locations').upsert({
        id: DEVICE_ID, 
        name: userName, 
        lat: latitude, 
        lng: longitude, 
        role: 'Unidad Móvil', 
        status: isTalking ? 'talking' : 'online', 
        channel_id: currentChannel,
        last_seen: new Date().toISOString()
      });
    }, (err) => {
      setSystemLog(`ERROR_GPS: ${err.code}`);
    }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTalking, isProfileSet, userName, currentChannel]);

  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  const handleConnect = useCallback(() => {
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
      setSystemLog(`NET_CH${currentChannel}_OK`);
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
      setSystemLog("LINK_FAIL");
    }
  }, [userName, currentChannel]);

  const handleDisconnect = useCallback(() => {
    if (radioRef.current) radioRef.current.disconnect();
    radioRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setSystemLog("RADIO_QRT");
  }, []);

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

  if (!isProfileSet) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex items-center justify-center p-6 font-mono">
        <div className="w-full max-w-sm space-y-6 bg-gray-950 border border-emerald-500/20 p-8 rounded shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <User className="text-emerald-500" size={32} />
            </div>
            <h1 className="text-emerald-500 font-black tracking-widest text-xl">CALLSIGN_AUTH</h1>
          </div>
          <input 
            autoFocus
            type="text" 
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
            placeholder="MOVIL-01"
            className="w-full bg-black border border-gray-800 p-4 text-emerald-500 focus:border-emerald-500 outline-none text-center font-bold tracking-widest uppercase"
          />
          <button onClick={saveProfile} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 transition-colors flex items-center justify-center gap-2">
            <ShieldCheck size={20} /> VALIDAR_UNIDAD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-black overflow-hidden relative text-white font-sans">
      
      {/* MAPA Y CAPAS TÁCTICAS */}
      <div className="flex-1 relative border-b md:border-b-0 md:border-r border-white/10 overflow-hidden">
         <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
         
         {/* OVERLAY TÁCTICO IZQUIERDO */}
         <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-emerald-500/30 rounded shadow-lg">
              <span className="text-[9px] text-emerald-500/50 block font-mono">UNIT_ID</span>
              <span className="text-xs font-bold text-emerald-500 font-mono">{userName}</span>
            </div>
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-blue-500/30 rounded shadow-lg">
              <span className="text-[9px] text-blue-500/50 block font-mono">CHANNEL_FQ</span>
              <span className="text-xs font-bold text-blue-400 font-mono">FQ_0{currentChannel}</span>
            </div>
         </div>

         {/* STATUS LOG INFERIOR IZQUIERDO */}
         <div className="absolute bottom-4 left-4 z-[1000] bg-black/60 px-2 py-1 border border-white/10 text-[9px] font-mono text-gray-500 rounded uppercase">
            {systemLog}
         </div>

         {/* TOGGLE LISTA MÓVIL */}
         <button 
           onClick={() => setShowTeamList(!showTeamList)}
           className="md:hidden absolute top-4 right-4 z-[1000] w-10 h-10 bg-black/80 border border-white/20 rounded flex items-center justify-center text-white"
         >
           {showTeamList ? <X size={20} /> : <List size={20} />}
         </button>

         {/* LISTA DE EQUIPO (MÓVIL OVERLAY) */}
         {showTeamList && (
           <div className="md:hidden absolute inset-0 z-[1001] bg-gray-950 flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-white/10">
                <h2 className="font-bold text-emerald-500 tracking-tighter uppercase">Personal en Línea</h2>
                <button onClick={() => setShowTeamList(false)}><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TeamList members={teamMembers} />
              </div>
           </div>
         )}
      </div>

      {/* RADIO CONTROL */}
      <div className="flex-none md:w-[400px] h-auto md:h-full bg-gray-950 z-20">
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
        />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
