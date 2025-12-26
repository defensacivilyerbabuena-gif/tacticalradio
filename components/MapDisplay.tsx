
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TeamMember } from '../types';
import { Radio } from 'lucide-react';

// Centro en Tucumán, Argentina
const TUCUMAN_CENTER = { lat: -26.8083, lng: -65.2176 };
const TUCUMAN_BOUNDS: L.LatLngBoundsExpression = [
  [-28.0, -66.5], 
  [-25.5, -64.0]
];

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
    setTimeout(() => { map.invalidateSize(); }, 300);
  }, [map]);

  return null;
};

const createTacticalIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}; transition: all 0.3s ease;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const userIcon = createTacticalIcon('#10b981'); // Verde
const ch1Icon = createTacticalIcon('#f97316'); // Naranja
const ch2Icon = createTacticalIcon('#3b82f6'); // Azul

export const MapDisplay: React.FC<MapDisplayProps> = ({ userLocation, teamMembers }) => {
  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <MapContainer 
        center={TUCUMAN_CENTER} 
        zoom={13} 
        minZoom={8}
        maxBounds={TUCUMAN_BOUNDS}
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
            <Marker position={userLocation} icon={userIcon}>
              <Popup>
                <div className="font-bold text-gray-900">MI_UNIDAD</div>
                <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Tucumán Sector</div>
              </Popup>
            </Marker>
            <Circle 
              center={userLocation}
              radius={100} 
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, weight: 1 }} 
            />
          </>
        )}

        {teamMembers.map((member) => (
          <Marker 
            key={member.id} 
            position={{ lat: member.lat, lng: member.lng }} 
            icon={member.channel_id === '2' ? ch2Icon : ch1Icon}
          >
            <Popup>
               <div className="font-bold text-gray-900">{member.name}</div>
               <div className="text-xs text-gray-600 flex items-center gap-1">
                  <Radio size={10} /> Canal {member.channel_id || '1'}
               </div>
               <div className="text-[10px] font-mono text-gray-500 mt-1 uppercase">Distancia: {member.distance}</div>
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
