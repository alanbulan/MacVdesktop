import { describe, expect, it } from 'vitest'
import { createTelemetryProvider } from '../../integrations/telemetry/provider'
import { createBrowserTelemetrySnapshot } from './browserSnapshot'

describe('createBrowserTelemetrySnapshot', () => {
  it('marks mac-only telemetry modules as unavailable in browser mode', () => {
    const snapshot = createBrowserTelemetrySnapshot()
    const cpuCluster = snapshot.modules.find((module) => module.id === 'cpu-cluster')
    const thermalState = snapshot.modules.find((module) => module.id === 'thermal-state')

    expect(snapshot.runtime.kind).toBe('browser')
    expect(cpuCluster?.primaryMetric.state).toBe('unavailable')
    expect(cpuCluster).toMatchObject({
      name: 'CPU Cluster',
      summary: 'Requires Tauri desktop host for live processor telemetry.',
      status: 'unavailable',
      x: 0,
      y: 0,
      secondaryMetrics: [],
      alerts: [],
    })
    expect(thermalState?.primaryMetric).toMatchObject({
      state: 'unavailable',
      reason: expect.stringContaining('Requires Tauri desktop host'),
    })
    expect(thermalState).toMatchObject({
      name: 'Thermal State',
      status: 'unavailable',
      x: 0,
      y: 2,
      secondaryMetrics: [],
      alerts: [],
    })
  })

  it('adds truthful browser-fallback metadata to unavailable metrics', () => {
    const snapshot = createBrowserTelemetrySnapshot()
    const cpuCluster = snapshot.modules.find((module) => module.id === 'cpu-cluster')

    expect(cpuCluster?.primaryMetric).toMatchObject({
      state: 'unavailable',
      source: 'browser-fallback',
      reason: 'Requires Tauri desktop host integration',
    })
  })
})

describe('createTelemetryProvider', () => {
  it('loads the browser snapshot through an async-friendly contract', async () => {
    const provider = createTelemetryProvider()

    await expect(provider.getSnapshot()).resolves.toMatchObject({
      runtime: { kind: 'browser' },
    })
  })
})

describe('browser telemetry module coverage', () => {
  it('exposes the full truthful telemetry module layout', () => {
    const snapshot = createBrowserTelemetrySnapshot()
    const moduleIds = snapshot.modules.map((module) => module.id)

    expect(moduleIds).toEqual(
      expect.arrayContaining([
        'cpu-cluster',
        'gpu-activity',
        'memory-pressure',
        'disk-usage',
        'network-throughput',
        'top-process',
        'thermal-state',
        'fan-speed',
        'power-draw',
      ]),
    )
    expect(snapshot.modules).toHaveLength(9)
  })
})
