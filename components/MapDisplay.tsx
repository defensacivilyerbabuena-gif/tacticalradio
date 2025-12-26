
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TeamMember } from '../types';
import { Layers } from 'lucide-react';

// Coordenadas de San Miguel de Tucumán, Argentina
const TUCUMAN_CENTER: [number, number] = [-26.8083, -65.2176];

const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl });

interface MapDisplayProps {
  userLocation: { lat: number; lng: number } | null;
  teamMembers: TeamMember[];
}

const MapController = ({ center }: { center: { lat: number; lng: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);

  // Solo centramos automáticamente si el usuario lo desea, 
  // pero por defecto el mapa se queda en Tucumán al iniciar.
  return null;
};

const createTacticalIcon = (color: string, label: string, isTalking: boolean) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        ${isTalking ? `<div class="absolute w-8 h-8 bg-${color === '#3b82f6' ? 'blue' : 'orange'}-500/30 rounded-full animate-ping"></div>` : ''}
        <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}; transition: background-color 0.3s ease;"></div>
        <div class="absolute -top-4 bg-black/80 text-[7px] text-white px-1 rounded border border-white/20 font-bold whitespace-nowrap">${label}</div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ userLocation, teamMembers }) => {
  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <MapContainer 
        center={TUCUMAN_CENTER} 
        zoom={14} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-grayscale"
        />
        
        <MapController center={null} />

        {userLocation && (
          <>
            <Marker position={userLocation} icon={createTacticalIcon('#10b981', 'MI_POSICION', false)}>
              <Popup>
                <div className="font-bold text-gray-900">MI_UNIDAD</div>
                <div className="text-[10px] text-gray-500">OPERANDO EN TUCUMÁN</div>
              </Popup>
            </Marker>
            <Circle 
              center={userLocation}
              radius={50} 
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, weight: 1 }} 
            />
          </>
        )}

        {teamMembers.map((member) => (
          <Marker 
            key={member.id} 
            position={{ lat: member.lat, lng: member.lng }} 
            icon={createTacticalIcon(
                member.channel_id === '2' ? '#3b82f6' : '#f97316', 
                member.name, 
                member.status === 'talking'
            )}
          >
            <Popup>
               <div className="font-bold text-gray-900">{member.name}</div>
               <div className="text-[10px] text-gray-600 flex items-center gap-1 mt-1">
                  <Layers size={10} /> {member.channel_id === '2' ? 'CANAL 2 (AZUL)' : 'CANAL 1 (NARANJA)'}
               </div>
               <div className="text-[10px] font-mono text-gray-400 mt-1 uppercase">DIST: {member.distance}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .map-tiles-grayscale {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-container { background: #0a0a0a !important; }
        .custom-div-icon { background: transparent !important; border: none !important; }
      `}</style>
    </div>
  );
};
