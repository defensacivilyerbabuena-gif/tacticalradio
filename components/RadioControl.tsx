
import React from 'react';
import { Mic, Radio, Power, AlertTriangle, Wifi, Globe, LogOut } from 'lucide-react';
import { ConnectionState } from '../types';

interface RadioControlProps {
  connectionState: ConnectionState;
  isTalking: boolean;
  activeChannelName?: string;
  onTalkStart: () => void;
  onTalkEnd: () => void;
  lastTranscript: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onEmergencyClick: () => void;
  onQSY: () => void; // Función para cambiar de canal
  audioLevel: number; 
}

export const RadioControl: React.FC<RadioControlProps> = ({
  connectionState, isTalking, activeChannelName, onTalkStart, onTalkEnd, lastTranscript, onConnect, onDisconnect, onEmergencyClick, onQSY, audioLevel
}) => {
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const triggerHaptic = () => { if (navigator.vibrate) navigator.vibrate(50); };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-3 md:p-6 select-none relative overflow-hidden">
        {/* Glow de nivel de audio */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
            <div className="rounded-full bg-orange-500 blur-3xl transition-all duration-75" style={{ width: `${audioLevel * 5}px`, height: `${audioLevel * 5}px` }} />
        </div>

        {/* Header Superior */}
        <div className="flex justify-between items-center z-10 mb-3 md:mb-6">
            <div className="flex items-center gap-3">
                <button 
                  onClick={isConnected ? onDisconnect : onConnect} 
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40' : 'bg-red-900/20 border border-red-500/50 text-red-500'}`}
                >
                    <Power size={18} />
                </button>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] md:text-xs font-bold uppercase">{activeChannelName || 'NO_FREQ'}</span>
                  <span className="text-[8px] text-gray-500 font-mono tracking-tighter uppercase">{isConnected ? 'Link Activo' : 'Sistema Standby'}</span>
                </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={onQSY} 
                className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 text-orange-500 flex items-center justify-center border border-white/5 shadow-lg active:scale-90 transition-transform"
                title="Cambiar Canal (QSY)"
              >
                <LogOut size={18} />
              </button>
              <button 
                onClick={onEmergencyClick} 
                className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg shadow-red-900/40 active:scale-90 transition-transform"
              >
                <AlertTriangle size={18} />
              </button>
            </div>
        </div>

        {/* Visor de Estado */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-3 md:gap-8 min-h-[280px]">
            <div className="w-full bg-black/60 border border-white/5 p-3 md:p-4 rounded font-mono shadow-inner min-h-[70px] flex flex-col justify-center">
                <div className="flex justify-between text-[7px] md:text-[9px] text-orange-500/40 mb-1">
                  <span className="uppercase tracking-widest">Digital Tactical Radio v3.0</span>
                  <span>{isConnected ? 'ENLAZADO' : 'BUSCANDO'}</span>
                </div>
                {connectionState === ConnectionState.CONNECTING && <div className="text-orange-400 text-center animate-pulse text-xs">SINCRO_FREQ...</div>}
                {isConnected && !isTalking && !lastTranscript && <div className="text-emerald-500 text-center text-[10px] md:text-sm font-bold tracking-[0.2em] uppercase">FRECUENCIA_LIMPIA</div>}
                {isTalking && <div className="text-orange-500 text-center font-black text-sm md:text-lg animate-pulse uppercase tracking-widest">TX_TRANSMITIENDO</div>}
                {lastTranscript && !isTalking && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1 h-1 bg-orange-500 rounded-full animate-ping" />
                    <p className="text-[10px] md:text-sm text-orange-500 font-bold uppercase tracking-widest truncate max-w-[200px]">{lastTranscript}</p>
                  </div>
                )}
            </div>

            {/* Botón PTT Central */}
            <div className="relative">
                {isTalking && <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping scale-125" />}
                <button
                    onMouseDown={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }}
                    onMouseUp={onTalkEnd} 
                    onTouchStart={(e) => { e.preventDefault(); if (isConnected) { triggerHaptic(); onTalkStart(); } }} 
                    onTouchEnd={onTalkEnd}
                    className={`w-36 h-36 md:w-52 md:h-52 rounded-full flex flex-col items-center justify-center border-4 md:border-8 transition-all touch-none relative z-10 ${!isConnected ? 'bg-gray-900 border-gray-800 opacity-50' : isTalking ? 'bg-orange-600 border-orange-400 scale-95 shadow-[0_0_40px_rgba(234,88,12,0.4)]' : 'bg-gray-800 border-gray-700 active:scale-95 shadow-xl'}`}
                >
                    <Mic size={isTalking ? 52 : 44} className={isTalking ? 'text-white' : isConnected ? 'text-orange-500' : 'text-gray-700'} />
                    <span className="text-[8px] md:text-[10px] font-black tracking-[0.2em] mt-2 uppercase">{isTalking ? 'HABLANDO' : isConnected ? 'PUSH TO TALK' : 'BLOQUEADO'}</span>
                </button>
            </div>

            {/* Información Inferior */}
            <div className="grid grid-cols-2 gap-2 w-full mt-auto mb-1">
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Globe size={12} className="text-blue-500" />
                    <span className="text-[8px] font-mono text-gray-400 uppercase">MESH_ENCRIPTADA</span>
                </div>
                <div className="bg-black/40 p-2 rounded border border-white/5 flex items-center gap-2">
                    <Wifi size={12} className="text-emerald-500" />
                    <span className="text-[8px] font-mono text-gray-400 uppercase">SIGNAL_STABLE</span>
                </div>
            </div>
        </div>
    </div>
  );
};
