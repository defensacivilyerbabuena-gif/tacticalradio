
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapDisplay } from './components/MapDisplay';
import { RadioControl } from './components/RadioControl';
import { TeamList } from './components/TeamList';
import { EmergencyModal } from './components/EmergencyModal';
import { TeamMember, ConnectionState } from './types';
import { RadioService } from './services/radioService';
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
  const [remoteTalker, setRemoteTalker] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [systemLog, setSystemLog] = useState<string>("ESPERANDO_GPS...");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const radioRef = useRef<RadioService | null>(null);

  // Detener transmisión si se suelta el clic fuera del botón
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isTalking) {
        handleTalkEnd();
      }
    };
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
    if (!navigator.geolocation) {
      setSystemLog("SIN_SOPORTE_GPS");
      return;
    }
    
    // Configuración de ALTA PRECISIÓN
    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSystemLog(`GPS_OK (${accuracy.toFixed(0)}m)`);
      
      await supabase.from('locations').upsert({
        id: DEVICE_ID, 
        name: USER_NAME, 
        lat: latitude, 
        lng: longitude, 
        role: 'Field Op', 
        status: isTalking ? 'talking' : 'online', 
        last_seen: new Date().toISOString()
      });
    }, (err) => {
      setSystemLog(`GPS_ERROR: ${err.message}`);
    }, { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0 // Forzar lectura fresca del sensor
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTalking]);

  const handleConnect = useCallback(() => {
    setConnectionState(ConnectionState.CONNECTING);
    try {
      radioRef.current = new RadioService({
        userId: DEVICE_ID,
        userName: USER_NAME,
        onAudioBuffer: () => {
          setAudioLevel(prev => Math.min(100, prev + 25));
          setTimeout(() => setAudioLevel(0), 100);
        },
        onIncomingStreamStart: (name) => setRemoteTalker(name),
        onIncomingStreamEnd: () => setRemoteTalker(null)
      });
      setConnectionState(ConnectionState.CONNECTED);
      setSystemLog("MESH_NET_ACTIVE");
    } catch (e) {
      setConnectionState(ConnectionState.ERROR);
      setSystemLog("ERROR_CONEXION");
    }
  }, []);

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

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden relative text-white font-sans">
      <div className="flex flex-col w-full h-full md:flex-row">
        <div className={`flex-1 relative ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
           <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
           <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
              <div className="bg-black/90 backdrop-blur px-3 py-1 border border-orange-500/30 rounded shadow-lg">
                <span className="text-[10px] text-orange-500/50 block font-mono tracking-widest">MESH_TUCUMAN</span>
                <span className="text-xs font-bold text-orange-500 font-mono tracking-tight">{USER_NAME}</span>
              </div>
              <div className="bg-black/90 backdrop-blur px-3 py-1 border border-emerald-500/30 rounded shadow-lg">
                <span className="text-[10px] text-emerald-500/50 block font-mono">RADIO_NET</span>
                <span className="text-[10px] font-bold text-emerald-500 font-mono uppercase animate-pulse">{systemLog}</span>
              </div>
           </div>
        </div>

        <div className={`h-[55vh] md:h-full md:w-[450px] z-20 ${viewMode === 'list' ? 'hidden' : 'block'}`}>
          <RadioControl 
             connectionState={connectionState}
             isTalking={isTalking}
             onTalkStart={handleTalkStart}
             onTalkEnd={handleTalkEnd}
             lastTranscript={remoteTalker ? `${remoteTalker} TRANSMITIENDO...` : null}
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
            <span className="text-[10px] font-black tracking-widest text-gray-400">RED_UNIDADES</span>
            <div className={`w-2 h-2 rounded-full ${userLocation ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
         </div>
         <TeamList members={teamMembers} />
      </div>

      <EmergencyModal isOpen={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} location={userLocation} />
    </div>
  );
}

export default App;
