
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'busy' | 'talking';
  lat: number;
  lng: number;
  distance?: string;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface AudioConfig {
  sampleRate: number;
}
