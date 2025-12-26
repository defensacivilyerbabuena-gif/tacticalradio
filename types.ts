
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'busy' | 'talking';
  lat: number;
  lng: number;
  distance?: string;
  channel_id: string;
}

export interface RadioHistory {
  id: string;
  sender_name: string;
  lat: number;
  lng: number;
  audio_data: string;
  created_at: string;
  channel_id: string;
}

export interface Channel {
  id: string;
  name: string;
  password?: string | null;
  created_at: string;
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
