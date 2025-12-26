
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TeamMember } from '../types';
import { Radio, Layers } from 'lucide-react';

const DEFAULT_CENTER = { lat: 0, lng: 0 };

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

  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true });
    }
  }, [center, map]);

  return null;
};

const createTacticalIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>
        <div class="absolute -top-4 bg-black/80 text-[7px] text-white px-1 rounded border border-white/20 font-bold">${label}</div>
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
        center={userLocation || DEFAULT_CENTER} 
        zoom={userLocation ? 16 : 2} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-grayscale"
        />
        
        <MapController center={userLocation} />

        {userLocation && (
          <>
            <Marker position={userLocation} icon={createTacticalIcon('#10b981', 'YO')}>
              <Popup>
                <div className="font-bold text-gray-900">MI_UNIDAD (GPS_OK)</div>
              </Popup>
            </Marker>
            <Circle 
              center={userLocation}
              radius={80} 
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.05, weight: 1 }} 
            />
          </>
        )}

        {teamMembers.map((member) => (
          <Marker 
            key={member.id} 
            position={{ lat: member.lat, lng: member.lng }} 
            icon={createTacticalIcon(member.channel_id === '2' ? '#3b82f6' : '#f97316', member.name)}
          >
            <Popup>
               <div className="font-bold text-gray-900">{member.name}</div>
               <div className="text-[10px] text-gray-600 flex items-center gap-1 mt-1">
                  <Layers size={10} /> SINTONIZADO EN CANAL {member.channel_id || '1'}
               </div>
               <div className="text-[10px] font-mono text-gray-400 mt-1 uppercase">DISTANCIA: {member.distance}</div>
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
