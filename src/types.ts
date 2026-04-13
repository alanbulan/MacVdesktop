export interface ServerNode {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'high-load';
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  networkTraffic: number; // MB/s
  x: number; // Grid position X
  y: number; // Grid position Y
}

export interface Agent {
  id: string;
  name: string;
  task: string;
  role: 'engineer' | 'courier' | 'security' | 'admin';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  status: 'idle' | 'working' | 'moving';
}
