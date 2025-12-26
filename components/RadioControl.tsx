
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
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 md:p-6 select-none relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none flex items-center justify-center">
            <div className="rounded-full bg-orange-500 blur-3xl transition-all duration-75" style={{ width: `${audioLevel * 4}px`, height: `${audioLevel * 4}px` }} />
        </div>

        <div className="flex justify-between items-center z-10 mb-4 md:mb-6">
            <div className="flex items-center gap-3">
                <button 
                  onClick={isConnected ? onDisconnect : onConnect} 
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)]' : 'bg-red-900/20 border border-red-500/50 text-red-500'}`}
                >
                    <Power size={18} />
                </button>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] md:text-xs font-bold tracking-tighter">{isConnected ? 'MESH_LINK_UP' : 'RADIO_OFFLINE'}</span>
                  <span className="text-[9px] text-gray-500 font-mono leading-none">{isConnected ? 'CH_01' : 'IDLE'}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={onEmergencyClick} 
                  className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg shadow-red-900/40"
                >
                  <AlertTriangle size={18} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-4 md:gap-8">
            <div className="w-full bg-black/80 border border-white/10 p-3 md:p-4 rounded font-mono shadow-inner min-h-[80px] md:min-h-[100px] flex flex-col justify-center">
                <div className="flex justify-between text-[8px] md:text-[9px] text-orange-500/50 mb-1">
                  <span className="uppercase tracking-widest">Digital Tactical Link</span>
                  <span>SIMPLEX</span>
                </div>
                {connectionState === ConnectionState.CONNECTING && <div className="text-orange-400 text-center animate-pulse text-xs">SINCRO...</div>}
                {isConnected && !isTalking && !lastTranscript && <div className="text-emerald-500 text-center text-xs md:text-sm font-bold tracking-widest uppercase">ESPERANDO_TRAFICO</div>}
                {isTalking && <div className="text-orange-500 text-center font-black text-base md:text-lg animate-pulse uppercase">TRANSMITIENDO</div>}
                {lastTranscript && !isTalking && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                    <p className="text-xs md:text-sm text-orange-500 font-bold uppercase tracking-widest leading-tight">{lastTranscript}</p>
                  </div>
                )}
            </div>

            <div className="relative">
                {isTalking && <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping scale-110" />}
                <button
                    onMouseDown={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }}
                    onMouseUp={onTalkEnd} 
                    onTouchStart={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }} 
                    onTouchEnd={onTalkEnd}
                    className={`w-40 h-40 md:w-56 md:h-56 rounded-full flex flex-col items-center justify-center border-4 md:border-8 transition-all touch-none relative z-10 ${!isConnected ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed' : isTalking ? 'bg-orange-600 border-orange-400 scale-95 shadow-[0_0_50px_rgba(234,88,12,0.6)]' : 'bg-gray-800 border-gray-700 active:scale-95'}`}
                >
                    <Mic size={48} className={isTalking ? 'text-white' : isConnected ? 'text-orange-500' : 'text-gray-700'} />
                    <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] mt-3 uppercase">{isTalking ? 'HABLANDO' : isConnected ? 'PRESIONAR PTT' : 'BLOQUEADO'}</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full mt-auto mb-2">
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Globe size={12} className="text-blue-500" />
                    <div className="flex flex-col"><span className="text-[7px] text-gray-600 uppercase">RED</span><span className="text-[9px] font-mono">P2P_MESH</span></div>
                </div>
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Wifi size={12} className="text-emerald-500" />
                    <div className="flex flex-col"><span className="text-[7px] text-gray-600 uppercase">SEÑAL</span><span className="text-[9px] font-mono">100% OK</span></div>
                </div>
            </div>
        </div>
    </div>
  );
};
