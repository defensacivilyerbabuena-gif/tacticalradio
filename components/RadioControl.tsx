
import React, { useState, useEffect } from 'react';
import { Mic, Radio, Activity, Users, Map as MapIcon, Power, AlertTriangle, Wifi, Globe } from 'lucide-react';
import { ConnectionState } from '../types';

interface RadioControlProps {
  connectionState: ConnectionState;
  isTalking: boolean;
  onTalkStart: () => void;
  onTalkEnd: () => void;
  lastTranscript: string | null;
  toggleView: () => void;
  viewMode: 'map' | 'list';
  onConnect: () => void;
  onDisconnect: () => void;
  onEmergencyClick: () => void;
  audioLevel: number; 
}

export const RadioControl: React.FC<RadioControlProps> = ({
  connectionState,
  isTalking,
  onTalkStart,
  onTalkEnd,
  lastTranscript,
  toggleView,
  viewMode,
  onConnect,
  onDisconnect,
  onEmergencyClick,
  audioLevel
}) => {
  
  const isConnected = connectionState === ConnectionState.CONNECTED;
  
  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    triggerHaptic();
    onTalkStart();
  };

  const handleMouseUp = () => {
    if (!isConnected) return;
    onTalkEnd();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 select-none relative overflow-hidden border-l border-gray-800">
        
        {/* Background Visualizer Effect */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
             <div className="w-full h-full flex items-center justify-center">
                 <div 
                    className="rounded-full bg-orange-500 transition-all duration-75"
                    style={{ width: `${audioLevel * 4}%`, height: `${audioLevel * 4}%` }}
                 />
             </div>
        </div>

        {/* Top Header - Info Táctica Real */}
        <div className="flex justify-between items-start z-10 mb-4">
            <div className="flex items-center gap-3">
                <button 
                  onClick={isConnected ? onDisconnect : onConnect}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${isConnected ? 'bg-emerald-500 text-white shadow-emerald-900/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}
                >
                    <Power size={18} />
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="font-mono text-xs font-black tracking-tighter">
                        {isConnected ? 'DATA-LINK ACTIVE' : 'SYSTEM OFFLINE'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono leading-none">
                    {isConnected ? 'IP SECURE GATEWAY' : 'NO NETWORK'}
                  </span>
                </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button 
                    onClick={onEmergencyClick}
                    className="w-10 h-10 rounded-xl bg-red-900/30 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center animate-pulse"
                >
                    <AlertTriangle size={20} />
                </button>
                <button 
                    onClick={toggleView}
                    className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 flex items-center justify-center"
                >
                    {viewMode === 'map' ? <Users size={20} /> : <MapIcon size={20} />}
                </button>
              </div>
            </div>
        </div>

        {/* Status Display Area */}
        <div className="flex-1 flex flex-col items-center justify-center z-10 gap-6 w-full">
            
            {/* Display HUD */}
            <div className="w-full bg-black/60 border border-gray-800 p-4 rounded-lg font-mono relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/30 group-hover:bg-emerald-500 transition-colors" />
                
                <div className="flex justify-between text-[10px] text-emerald-500/60 mb-2">
                  <span>TRANS-ID: {Math.random().toString(16).slice(2,8).toUpperCase()}</span>
                  <span className="animate-pulse">REC: READY</span>
                </div>

                <div className="min-h-[60px] flex flex-col justify-center">
                    {connectionState === ConnectionState.CONNECTING && (
                        <div className="text-yellow-400 text-center text-sm tracking-widest">ESTABLISHING ENCRYPTED LINK...</div>
                    )}
                    {connectionState === ConnectionState.DISCONNECTED && (
                        <div className="text-gray-600 text-center text-xs uppercase tracking-widest">Waiting for authorization</div>
                    )}
                    {isConnected && !isTalking && !lastTranscript && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-emerald-400 text-lg font-bold tracking-[0.2em]">VOIP CHANNEL 01</span>
                          <span className="text-gray-600 text-[10px] uppercase">Digital Simulation Mode</span>
                        </div>
                    )}
                    {isTalking && (
                        <div className="text-orange-500 text-center">
                          <div className="text-xl font-black tracking-widest animate-pulse">TRANSMITTING</div>
                          <div className="text-[10px] text-orange-800">DATA UPLINK IN PROGRESS</div>
                        </div>
                    )}
                    {lastTranscript && !isTalking && (
                         <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span className="text-[9px] text-orange-500/80 block uppercase mb-1">Incoming Msg:</span>
                            <p className="text-sm text-gray-200 italic leading-tight border-l-2 border-orange-500 pl-2">
                              {lastTranscript}
                            </p>
                         </div>
                    )}
                </div>
            </div>

            {/* PTT Button Container */}
            <div className="relative">
                {/* Visual waves when talking */}
                {isTalking && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping scale-150" />
                    <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping scale-125" />
                  </>
                )}
                
                <button
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchEnd={handleMouseUp}
                    className={`
                        w-52 h-52 rounded-full flex flex-col items-center justify-center
                        border-8 transition-all duration-100 transform active:scale-90 touch-none relative z-10
                        ${!isConnected ? 'bg-gray-900 border-gray-800 cursor-not-allowed grayscale' : 
                          isTalking 
                            ? 'bg-orange-600 border-orange-400 shadow-[0_0_60px_rgba(234,88,12,0.4)]' 
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600 shadow-2xl active:bg-orange-900'
                        }
                    `}
                >
                    <Mic size={56} className={`mb-2 ${isTalking ? 'text-white' : isConnected ? 'text-orange-500' : 'text-gray-700'}`} />
                    <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${isTalking ? 'text-white' : isConnected ? 'text-gray-400' : 'text-gray-700'}`}>
                        {isTalking ? 'RELEASING' : isConnected ? 'PUSH TO TALK' : 'LOCKED'}
                    </span>
                </button>
            </div>

             {/* Footer Info - Clarificación Técnica */}
             <div className="grid grid-cols-2 gap-4 w-full mt-auto">
                <div className="bg-black/40 p-2 rounded border border-gray-800 flex items-center gap-2">
                    <Globe size={14} className="text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase">Comm Type</span>
                      <span className="text-[10px] font-mono text-gray-300">TCP/IP MESH</span>
                    </div>
                </div>
                <div className="bg-black/40 p-2 rounded border border-gray-800 flex items-center gap-2">
                    <Wifi size={14} className="text-emerald-500" />
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase">Frequency Ref</span>
                      <span className="text-[10px] font-mono text-gray-300">462.5625 MHz</span>
                    </div>
                </div>
            </div>
            
            <div className="text-[9px] text-gray-600 font-mono text-center uppercase tracking-widest pb-2">
              End-to-end Encrypted Digital Radio Simulation
            </div>

        </div>
    </div>
  );
};
