import { useState, useEffect } from 'react';
import { ServerNode, Agent } from '../types';

// Generate a 4x4 grid of hardware modules for a single Mac SoC
const generateServers = (): ServerNode[] => {
  const servers: ServerNode[] = [];
  const components = [
    '性能核心 (P-Core) 01', '性能核心 (P-Core) 02', '性能核心 (P-Core) 03', '性能核心 (P-Core) 04',
    '能效核心 (E-Core) 01', '能效核心 (E-Core) 02', '能效核心 (E-Core) 03', '能效核心 (E-Core) 04',
    '图形引擎 (GPU) 簇 A', '图形引擎 (GPU) 簇 B', '图形引擎 (GPU) 簇 C', '图形引擎 (GPU) 簇 D',
    '神经引擎 (Neural Engine)', '媒体引擎 (Media Engine)', '统一内存控制器 (UMA)', '固态存储控制器 (NVMe)'
  ];

  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const isHighLoad = Math.random() > 0.8;

    servers.push({
      id: `module-${i.toString().padStart(2, '0')}`,
      name: components[i],
      status: isHighLoad ? 'high-load' : 'online',
      cpuUsage: isHighLoad ? 90 + Math.random() * 10 : 30 + Math.random() * 40,
      gpuUsage: (row === 2 || i === 12) ? (isHighLoad ? 95 + Math.random() * 5 : 40 + Math.random() * 40) : 0,
      ramUsage: 50 + Math.random() * 40,
      networkTraffic: 100 + Math.random() * 800,
      x: 9.5 + col * 2, // Centered perfectly in the 2000x2000 grid
      y: 9.5 + row * 2,
    });
  }
  return servers;
};

const INITIAL_SERVERS = generateServers();

const INITIAL_AGENTS: Agent[] = [
  { id: 'agent-1', name: 'kernel_task', task: '内核线程调度', role: 'admin', x: 9.5, y: 9.5, targetX: 13.5, targetY: 9.5, status: 'idle' },
  { id: 'agent-2', name: 'WindowServer', task: 'UI 渲染合成', role: 'engineer', x: 15.5, y: 11.5, targetX: 15.5, targetY: 15.5, status: 'idle' },
  { id: 'agent-3', name: 'sysmond', task: '系统性能监控', role: 'security', x: 11.5, y: 15.5, targetX: 9.5, targetY: 15.5, status: 'idle' },
  { id: 'agent-4', name: 'coreml_daemon', task: 'CoreML 推理加速', role: 'courier', x: 17.5, y: 9.5, targetX: 17.5, targetY: 11.5, status: 'idle' },
  { id: 'agent-5', name: 'VTDecoder', task: '视频硬件解码', role: 'courier', x: 11.5, y: 11.5, targetX: 13.5, targetY: 9.5, status: 'idle' },
];

export function useSimulation() {
  const [servers, setServers] = useState<ServerNode[]>(INITIAL_SERVERS);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);

  // Simulate server metrics changing
  useEffect(() => {
    const interval = setInterval(() => {
      setServers(prev => prev.map(server => {
        if (server.status === 'offline') return server;
        
        const cpuChange = Math.floor(Math.random() * 15) - 7;
        const gpuChange = Math.floor(Math.random() * 15) - 7;
        const ramChange = Math.floor(Math.random() * 5) - 2;
        
        let newCpu = Math.max(10, Math.min(100, server.cpuUsage + cpuChange));
        let newGpu = server.gpuUsage > 0 ? Math.max(10, Math.min(100, server.gpuUsage + gpuChange)) : 0;
        let newRam = Math.max(30, Math.min(98, server.ramUsage + ramChange));
        
        let newStatus = server.status;
        if (newCpu > 92 || newGpu > 92) {
          newStatus = 'high-load';
        } else if (newStatus === 'high-load' && newCpu < 85 && newGpu < 85) {
          newStatus = 'online';
        }

        return {
          ...server,
          cpuUsage: newCpu,
          gpuUsage: newGpu,
          ramUsage: newRam,
          status: newStatus,
          networkTraffic: Math.max(50, server.networkTraffic + (Math.floor(Math.random() * 101) - 50))
        };
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Simulate agent movement
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => {
        if (agent.x === agent.targetX && agent.y === agent.targetY) {
          if (Math.random() > 0.6) {
            const targetServer = servers[Math.floor(Math.random() * servers.length)];
            return {
              ...agent,
              targetX: targetServer.x,
              targetY: targetServer.y + 1,
              status: 'moving'
            };
          } else {
            return { ...agent, status: Math.random() > 0.5 ? 'working' : 'idle' };
          }
        }

        let newX = agent.x;
        let newY = agent.y;
        
        // Move 1 grid unit per tick
        if (newX < agent.targetX) newX += 1;
        else if (newX > agent.targetX) newX -= 1;
        else if (newY < agent.targetY) newY += 1;
        else if (newY > agent.targetY) newY -= 1;

        return {
          ...agent,
          x: newX,
          y: newY,
          status: 'moving'
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [servers]);

  return { servers, agents };
}
