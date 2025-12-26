
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

// Función para calcular distancia en km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  
  if (d < 1) return `${(d * 1000).toFixed(0)}m`;
  return `${d.toFixed(2)}km`;
}

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [teamMembersRaw, setTeamMembersRaw] = useState<TeamMember[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isTalking, setIsTalking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  // Procesar miembros del equipo con distancias calculadas
  const teamMembers = useMemo(() => {
    if (!userLocation) return teamMembersRaw;
    return teamMembersRaw.map(m => ({
      ...m,
      distance: calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
    }));
  }, [teamMembersRaw, userLocation]);

  // 1. ESCUCHAR CAMBIOS (Realtime Supabase)
  useEffect(() => {
    if (!supabase) return;

    const fetchInitialLocations = async () => {
      try {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .neq('id', DEVICE_ID);
        
        if (data) setTeamMembersRaw(data as TeamMember[]);
      } catch (e) {
        console.error("Failed to fetch locations:", e);
      }
    };

    fetchInitialLocations();

    const channel = supabase
      .channel('tactical-realtime')
      .on(
        'postgres_changes',
        { event: '*', table: 'locations', schema: 'public' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new && payload.new.id !== DEVICE_ID) {
              setTeamMembersRaw(prev => {
                const index = prev.findIndex(m => m.id === payload.new.id);
                if (index === -1) return [...prev, payload.new];
                const newTeam = [...prev];
                newTeam[index] = payload.new;
                return newTeam;
              });
            }
          }
          if (payload.eventType === 'DELETE') {
             setTeamMembersRaw(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. RASTREO GPS REAL
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc = { lat: latitude, lng: longitude };
        setUserLocation(newLoc);

        if (supabase) {
          try {
            await supabase.from('locations').upsert({
              id: DEVICE_ID,
              name: USER_NAME,
              lat: latitude,
              lng: longitude,
              role: 'Field Operator',
              status: 'online',
              last_seen: new Date().toISOString()
            });
          } catch (e) {
            console.error("Failed to update location in DB:", e);
          }
        }
      },
      (err) => console.warn(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      if (!liveServiceRef.current) liveServiceRef.current = new GeminiLiveService();
      await liveServiceRef.current.connect({
        onConnectionUpdate: (state) => setConnectionState(state),
        onAudioData: (buffer) => {
          setAudioLevel(Math.random() * 40 + 60); 
          setTimeout(() => setAudioLevel(0), 100);
        },
        onTranscript: (text, isUser) => {
            if (!isUser) {
                setLastTranscript(text);
                setTimeout(() => setLastTranscript(null), 10000);
            }
        }
      });
    } catch (err) {
      setConnectionState(ConnectionState.ERROR);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (liveServiceRef.current) {
      await liveServiceRef.current.disconnect();
      setConnectionState(ConnectionState.DISCONNECTED);
      setAudioLevel(0);
      setIsTalking(false);
    }
  }, []);

  const handleTalkStart = useCallback(() => {
    if (liveServiceRef.current && connectionState === ConnectionState.CONNECTED) {
      liveServiceRef.current.resumeStreaming(); 
      setIsTalking(true);
      setAudioLevel(30);
    }
  }, [connectionState]);

  const handleTalkEnd = useCallback(() => {
    if (liveServiceRef.current) {
      liveServiceRef.current.stopStreaming();
      setIsTalking(false);
      setAudioLevel(0);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden relative text-white selection:bg-orange-500/30 font-sans">
      <div className="flex flex-col w-full h-full md:flex-row">
        <div className={`flex-1 relative transition-all duration-500 ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
           <MapDisplay userLocation={userLocation} teamMembers={teamMembers} />
           <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 bg-[length:100%_4px,3px_100%]" />
           
           {!supabase && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600/90 text-white text-[10px] px-4 py-1 rounded-full font-bold animate-pulse shadow-lg">
               SYSTEM ALERT: DATABASE OFFLINE (SYNC DISABLED)
             </div>
           )}
        </div>

        <div className={`h-[55vh] md:h-full md:w-[450px] z-20 shadow-[0_0_40px_rgba(0,0,0,0.8)] ${viewMode === 'list' ? 'hidden' : 'block'}`}>
          <RadioControl 
             connectionState={connectionState}
             isTalking={isTalking}
             onTalkStart={handleTalkStart}
             onTalkEnd={handleTalkEnd}
             lastTranscript={lastTranscript}
             toggleView={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
             viewMode={viewMode}
             onConnect={handleConnect}
             onDisconnect={handleDisconnect}
             audioLevel={audioLevel}
             onEmergencyClick={() => setShowEmergencyModal(true)}
          />
        </div>

        {viewMode === 'list' && (
           <div className="flex-1 md:hidden bg-gray-900 animate-in slide-in-from-right duration-300 overflow-hidden">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                  <h2 className="font-mono text-xs font-bold tracking-widest text-gray-400">TEAM_MANIFEST.LOG</h2>
                  <button onClick={() => setViewMode('map')} className="text-orange-500 font-mono text-[10px] border border-orange-500/30 px-2 py-1 rounded">CLOSE_VIEW</button>
               </div>
               <TeamList members={teamMembers} />
           </div>
        )}
      </div>

      <div className="hidden md:block absolute top-6 left-6 w-72 bg-gray-950/80 backdrop-blur-md rounded-xl border border-white/5 shadow-2xl h-[450px] overflow-hidden z-[500]">
         <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-gray-500">SQUAD_ROSTER</span>
            <div className={`w-2 h-2 rounded-full ${supabase ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} title={supabase ? "Database Connected" : "Database Disconnected"} />
         </div>
         <TeamList members={teamMembers} />
      </div>

      <EmergencyModal 
        isOpen={showEmergencyModal} 
        onClose={() => setShowEmergencyModal(false)}
        location={userLocation}
      />
    </div>
  );
}

export default App;
