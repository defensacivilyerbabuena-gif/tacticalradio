
import React from 'react';
import { TeamMember } from '../types';
import { User, Signal, Mic, Layers } from 'lucide-react';

interface TeamListProps {
  members: TeamMember[];
}

export const TeamList: React.FC<TeamListProps> = ({ members }) => {
  return (
    <div className="h-full overflow-y-auto bg-gray-900/50 scrollbar-thin">
      <div className="divide-y divide-gray-800">
        {members.length === 0 && (
          <div className="p-6 text-center text-gray-600 text-xs font-mono uppercase">No hay otras unidades activas</div>
        )}
        {members.map((member) => (
          <div key={member.id} className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center border
                ${member.status === 'talking' 
                  ? 'bg-orange-500 border-orange-400 text-white animate-pulse' 
                  : 'bg-gray-800 border-gray-700 text-gray-400'}
              `}>
                {member.status === 'talking' ? <Mic size={14} /> : <User size={14} />}
              </div>
              <div>
                <div className="font-bold text-xs text-gray-200">{member.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <span className="bg-orange-500/10 text-orange-500 text-[8px] px-1 py-0.5 rounded font-black border border-orange-500/20">CH{member.channel_id || '?'}</span>
                   <span className="text-[9px] text-gray-500 font-mono">{member.distance}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end opacity-40 group-hover:opacity-100">
               <Signal size={12} className="text-emerald-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
