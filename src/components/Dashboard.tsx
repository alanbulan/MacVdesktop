import React, { useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { ServerRoom } from './ServerRoom';
import { MetricsPanel } from './MetricsPanel';
import { ServerNode } from '../types';
import { Zap, Activity, Terminal } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { servers, agents } = useSimulation();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const selectedServer = servers.find(s => s.id === selectedServerId) || null;

  // Calculate global stats
  const totalCpu = Math.round(servers.reduce((acc, s) => acc + s.cpuUsage, 0) / servers.length) || 0;
  const totalGpu = Math.round(servers.reduce((acc, s) => acc + s.gpuUsage, 0) / servers.filter(s => s.gpuUsage > 0).length || 1);
  const totalRam = Math.round(servers.reduce((acc, s) => acc + s.ramUsage, 0) / servers.length) || 0;
  const totalNetwork = Math.round(servers.reduce((acc, s) => acc + s.networkTraffic, 0)) || 0;
  const onlineCount = servers.filter(s => s.status !== 'offline').length;

  return (
    <div className="relative w-screen h-screen bg-[#030508] text-white font-sans overflow-hidden">
      
      {/* 3D Background Room */}
      <ServerRoom 
        servers={servers} 
        agents={agents} 
        onSelectServer={(server) => setSelectedServerId(server.id)}
        selectedServerId={selectedServerId}
      />

      {/* Floating Header */}
      <header className="absolute top-6 left-6 right-6 glass-panel rounded-2xl p-4 flex justify-between items-center z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-xl border border-cyan-400/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Zap className="text-cyan-400" size={28} />
          </div>
          <div>
            <h1 className="text-3xl text-cyan-300 font-tech tracking-widest font-bold">Apple Silicon SoC 架构</h1>
            <p className="text-sm text-cyan-600/80 font-tech tracking-widest uppercase">单机算力深度遥测系统</p>
          </div>
        </div>
        
        <div className="flex space-x-12 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">系统状态</span>
            <span className="text-2xl font-mono text-emerald-400 text-glow">运行良好</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">神经引擎负载</span>
            <span className={`text-2xl font-mono ${totalGpu > 80 ? 'text-pink-500 text-glow' : 'text-cyan-400'}`}>{totalGpu}%</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">活跃模块</span>
            <span className="text-2xl font-mono text-cyan-300">{onlineCount}/{servers.length}</span>
          </div>
        </div>
      </header>

      {/* Left Panel: Global Overview */}
      <div className="absolute left-6 top-32 bottom-6 w-80 glass-panel rounded-2xl p-6 flex flex-col z-50">
        <h2 className="text-xl mb-6 text-cyan-400 font-tech tracking-widest flex items-center space-x-2">
          <Activity size={20} />
          <span>SoC 全局概览</span>
        </h2>

        <div className="space-y-6 flex-1">
          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech">系统总负载 (CPU)</div>
            <div className="text-3xl font-mono text-cyan-300">{totalCpu}%</div>
          </div>
          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech">统一内存压力 (UMA)</div>
            <div className="text-3xl font-mono text-emerald-400">{totalRam}%</div>
          </div>
          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech">内部总线带宽 (Fabric)</div>
            <div className="text-3xl font-mono text-purple-400">{totalNetwork} <span className="text-sm">GB/s</span></div>
          </div>

          <div className="pt-6 border-t border-cyan-900/30 mt-auto">
            <h3 className="text-sm text-cyan-500 mb-3 font-tech tracking-widest flex items-center space-x-2">
              <Terminal size={14} />
              <span>系统调度日志</span>
            </h3>
            <div className="bg-black/50 p-3 rounded-lg border border-cyan-900/50 text-xs text-cyan-400/70 font-mono h-40 overflow-hidden flex flex-col justify-end space-y-1">
              <div className="opacity-40">&gt; 初始化 Apple Silicon SoC...</div>
              <div className="opacity-50">&gt; 识别到 16 个核心/硬件模块。</div>
              <div className="opacity-60">&gt; 统一内存架构 (UMA) 就绪。</div>
              <div className="opacity-80">&gt; 神经引擎 (NPU) 待命。</div>
              <div className="opacity-90 text-cyan-300">&gt; 本地遥测数据流已建立。</div>
              <div className="animate-pulse text-cyan-200">&gt; _</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Metrics Panel */}
      <div className="absolute right-6 top-32 bottom-6 z-50 flex flex-col pointer-events-none">
        <div className="pointer-events-auto h-full">
          <MetricsPanel server={selectedServer} />
        </div>
      </div>
      
      {/* Vignette overlay for depth */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-40"></div>
    </div>
  );
};
