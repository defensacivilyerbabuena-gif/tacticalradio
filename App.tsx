
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { RadioControl } from './components/RadioControl';
import { TeamList } from './components/TeamList';
import { EmergencyModal } from './components/EmergencyModal';
import { TeamMember, ConnectionState } from './types';
import { GeminiLiveService } from './services/geminiLive';
import { supabase, getDeviceId } from './services/supabase';

const DEVICE_ID = getDeviceId();
const USER_NAME = `UNIT-${DEVICE_ID.split('-')[1].toUpperCase()}`;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(2)}km`;
}

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [teamMembersRaw, setTeamMembersRaw] = useState<TeamMember[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isTalking, setIsTalking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [systemLog, setSystemLog] = useState<string>("RADIO_ESPERA");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  useEffect(() => {
    const channel = supabase.channel('tactical-realtime')
      .on('postgres_changes', { event: '*', table: 'locations', schema: 'public' }, (payload: any) => {
        if (payload.new && payload.new.id !== DEVICE_ID) {
          setTeamMembersRaw(prev => {
            const index = prev.findIndex(m => m.id === payload.new.id);
            if (index === -1) return [...prev, payload.new];
            const next = [...prev]; next[index] = payload.new; return next;
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      await supabase.from('locations').upsert({
        id: DEVICE_ID, name: USER_NAME, lat: latitude, lng: longitude, 
        role: 'Field Op', status: 'online', last_seen: new Date().toISOString()
      });
    }, (err) => setSystemLog(`GPS_ERROR: ${err.code}`), { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!liveServiceRef.current) liveServiceRef.current = new GeminiLiveService();
    await liveServiceRef.current.connect({
      onConnectionUpdate: setConnectionState,
      onAudioData: () => { setAudioLevel(80); setTimeout(() => setAudioLevel(0), 100); },
      onTranscript: (text) => setLastTranscript(text),
      onLog: (msg) => setSystemLog(msg)
    });
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (liveServiceRef.current) {
      await liveServiceRef.current.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      setSystemLog("RADIO_OFF");
    }
  }, []);

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden relative text-white font-sans">
      <div className="flex flex-col w-full h-full md:flex-row">
        <div className={`flex-1 relative ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
           <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
           <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
              <div className="bg-black/90 backdrop-blur px-3 py-1 border border-orange-500/30 rounded">
                <span className="text-[10px] text-orange-500/50 block font-mono tracking-widest">ZONA_OPERATIVA</span>
                <span className="text-xs font-bold text-orange-500 font-mono">TUCUMÁN, AR</span>
              </div>
              <div className="bg-black/90 backdrop-blur px-3 py-1 border border-emerald-500/30 rounded">
                <span className="text-[10px] text-emerald-500/50 block font-mono">ESTADO_RED</span>
                <span className="text-[10px] font-bold text-emerald-500 font-mono uppercase animate-pulse">{systemLog}</span>
              </div>
           </div>
        </div>

        <div className={`h-[55vh] md:h-full md:w-[450px] z-20 ${viewMode === 'list' ? 'hidden' : 'block'}`}>
          <RadioControl 
             connectionState={connectionState}
             isTalking={isTalking}
             onTalkStart={() => { if (liveServiceRef.current && connectionState === ConnectionState.CONNECTED) { liveServiceRef.current.resumeStreaming(); setIsTalking(true); } }}
             onTalkEnd={() => { if (liveServiceRef.current) { liveServiceRef.current.stopStreaming(); setIsTalking(false); } }}
             lastTranscript={lastTranscript}
             toggleView={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
             viewMode={viewMode}
             onConnect={handleConnect}
             onDisconnect={handleDisconnect}
             audioLevel={audioLevel}
             onEmergencyClick={() => setShowEmergencyModal(true)}
          />
        </div>
      </div>

      <div className="hidden md:block absolute bottom-10 left-6 w-72 bg-gray-950/90 backdrop-blur rounded border border-white/5 shadow-2xl h-[300px] overflow-hidden z-[500]">
         <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-gray-400">UNIDADES_RED</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
         </div>
         <TeamList members={teamMembers} />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
