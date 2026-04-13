import React from 'react';
import { ServerNode } from '../types';
import { Server, Database } from 'lucide-react';

interface Props {
  server: ServerNode;
  onClick: (server: ServerNode) => void;
  isSelected: boolean;
}

export const ServerRack: React.FC<Props> = ({ server, onClick, isSelected }) => {
  const isStorage = server.name.includes('存储');
  
  let statusColor = 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]';
  let iconColor = 'text-cyan-400';
  let headerBg = 'bg-cyan-950/50';
  
  if (server.status === 'high-load') {
    statusColor = 'border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.4)]';
    iconColor = 'text-pink-500';
    headerBg = 'bg-pink-950/50';
  }
  if (server.status === 'offline') {
    statusColor = 'border-gray-700/50';
    iconColor = 'text-gray-600';
    headerBg = 'bg-gray-900/50';
  }

  const blinkClass = server.status === 'online' ? 'animate-pulse' : '';
  const fastBlinkClass = server.status === 'high-load' ? 'animate-ping' : '';

  return (
    <div 
      className={`absolute cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2`}
      style={{
        left: `${server.x * 80}px`,
        top: `${server.y * 80}px`,
        width: '80px',
        height: '120px',
        marginLeft: '-40px', // Center horizontally based on coordinate
        marginTop: '-60px',  // Center vertically
        zIndex: isSelected ? 10000 : Math.floor(server.y * 80 + 60) // Dynamic depth sorting
      }}
      onClick={() => onClick(server)}
    >
      {/* 2D Flat Glass Card */}
      <div className={`w-full h-full glass-panel rounded-lg flex flex-col overflow-hidden border ${statusColor} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}`}>
        
        {/* Header / Name */}
        <div className={`w-full ${headerBg} text-center py-1 border-b border-white/10`}>
          <span className="text-[9px] font-tech text-white/90 tracking-wider block truncate px-1">{server.name}</span>
        </div>

        {/* Icon & Status */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${server.status !== 'offline' ? (server.status === 'high-load' ? 'bg-pink-500' : 'bg-cyan-400') : 'bg-gray-600'} ${server.status === 'high-load' ? fastBlinkClass : blinkClass}`}></div>
          
          <div className={`${iconColor} ${server.status === 'online' ? 'drop-shadow-[0_0_5px_currentColor]' : ''}`}>
            {isStorage ? <Database size={28} strokeWidth={1.5} /> : <Server size={28} strokeWidth={1.5} />}
          </div>
        </div>

        {/* Data Lines */}
        <div className="h-6 w-full bg-black/40 flex flex-col justify-evenly px-2 py-1 border-t border-white/5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-full h-0.5 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full ${server.status === 'offline' ? 'bg-gray-700' : (server.status === 'high-load' ? 'bg-pink-500' : 'bg-cyan-400')} ${i % 2 === 0 ? fastBlinkClass : blinkClass}`} style={{ width: `${Math.random() * 60 + 20}%` }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
