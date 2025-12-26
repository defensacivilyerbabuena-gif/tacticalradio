
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TeamMember } from '../types';
import { Radio } from 'lucide-react';

const TUCUMAN_CENTER = { lat: -26.8241, lng: -65.2226 };
const TUCUMAN_BOUNDS: L.LatLngBoundsExpression = [
  [-28.5, -67.0], 
  [-25.5, -64.0]
];

// Arreglo para iconos de Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl });

interface MapDisplayProps {
  userLocation: { lat: number; lng: number } | null;
  teamMembers: TeamMember[];
}

// Componente para manejar el redimensionado y centrado
const MapController = ({ center }: { center: { lat: number; lng: number } | null }) => {
  const map = useMap();
  
  useEffect(() => {
    // Forzar a Leaflet a detectar el tamaño real del contenedor (Arregla el mapa gris)
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, [map]);

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
};

const createTacticalIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const userIcon = createTacticalIcon('#10b981'); 
const teamIcon = createTacticalIcon('#f97316'); 

export const MapDisplay: React.FC<MapDisplayProps> = ({ userLocation, teamMembers }) => {
  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <MapContainer 
        center={userLocation || TUCUMAN_CENTER} 
        zoom={13} 
        minZoom={7}
        maxBounds={TUCUMAN_BOUNDS}
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
            <Marker position={userLocation} icon={userIcon}>
              <Popup>
                <div className="font-bold text-gray-900">MI_UNIDAD</div>
                <div className="text-[10px] text-gray-500 font-mono">ESTADO: ONLINE</div>
              </Popup>
            </Marker>
            <Circle 
              center={userLocation}
              radius={150} 
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, weight: 1 }} 
            />
          </>
        )}

        {teamMembers.map((member) => (
          <Marker 
            key={member.id} 
            position={{ lat: member.lat, lng: member.lng }} 
            icon={teamIcon}
          >
            <Popup>
               <div className="font-bold text-gray-900">{member.name}</div>
               <div className="text-xs text-gray-600 flex items-center gap-1">
                  <Radio size={10} /> {member.role}
               </div>
               <div className="text-[10px] font-mono text-gray-500 mt-1">RNG: {member.distance}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .map-tiles-grayscale {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-container {
          background: #0a0a0a !important;
        }
      `}</style>
    </div>
  );
};
