import React from 'react';
import { ServerNode } from '../types';
import { Activity, Cpu, HardDrive, Network, Terminal } from 'lucide-react';

interface Props {
  server: ServerNode | null;
}

const ProgressBar = ({ label, value, color, icon: Icon }: { label: string, value: number, color: string, icon: any }) => (
  <div className="mb-5">
    <div className="flex justify-between items-center text-xs mb-2 font-tech tracking-wider text-gray-300">
      <div className="flex items-center space-x-2">
        <Icon size={14} className="opacity-70" />
        <span>{label}</span>
      </div>
      <span className="font-mono text-cyan-400">{Math.round(value)}%</span>
    </div>
    <div className="w-full h-2 bg-gray-900/80 rounded-full overflow-hidden border border-gray-700/50">
      <div 
        className={`h-full ${color} transition-all duration-500 shadow-[0_0_10px_currentColor]`} 
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);

export const MetricsPanel: React.FC<Props> = ({ server }) => {
  if (!server) {
    return (
      <div className="w-80 h-full glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
        <div className="w-24 h-24 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center mb-6 animate-[spin_10s_linear_infinite]">
          <div className="w-16 h-16 rounded-full border border-cyan-400/50 flex items-center justify-center animate-[spin_5s_linear_infinite_reverse]">
             <Cpu size={32} className="text-cyan-500/50 animate-pulse" />
          </div>
        </div>
        <p className="text-center tracking-widest text-sm font-tech">请在中央矩阵中<br/>选择 SoC 模块<br/>以查看详细遥测数据</p>
      </div>
    );
  }

  return (
    <div className="w-80 h-full glass-panel-active rounded-2xl p-6 flex flex-col text-white overflow-y-auto relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
      
      <h2 className="text-2xl mb-2 text-cyan-300 font-tech tracking-widest">{server.name}</h2>
      
      <div className="flex items-center space-x-2 mb-8 text-sm font-tech tracking-wider">
        <span className="text-gray-400">当前状态:</span>
        {server.status === 'online' && <span className="text-cyan-400 text-glow animate-pulse">● 在线</span>}
        {server.status === 'high-load' && <span className="text-pink-500 text-glow animate-ping">● 高负载</span>}
        {server.status === 'offline' && <span className="text-gray-500">● 休眠</span>}
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-xs text-cyan-500/80 mb-4 font-tech tracking-widest uppercase">计算资源分配</h3>
          <ProgressBar 
            label="性能/能效核心 (CPU)" 
            value={server.cpuUsage} 
            color={server.cpuUsage > 85 ? 'bg-pink-500' : 'bg-cyan-400'} 
            icon={Cpu}
          />
          <ProgressBar 
            label="神经引擎 (NPU/GPU)" 
            value={server.gpuUsage} 
            color={server.gpuUsage > 85 ? 'bg-pink-500' : 'bg-purple-500'} 
            icon={Activity}
          />
          <ProgressBar 
            label="统一内存 (UMA)" 
            value={server.ramUsage} 
            color={server.ramUsage > 85 ? 'bg-pink-500' : 'bg-emerald-400'} 
            icon={HardDrive}
          />
        </div>

        <div>
          <h3 className="text-xs text-cyan-500/80 mb-4 font-tech tracking-widest uppercase">内部总线吞吐量</h3>
          <div className="bg-black/40 p-4 rounded-xl border border-cyan-900/50 flex items-center justify-between">
            <Network className="text-cyan-500/50" size={24} />
            <div className="text-right">
              <span className="text-2xl font-mono text-cyan-300 text-glow">{Math.round(server.networkTraffic)}</span>
              <span className="text-xs text-cyan-600 ml-2 font-tech">GB/s</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-cyan-900/30">
          <h3 className="text-xs text-cyan-500/80 mb-3 font-tech tracking-widest uppercase flex items-center space-x-2">
            <Terminal size={14} />
            <span>模块终端</span>
          </h3>
          <div className="bg-black/50 p-3 rounded-lg border border-cyan-900/50 text-[11px] text-cyan-400/70 font-mono h-32 overflow-hidden flex flex-col justify-end space-y-1">
            <div className="opacity-50">&gt; 握手成功。</div>
            <div className="opacity-70">&gt; 正在获取模块指标...</div>
            <div className="opacity-90">&gt; 状态: {server.status === 'online' ? '在线' : server.status === 'high-load' ? '高负载' : '休眠'}</div>
            <div className="text-cyan-300">&gt; 正在分配模块算力...</div>
            <div className="animate-pulse text-cyan-200">&gt; _</div>
          </div>
        </div>
      </div>
    </div>
  );
};
