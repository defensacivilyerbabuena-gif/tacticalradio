import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TeamMember } from '../types';
import { User, Radio } from 'lucide-react';

// Fix for default Leaflet icons in React using CDN URLs
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface MapDisplayProps {
  userLocation: { lat: number; lng: number } | null;
  teamMembers: TeamMember[];
}

const RecenterMap = ({ center }: { center: { lat: number; lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

// Custom DivIcons for better tactical look
const createTacticalIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const userIcon = createTacticalIcon('#10b981'); // Emerald
const teamIcon = createTacticalIcon('#f97316'); // Orange

export const MapDisplay: React.FC<MapDisplayProps> = ({ userLocation, teamMembers }) => {
  const center = userLocation || { lat: 40.7128, lng: -74.0060 }; // Default NY

  return (
    <MapContainer 
      center={center} 
      zoom={15} 
      style={{ height: '100%', width: '100%', background: '#1f2937' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        maxZoom={17}
      />
      
      {/* Re-center when user moves significantly */}
      {userLocation && <RecenterMap center={userLocation} />}

      {/* User Marker */}
      {userLocation && (
        <>
          <Marker position={userLocation} icon={userIcon}>
            <Popup className="tactical-popup">
              <div className="font-bold text-gray-900">YOU (Team Leader)</div>
              <div className="text-xs text-gray-600">Status: ONLINE</div>
            </Popup>
          </Marker>
          <Circle 
            center={userLocation}
            radius={100} 
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, weight: 1 }} 
          />
        </>
      )}

      {/* Team Markers */}
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
             <div className="text-xs font-mono text-gray-500">{member.distance} away</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};