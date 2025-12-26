
import React from 'react';
import { Mic, Radio, Power, AlertTriangle, Wifi, Globe, Layers } from 'lucide-react';
import { ConnectionState } from '../types';

interface RadioControlProps {
  connectionState: ConnectionState;
  isTalking: boolean;
  onTalkStart: () => void;
  onTalkEnd: () => void;
  lastTranscript: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onEmergencyClick: () => void;
  audioLevel: number; 
  currentChannel: string;
  onChannelChange: (id: string) => void;
}

export const RadioControl: React.FC<RadioControlProps> = ({
  connectionState, isTalking, onTalkStart, onTalkEnd, lastTranscript, onConnect, onDisconnect, onEmergencyClick, audioLevel, currentChannel, onChannelChange
}) => {
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(50); };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 md:p-6 select-none relative overflow-hidden">
        {/* Nivel de audio visual */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
            <div className={`rounded-full blur-3xl transition-all duration-75 ${currentChannel === '1' ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${audioLevel * 6}px`, height: `${audioLevel * 6}px` }} />
        </div>

        {/* Header con selectores de canal */}
        <div className="flex justify-between items-start z-10 mb-4">
            <div className="flex flex-col gap-3">
              <button 
                onClick={isConnected ? onDisconnect : onConnect} 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40' : 'bg-red-900/20 border border-red-500/50 text-red-500'}`}
              >
                  <Power size={20} />
              </button>
              
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => onChannelChange('1')}
                  className={`px-3 py-1 rounded text-[10px] font-black tracking-tighter transition-all ${currentChannel === '1' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  CH 1
                </button>
                <button 
                  onClick={() => onChannelChange('2')}
                  className={`px-3 py-1 rounded text-[10px] font-black tracking-tighter transition-all ${currentChannel === '2' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  CH 2
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <button 
                onClick={onEmergencyClick} 
                className="w-12 h-12 rounded-lg bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg shadow-red-900/40"
              >
                <AlertTriangle size={20} />
              </button>
              <div className="text-right">
                <div className="text-[10px] font-black text-gray-400">NET_MESH</div>
                <div className="text-[8px] font-mono text-emerald-500/50">SECURE_LINK_256</div>
              </div>
            </div>
        </div>

        {/* Pantalla central */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-6">
            <div className={`w-full bg-black/60 border p-4 rounded font-mono shadow-inner min-h-[80px] flex flex-col justify-center ${currentChannel === '1' ? 'border-orange-500/20' : 'border-blue-500/20'}`}>
                <div className="flex justify-between text-[8px] text-gray-500 mb-2 uppercase tracking-[0.2em]">
                  <span>SIMPLEX_COMMS</span>
                  <span className={currentChannel === '1' ? 'text-orange-500' : 'text-blue-500'}>CHANNEL_{currentChannel}</span>
                </div>
                {connectionState === ConnectionState.CONNECTING && <div className="text-orange-400 text-center animate-pulse text-xs">BUSCANDO MALLA...</div>}
                {isConnected && !isTalking && !lastTranscript && <div className="text-emerald-500/50 text-center text-[10px] tracking-widest font-black uppercase">FRECUENCIA_LIBRE</div>}
                {isTalking && <div className={`${currentChannel === '1' ? 'text-orange-500' : 'text-blue-500'} text-center font-black text-lg animate-pulse uppercase tracking-[0.2em]`}>TRANSMITIENDO</div>}
                {lastTranscript && !isTalking && (
                  <div className="flex items-center justify-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-ping ${currentChannel === '1' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    <p className={`text-sm font-bold uppercase truncate max-w-[220px] ${currentChannel === '1' ? 'text-orange-400' : 'text-blue-400'}`}>{lastTranscript}</p>
                  </div>
                )}
            </div>

            {/* PTT Central */}
            <div className="relative">
                {isTalking && <div className={`absolute inset-0 rounded-full animate-ping scale-125 ${currentChannel === '1' ? 'bg-orange-500/10' : 'bg-blue-500/10'}`} />}
                <button
                    onMouseDown={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }}
                    onMouseUp={onTalkEnd} 
                    onTouchStart={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }} 
                    onTouchEnd={onTalkEnd}
                    className={`w-40 h-40 md:w-52 md:h-52 rounded-full flex flex-col items-center justify-center border-8 transition-all touch-none relative z-10 ${
                      !isConnected ? 'bg-gray-900 border-gray-800 opacity-50' : 
                      isTalking ? (currentChannel === '1' ? 'bg-orange-600 border-orange-400' : 'bg-blue-600 border-blue-400') + ' scale-95 shadow-2xl' : 
                      'bg-gray-800 border-gray-700 active:scale-95 shadow-xl'
                    }`}
                >
                    <Mic size={48} className={isTalking ? 'text-white' : isConnected ? (currentChannel === '1' ? 'text-orange-500' : 'text-blue-500') : 'text-gray-700'} />
                    <span className="text-[10px] font-black tracking-[0.2em] mt-3 uppercase">{isTalking ? 'AIR_TIME' : isConnected ? 'PUSH TO TALK' : 'LOCKED'}</span>
                </button>
            </div>

            {/* Info inferior */}
            <div className="grid grid-cols-2 gap-2 w-full mt-auto">
                <div className="bg-black/40 p-2.5 rounded border border-white/5 flex items-center justify-center gap-2">
                    <Globe size={14} className="text-blue-500" />
                    <span className="text-[9px] font-mono text-gray-500 uppercase">TUCUMAN_FIX</span>
                </div>
                <div className={`bg-black/40 p-2.5 rounded border flex items-center justify-center gap-2 ${currentChannel === '1' ? 'border-orange-500/20' : 'border-blue-500/20'}`}>
                    <Layers size={14} className={currentChannel === '1' ? 'text-orange-500' : 'text-blue-500'} />
                    <span className="text-[9px] font-mono text-gray-500 uppercase">MESH_CH_{currentChannel}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
