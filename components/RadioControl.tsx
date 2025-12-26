
import React from 'react';
import { Mic, Radio, Power, AlertTriangle, Wifi, Globe } from 'lucide-react';
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
}

export const RadioControl: React.FC<RadioControlProps> = ({
  connectionState, isTalking, onTalkStart, onTalkEnd, lastTranscript, onConnect, onDisconnect, onEmergencyClick, audioLevel
}) => {
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(50); };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 select-none relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none flex items-center justify-center">
            <div className="rounded-full bg-orange-500 blur-3xl transition-all duration-75" style={{ width: `${audioLevel * 4}px`, height: `${audioLevel * 4}px` }} />
        </div>

        <div className="flex justify-between items-start z-10 mb-6">
            <div className="flex items-center gap-3">
                <button 
                  onClick={isConnected ? onDisconnect : onConnect} 
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)]' : 'bg-red-900/20 border border-red-500/50 text-red-500'}`}
                >
                    <Power size={20} />
                </button>
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold tracking-tighter">{isConnected ? 'MESH_LINK_UP' : 'RADIO_OFFLINE'}</span>
                  <span className="text-[9px] text-gray-500 font-mono leading-none">{isConnected ? 'CHANNEL_01' : 'IDLE'}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={onEmergencyClick} 
                  className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center animate-pulse"
                >
                  <AlertTriangle size={18} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-8">
            <div className="w-full bg-black/80 border border-white/10 p-4 rounded font-mono shadow-inner min-h-[100px] flex flex-col justify-center">
                <div className="flex justify-between text-[9px] text-orange-500/50 mb-2">
                  <span className="uppercase tracking-widest">Digital Tactical Link</span>
                  <span>SIMPLEX_MODE</span>
                </div>
                {connectionState === ConnectionState.CONNECTING && <div className="text-orange-400 text-center animate-pulse text-xs">SINCRO_FREQ...</div>}
                {isConnected && !isTalking && !lastTranscript && <div className="text-emerald-500 text-center text-sm font-bold tracking-widest uppercase">ESPERANDO_TRAFICO</div>}
                {isTalking && <div className="text-orange-500 text-center font-black text-lg animate-pulse uppercase">TRANSMITIENDO</div>}
                {lastTranscript && !isTalking && (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                    <p className="text-sm text-orange-500 font-bold uppercase tracking-widest leading-tight">{lastTranscript}</p>
                  </div>
                )}
            </div>

            <div className="relative">
                {isTalking && <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />}
                <button
                    onMouseDown={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }}
                    onMouseUp={onTalkEnd} 
                    onTouchStart={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }} 
                    onTouchEnd={onTalkEnd}
                    className={`w-48 h-48 md:w-56 md:h-56 rounded-full flex flex-col items-center justify-center border-8 transition-all touch-none relative z-10 ${!isConnected ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed' : isTalking ? 'bg-orange-600 border-orange-400 scale-95 shadow-[0_0_50px_rgba(234,88,12,0.6)]' : 'bg-gray-800 border-gray-700 active:scale-95'}`}
                >
                    <Mic size={64} className={isTalking ? 'text-white' : isConnected ? 'text-orange-500' : 'text-gray-700'} />
                    <span className="text-[10px] font-black tracking-[0.2em] mt-4 uppercase">{isTalking ? 'HABLANDO' : isConnected ? 'PRESIONAR PTT' : 'BLOQUEADO'}</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-auto">
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Globe size={14} className="text-blue-500" />
                    <div className="flex flex-col"><span className="text-[8px] text-gray-600 uppercase">RED</span><span className="text-[10px] font-mono">P2P_MESH</span></div>
                </div>
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Wifi size={14} className="text-emerald-500" />
                    <div className="flex flex-col"><span className="text-[8px] text-gray-600 uppercase">SEÑAL</span><span className="text-[10px] font-mono">100% OK</span></div>
                </div>
            </div>
        </div>
    </div>
  );
};
