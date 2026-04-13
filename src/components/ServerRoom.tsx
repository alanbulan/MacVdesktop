import React from 'react';
import { ServerNode, Agent as AgentType } from '../types';
import { ServerRack } from './ServerRack';
import { Agent } from './Agent';

interface Props {
  servers: ServerNode[];
  agents: AgentType[];
  onSelectServer: (server: ServerNode) => void;
  selectedServerId: string | null;
}

export const ServerRoom: React.FC<Props> = ({ servers, agents, onSelectServer, selectedServerId }) => {
  return (
    <div className="absolute inset-0 bg-[#030508] overflow-hidden">
      
      {/* Flat 2D Room Container */}
      <div 
        className="absolute top-1/2 left-1/2 w-[2000px] h-[2000px] -translate-x-1/2 -translate-y-1/2 bg-grid-tech"
      >
        {/* Floor decorations */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {/* Central Core Glow */}
          <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1000px] bg-cyan-500/10 blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
          
          {/* Decorative Tech Circles */}
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] border border-cyan-500/30 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-[900px] h-[900px] border border-dashed border-cyan-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 animate-[spin_60s_linear_infinite]"></div>
        </div>

        {/* Servers & Agents Container */}
        <div className="absolute top-0 left-0 w-full h-full">
          {/* Servers */}
          {servers.map(server => (
            <ServerRack 
              key={server.id} 
              server={server} 
              onClick={onSelectServer}
              isSelected={server.id === selectedServerId}
            />
          ))}

          {/* Agents */}
          {agents.map(agent => (
            <Agent key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
};
