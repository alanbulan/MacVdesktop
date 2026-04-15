import { describe, expect, it } from 'vitest'
import { createFactoryConduits, createFactoryDocks, createFactoryRoutes, createFactoryZones } from './sceneModel'

const modules = [
  {
    id: 'cpu-cluster',
    name: 'CPU 簇',
    summary: 'CPU telemetry is live.',
    status: 'healthy' as const,
    x: 0,
    y: 0,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '42%',
      numericValue: 42,
      unit: 'percent' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'gpu-activity',
    name: 'GPU 活动',
    summary: 'GPU telemetry is live.',
    status: 'warning' as const,
    x: 1,
    y: 0,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '67%',
      numericValue: 67,
      unit: 'percent' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'memory-pressure',
    name: '内存压力',
    summary: 'Memory telemetry is live.',
    status: 'healthy' as const,
    x: 2,
    y: 0,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '正常',
      updatedAt: '123',
      freshness: 'fresh' as const,
      unit: 'state' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'disk-usage',
    name: '磁盘占用',
    summary: 'Disk telemetry is live.',
    status: 'healthy' as const,
    x: 0,
    y: 1,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '61%',
      numericValue: 61,
      unit: 'percent' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'network-throughput',
    name: '网络吞吐',
    summary: 'Network telemetry is live.',
    status: 'healthy' as const,
    x: 1,
    y: 1,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '2.4 MB/s',
      numericValue: 2.4,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'top-process',
    name: '高占用进程',
    summary: 'Process telemetry is live.',
    status: 'healthy' as const,
    x: 2,
    y: 1,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '31%',
      numericValue: 31,
      unit: 'percent' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'thermal-state',
    name: '热状态',
    summary: 'Thermal telemetry is live.',
    status: 'warning' as const,
    x: 0,
    y: 2,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '偏高',
      updatedAt: '123',
      freshness: 'fresh' as const,
      unit: 'state' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'fan-speed',
    name: '风扇转速',
    summary: 'Fan telemetry is live.',
    status: 'healthy' as const,
    x: 1,
    y: 2,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '1800 rpm',
      numericValue: 1800,
      unit: 'rpm' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
  {
    id: 'power-draw',
    name: '功耗',
    summary: 'Power telemetry is live.',
    status: 'critical' as const,
    x: 2,
    y: 2,
    primaryMetric: {
      state: 'live' as const,
      source: 'tauri-host' as const,
      value: '18.4 W',
      numericValue: 18.4,
      unit: 'watts' as const,
      updatedAt: '123',
      freshness: 'fresh' as const,
    },
    secondaryMetrics: [],
    alerts: [],
  },
]

describe('sceneModel', () => {
  it('groups modules into three factory zones', () => {
    const zones = createFactoryZones(modules)

    expect(zones).toHaveLength(3)
    expect(zones.map((zone) => zone.label)).toEqual(['计算中枢区', '交换物流区', '维持散热区'])
    expect(zones[0].status).toBe('warning')
    expect(zones[2].status).toBe('critical')
  })

  it('creates conduits between derived zones', () => {
    const conduits = createFactoryConduits(createFactoryZones(modules))

    expect(conduits).toHaveLength(3)
    expect(conduits.map((conduit) => conduit.label)).toEqual(
      expect.arrayContaining(['主数据通路', '能源回流通路', '骨干升降井']),
    )
    expect(conduits.some((conduit) => conduit.status === 'critical')).toBe(true)
  })

  it('creates factory docks and path routes for the modules', () => {
    const zones = createFactoryZones(modules)
    const docks = createFactoryDocks(zones)
    const routes = createFactoryRoutes(modules)

    expect(docks).toHaveLength(3)
    expect(docks[0].label).toContain('装配坞')
    expect(routes).toHaveLength(modules.length)
    expect(routes[0].points).toHaveLength(4)
  })
})
