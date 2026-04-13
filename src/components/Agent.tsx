import React from 'react';
import { Agent as AgentType } from '../types';
import { motion } from 'motion/react';

interface Props {
  agent: AgentType;
}

export const Agent: React.FC<Props> = ({ agent }) => {
  const getRoleStyles = (role: string) => {
    switch(role) {
      case 'engineer': return { head: 'bg-yellow-400', body: 'bg-yellow-600', limb: 'bg-yellow-700', eye: 'bg-black' };
      case 'courier': return { head: 'bg-cyan-400', body: 'bg-cyan-600', limb: 'bg-cyan-700', eye: 'bg-white' };
      case 'security': return { head: 'bg-red-500', body: 'bg-red-700', limb: 'bg-red-900', eye: 'bg-yellow-300' };
      case 'admin': return { head: 'bg-purple-400', body: 'bg-purple-600', limb: 'bg-purple-800', eye: 'bg-cyan-300' };
      default: return { head: 'bg-gray-400', body: 'bg-gray-600', limb: 'bg-gray-700', eye: 'bg-black' };
    }
  };

  const styles = getRoleStyles(agent.role);
  const isWalking = agent.status === 'moving';

  return (
    <motion.div 
      className="absolute pointer-events-none flex flex-col items-center justify-end"
      initial={false}
      animate={{ 
        x: agent.x * 80, 
        y: agent.y * 80,
        zIndex: Math.floor(agent.y * 80 + 30) // Dynamic depth sorting
      }}
      transition={{ duration: 1, ease: "linear" }}
      style={{ width: 40, height: 60, marginLeft: -20, marginTop: -30 }}
    >
      {/* Task Bubble */}
      {agent.status === 'working' && (
        <div className="absolute -top-8 whitespace-nowrap bg-cyan-950/90 backdrop-blur-md text-cyan-300 text-[10px] px-2 py-1 rounded border border-cyan-500/50 font-tech tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.3)] z-50">
          {agent.task}
        </div>
      )}

      {/* Skeletal Container */}
      <div className={`relative flex flex-col items-center ${isWalking ? 'is-walking' : 'is-idle'}`}>
        {/* Head */}
        <div className={`w-5 h-5 rounded-md ${styles.head} z-20 flex items-center justify-center shadow-sm relative`}>
          {/* Eyes */}
          <div className="flex space-x-1">
            <div className={`w-1 h-1.5 rounded-full ${styles.eye} animate-pulse`}></div>
            <div className={`w-1 h-1.5 rounded-full ${styles.eye} animate-pulse`}></div>
          </div>
          {/* Role Indicator (Hat/Antenna) */}
          {agent.role === 'admin' && <div className="absolute -top-2 w-1 h-2 bg-purple-300 rounded-t-full"></div>}
          {agent.role === 'engineer' && <div className="absolute top-0 w-full h-1.5 bg-yellow-200 rounded-t-md opacity-50"></div>}
        </div>

        {/* Torso */}
        <div className={`torso w-4 h-6 ${styles.body} rounded-sm z-10 relative mt-0.5 shadow-sm`}>
          {/* Backpack for courier */}
          {agent.role === 'courier' && <div className="absolute -right-1.5 top-1 w-2 h-4 bg-cyan-300 rounded-sm"></div>}
          {/* Badge for security */}
          {agent.role === 'security' && <div className="absolute left-1 top-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>}
          
          {/* Left Arm */}
          <div className={`arm-l absolute -left-1.5 top-0.5 w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
          {/* Right Arm */}
          <div className={`arm-r absolute -right-1.5 top-0.5 w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
        </div>

        {/* Legs Container */}
        <div className="flex space-x-1 mt-0.5 z-0">
          {/* Left Leg */}
          <div className={`leg-l w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
          {/* Right Leg */}
          <div className={`leg-r w-1.5 h-5 ${styles.limb} rounded-full origin-top`}></div>
        </div>
      </div>
      
      {/* Shadow */}
      <div className="w-6 h-1.5 bg-black/40 rounded-full blur-[1px] mt-1"></div>
    </motion.div>
  );
};
