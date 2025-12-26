
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Channel } from '../types';
import { Hash, Lock, Plus, Search, ChevronRight, Key } from 'lucide-react';

interface ChannelSelectorProps {
  onSelect: (channel: Channel) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({ onSelect }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [enteringPassId, setEnteringPassId] = useState<string | null>(null);
  const [inputPass, setInputPass] = useState('');

  useEffect(() => {
    fetchChannels();
    const sub = supabase.channel('channels-sync')
      .on('postgres_changes', { event: '*', table: 'channels', schema: 'public' }, () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('*').order('name');
    if (data) setChannels(data);
    setLoading(false);
  };

  const createChannel = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from('channels').insert({
      name: newName.trim().toUpperCase(),
      password: newPass.trim() || null
    }).select().single();

    if (error) {
      alert("Error: El canal ya existe o no es válido");
    } else if (data) {
      onSelect(data);
    }
  };

  const handleJoin = (channel: Channel) => {
    if (channel.password) {
      setEnteringPassId(channel.id);
      setInputPass('');
    } else {
      onSelect(channel);
    }
  };

  const verifyPass = (channel: Channel) => {
    if (inputPass === channel.password) {
      onSelect(channel);
    } else {
      alert("Contraseña incorrecta");
      setInputPass('');
    }
  };

  const filtered = channels.filter(c => c.name.includes(searchTerm.toUpperCase()));

  return (
    <div className="w-full max-w-md bg-gray-950 border border-white/10 rounded-lg shadow-2xl flex flex-col h-[500px] overflow-hidden font-mono">
      <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <h2 className="text-orange-500 font-black tracking-widest text-sm flex items-center gap-2">
          <Hash size={16} /> RED_CANALES
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="p-1 hover:bg-white/10 rounded text-orange-500 transition-colors"
        >
          {isCreating ? <ChevronRight size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {isCreating ? (
        <div className="p-6 space-y-4 animate-in slide-in-from-right duration-300">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest">Nombre de Frecuencia</label>
            <input 
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="EJ: ALPHA-9"
              className="w-full bg-black border border-white/10 p-3 text-orange-500 outline-none focus:border-orange-500 uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest">Contraseña (Opcional)</label>
            <input 
              type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="VACIO PARA PUBLICO"
              className="w-full bg-black border border-white/10 p-3 text-orange-500 outline-none focus:border-orange-500"
            />
          </div>
          <button 
            onClick={createChannel}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 uppercase tracking-widest text-xs"
          >
            Establecer Canal
          </button>
        </div>
      ) : (
        <>
          <div className="p-3 bg-black/50 border-b border-white/5 flex items-center gap-2">
            <Search size={14} className="text-gray-600" />
            <input 
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="BUSCAR FRECUENCIA..."
              className="bg-transparent border-none outline-none text-xs text-white w-full uppercase"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-10 text-center text-[10px] text-gray-600 animate-pulse">SINCRONIZANDO RED...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-[10px] text-gray-600">NO HAY CANALES ACTIVOS</div>
            ) : (
              filtered.map(c => (
                <div key={c.id} className="border-b border-white/5 last:border-0">
                  {enteringPassId === c.id ? (
                    <div className="p-4 bg-orange-500/5 flex items-center gap-2 animate-in fade-in">
                      <Key size={14} className="text-orange-500" />
                      <input 
                        autoFocus type="password" value={inputPass} onChange={e => setInputPass(e.target.value)}
                        placeholder="CLAVE_CANAL"
                        onKeyDown={e => e.key === 'Enter' && verifyPass(c)}
                        className="bg-transparent border-b border-orange-500/50 outline-none text-orange-500 text-xs flex-1"
                      />
                      <button onClick={() => setEnteringPassId(null)} className="text-[10px] text-gray-500">CANCEL</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleJoin(c)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${c.password ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {c.password ? <Lock size={14} /> : <Hash size={14} />}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-gray-300 group-hover:text-white uppercase">{c.name}</div>
                          <div className="text-[9px] text-gray-600 uppercase tracking-tighter">{c.password ? 'Seguro' : 'Frecuencia Pública'}</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-700 group-hover:text-orange-500" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
