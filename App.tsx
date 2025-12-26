
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { RadioControl } from './components/RadioControl';
import { TeamList } from './components/TeamList';
import { HistoryPanel } from './components/HistoryPanel';
import { EmergencyModal } from './components/EmergencyModal';
import { ChannelSelector } from './components/ChannelSelector';
import { TeamMember, ConnectionState, RadioHistory, Channel } from './types';
import { RadioService } from './services/radioService';
import { supabase, getDeviceId } from './services/supabase';
import { User, ShieldCheck, List, X, Clock, Hash } from 'lucide-react';

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
  const [isNameSet, setIsNameSet] = useState<boolean>(!!localStorage.getItem('user_callsign'));
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [tempName, setTempName] = useState('');
  
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [teamMembersRaw, setTeamMembersRaw] = useState<TeamMember[]>([]);
  const [radioHistory, setRadioHistory] = useState<RadioHistory[]>([]);
  const [isTalking, setIsTalking] = useState(false);
  const [remoteTalker, setRemoteTalker] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [systemLog, setSystemLog] = useState<string>("ESPERANDO_GPS...");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'team' | 'history'>('team');
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);

  const radioRef = useRef<RadioService | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

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

  // Sincronización de Datos (Filtrados por Canal)
  useEffect(() => {
    if (!activeChannel || !isNameSet) return;

    const fetchData = async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      
      // Cargar Miembros del Canal
      const { data: members } = await supabase
        .from('locations')
        .select('*')
        .eq('channel_id', activeChannel.id)
        .gt('last_seen', new Date(Date.now() - 3600000).toISOString()); 
      if (members) setTeamMembersRaw(members.filter(m => m.id !== DEVICE_ID));

      // Cargar Historial del Canal
      const { data: history } = await supabase
        .from('radio_history')
        .select('*')
        .eq('channel_id', activeChannel.id)
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false });
      if (history) setRadioHistory(history);
    };

    fetchData();

    const channel = supabase.channel(`sync-${activeChannel.id}`)
      .on('postgres_changes', { event: '*', table: 'locations', schema: 'public', filter: `channel_id=eq.${activeChannel.id}` }, (payload: any) => {
        if (payload.new && payload.new.id !== DEVICE_ID) {
          setTeamMembersRaw(prev => {
            const index = prev.findIndex(m => m.id === payload.new.id);
            if (index === -1) return [...prev, payload.new];
            const next = [...prev]; 
            next[index] = payload.new; 
            return next;
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', table: 'radio_history', schema: 'public', filter: `channel_id=eq.${activeChannel.id}` }, (payload: any) => {
        setRadioHistory(prev => [payload.new, ...prev]);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [activeChannel, isNameSet]);

  // Seguimiento GPS
  useEffect(() => {
    if (!activeChannel || !isNameSet || !navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSystemLog(`GPS_OK (${accuracy.toFixed(0)}m)`);
      
      await supabase.from('locations').upsert({
        id: DEVICE_ID, name: userName, lat: latitude, lng: longitude, role: 'Móvil', 
        status: isTalking ? 'talking' : 'online', 
        last_seen: new Date().toISOString(),
        channel_id: activeChannel.id
      });
    }, (err) => setSystemLog(`GPS_ERR: ${err.code}`), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTalking, activeChannel, isNameSet, userName]);

  const handleConnect = useCallback(() => {
    if (!activeChannel) return;
    setConnectionState(ConnectionState.CONNECTING);
    try {
      radioRef.current = new RadioService({
        userId: DEVICE_ID,
        userName: userName,
        channelId: activeChannel.id,
        getUserLocation: () => userLocationRef.current,
        onAudioBuffer: () => {
          setAudioLevel(prev => Math.min(100, prev + 25));
          setTimeout(() => setAudioLevel(0), 100);
        },
        onIncomingStreamStart: (name) => setRemoteTalker(name),
        onIncomingStreamEnd: () => setRemoteTalker(null)
      });
      setConnectionState(ConnectionState.CONNECTED);
      setSystemLog("LINK_CH_ESTABLISHED");
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
      setSystemLog("LINK_FAILED");
    }
  }, [userName, activeChannel]);

  const handleDisconnect = useCallback(() => {
    if (radioRef.current) radioRef.current.disconnect();
    radioRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setSystemLog("RADIO_OFF");
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

  const saveName = () => {
    if (tempName.trim().length < 3) return;
    const finalName = tempName.trim().toUpperCase();
    localStorage.setItem('user_callsign', finalName);
    setUserName(finalName);
    setIsNameSet(true);
  };

  const handleQSY = () => {
    handleDisconnect();
    setActiveChannel(null);
    setTeamMembersRaw([]);
    setRadioHistory([]);
  };

  // PANTALLA 1: IDENTIFICACIÓN
  if (!isNameSet) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex items-center justify-center p-6 font-mono">
        <div className="w-full max-w-sm space-y-6 bg-gray-950 border border-orange-500/20 p-8 rounded shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/30">
              <User className="text-orange-500" size={32} />
            </div>
            <h1 className="text-orange-500 font-black tracking-widest text-xl">CALLSIGN_AUTH</h1>
          </div>
          <input 
            autoFocus type="text" value={tempName} onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()} placeholder="CALLSIGN"
            className="w-full bg-black border border-gray-800 p-4 text-orange-500 focus:border-orange-500 outline-none text-center font-bold tracking-widest uppercase"
          />
          <button onClick={saveName} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 flex items-center justify-center gap-2">
            <ShieldCheck size={20} /> IDENTIFICARSE
          </button>
        </div>
      </div>
    );
  }

  // PANTALLA 2: SELECCIÓN DE CANAL
  if (!activeChannel) {
    return (
      <div className="h-[100dvh] w-screen bg-black flex items-center justify-center p-6 font-mono">
         <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between mb-4">
               <div className="flex flex-col">
                  <span className="text-[10px] text-orange-500/50">SISTEMA_OPERATIVO</span>
                  <span className="text-sm font-bold text-white uppercase">{userName}</span>
               </div>
               <button onClick={() => { localStorage.removeItem('user_callsign'); setIsNameSet(false); }} className="text-[10px] text-gray-600 hover:text-white underline">Cerrar Sesión</button>
            </div>
            <ChannelSelector onSelect={(ch) => setActiveChannel(ch)} />
         </div>
      </div>
    );
  }

  // PANTALLA 3: RADIO PRINCIPAL
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-black overflow-hidden relative text-white font-sans">
      
      {/* SECCIÓN MAPA TÁCTICO */}
      <div className="flex-1 relative border-b md:border-b-0 md:border-r border-white/10 overflow-hidden">
         <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
         
         {/* OVERLAY DE DATOS */}
         <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-orange-500/30 rounded shadow-lg">
              <span className="text-[9px] text-orange-500/50 block font-mono">CANAL_ACTIVO</span>
              <span className="text-xs font-bold text-orange-500 font-mono flex items-center gap-1 uppercase">
                <Hash size={10} /> {activeChannel.name}
              </span>
            </div>
            <div className="bg-black/80 backdrop-blur px-3 py-1 border border-emerald-500/30 rounded shadow-lg">
              <span className="text-[9px] text-emerald-500/50 block font-mono">GEO_LOCK</span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono uppercase">{systemLog}</span>
            </div>
         </div>

         {/* BOTONES MÓVIL */}
         <button 
           onClick={() => setShowMobileOverlay(!showMobileOverlay)}
           className="md:hidden absolute top-4 right-4 z-[1000] w-10 h-10 bg-black/80 border border-white/20 rounded flex items-center justify-center text-white"
         >
           {showMobileOverlay ? <X size={20} /> : <List size={20} />}
         </button>

         {/* PANEL LATERAL DESKTOP */}
         <div className="hidden md:flex flex-col absolute bottom-6 left-6 w-80 bg-black/90 backdrop-blur rounded border border-white/10 shadow-2xl h-[450px] overflow-hidden z-[500]">
            <div className="flex border-b border-white/10 bg-white/5">
              <button 
                onClick={() => setActiveTab('team')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'team' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5' : 'text-gray-500'}`}
              >
                Personal
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5' : 'text-gray-500'}`}
              >
                Historial
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'team' ? <TeamList members={teamMembers} /> : <HistoryPanel history={radioHistory} />}
            </div>
         </div>

         {/* OVERLAY MÓVIL */}
         {showMobileOverlay && (
           <div className="md:hidden absolute inset-0 z-[1001] bg-gray-950 flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-white/10">
                <div className="flex gap-4">
                  <button onClick={() => setActiveTab('team')} className={`font-bold uppercase text-xs ${activeTab === 'team' ? 'text-orange-500' : 'text-gray-500'}`}>Unidades</button>
                  <button onClick={() => setActiveTab('history')} className={`font-bold uppercase text-xs ${activeTab === 'history' ? 'text-orange-500' : 'text-gray-500'}`}>Historial</button>
                </div>
                <button onClick={() => setShowMobileOverlay(false)}><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                {activeTab === 'team' ? <TeamList members={teamMembers} /> : <HistoryPanel history={radioHistory} />}
              </div>
           </div>
         )}
      </div>

      {/* CONTROL DE RADIO */}
      <div className="flex-none md:w-[400px] h-auto md:h-full bg-gray-950 z-20">
        <RadioControl 
           connectionState={connectionState} 
           isTalking={isTalking} 
           activeChannelName={activeChannel.name}
           onTalkStart={handleTalkStart} 
           onTalkEnd={handleTalkEnd}
           lastTranscript={remoteTalker} 
           onConnect={handleConnect} 
           onDisconnect={handleDisconnect}
           onQSY={handleQSY}
           audioLevel={audioLevel} 
           onEmergencyClick={() => setShowEmergencyModal(true)}
        />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
