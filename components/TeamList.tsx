import React from 'react';
import { TeamMember } from '../types';
import { User, Signal, Mic } from 'lucide-react';

interface TeamListProps {
  members: TeamMember[];
}

export const TeamList: React.FC<TeamListProps> = ({ members }) => {
  return (
    <div className="h-full overflow-y-auto bg-gray-900 border-l border-gray-800">
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
          <span>Active Units</span>
          <span className="bg-gray-800 text-xs px-2 py-1 rounded-full text-white">{members.length}/20</span>
        </h2>
      </div>
      <div className="divide-y divide-gray-800">
        {members.map((member) => (
          <div key={member.id} className="p-4 hover:bg-gray-800/50 transition-colors flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center 
                ${member.status === 'talking' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}
              `}>
                {member.status === 'talking' ? <Mic size={18} /> : <User size={18} />}
              </div>
              <div>
                <div className="font-bold text-sm text-gray-200">{member.name}</div>
                <div className="text-xs text-gray-500 font-mono">{member.role}</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
               <div className="flex items-center gap-1 text-xs text-emerald-500 font-mono">
                 <Signal size={10} />
                 <span>100%</span>
               </div>
               <span className="text-[10px] text-gray-600 font-mono">{member.distance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
