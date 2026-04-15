import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TelemetryHistorySample } from '../types'
import { MetricsPanel } from './MetricsPanel'

const cpuHistory: TelemetryHistorySample[] = [
  {
    moduleId: 'cpu-cluster',
    metricId: 'primary',
    value: '72%',
    numericValue: 72,
    updatedAt: '2026-04-14T09:00:00.000Z',
    freshness: 'fresh',
  },
  {
    moduleId: 'cpu-cluster',
    metricId: 'primary',
    value: '82%',
    numericValue: 82,
    updatedAt: '2026-04-14T09:01:00.000Z',
    freshness: 'fresh',
  },
  {
    moduleId: 'cpu-cluster',
    metricId: 'primary',
    value: '76%',
    numericValue: 76,
    updatedAt: '2026-04-14T09:02:00.000Z',
    freshness: 'fresh',
  },
]

afterEach(() => {
  cleanup()
})

describe('MetricsPanel', () => {
  it('renders Chinese unavailable metric reasons', () => {
    render(
      <MetricsPanel
        history={[]}
        module={{
          id: 'thermal-state',
          name: '热状态',
          summary: '不可用',
          status: 'unavailable',
          x: 0,
          y: 0,
          primaryMetric: {
            state: 'unavailable',
            reason: '需要 Tauri 桌面宿主',
            source: 'browser-fallback',
          },
          secondaryMetrics: [],
          alerts: [],
        }}
      />,
    )

    expect(screen.getAllByText(/需要 Tauri 桌面宿主/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/不可用/i).length).toBeGreaterThan(0)
  })

  it('renders live secondary metrics and alerts for native telemetry', () => {
    render(
      <MetricsPanel
        history={cpuHistory}
        module={{
          id: 'cpu-cluster',
          name: 'CPU Cluster',
          summary: 'Host CPU usage sampled across 8 logical cores.',
          status: 'warning',
          x: 0,
          y: 0,
          primaryMetric: {
            state: 'live',
            source: 'tauri-host',
            value: '82%',
            numericValue: 82,
            unit: 'percent',
            updatedAt: '123',
            freshness: 'fresh',
          },
          secondaryMetrics: [
            {
              id: 'cpu-logical-cores',
              label: 'Logical cores',
              metric: {
                state: 'live',
                source: 'tauri-host',
                value: '8',
                numericValue: 8,
                unit: 'count',
                updatedAt: '123',
                freshness: 'fresh',
              },
            },
          ],
          alerts: [
            {
              id: 'cpu-high-usage',
              severity: 'warning',
              message: 'CPU usage is above the warning threshold.',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('Logical cores')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('CPU usage is above the warning threshold.')).toBeTruthy()
  })

  it('renders GPU power as secondary telemetry while GPU activity stays unavailable', () => {
    render(
      <MetricsPanel
        history={[]}
        module={{
          id: 'gpu-activity',
          name: 'GPU Activity',
          summary: 'GPU activity is unavailable, but GPU power was sampled from powermetrics SMC output.',
          status: 'unavailable',
          x: 1,
          y: 0,
          primaryMetric: {
            state: 'unavailable',
            reason: 'GPU activity telemetry requires a Metal counter collector.',
            source: 'tauri-host',
          },
          secondaryMetrics: [
            {
              id: 'gpu-power',
              label: 'GPU power',
              metric: {
                state: 'live',
                source: 'tauri-host',
                value: '0.5 W',
                numericValue: 456,
                unit: 'watts',
                updatedAt: '123',
                freshness: 'fresh',
              },
            },
          ],
          alerts: [],
        }}
      />,
    )

    expect(screen.getAllByText('不可用').length).toBeGreaterThan(0)
    expect(screen.getByText('GPU power')).toBeTruthy()
    expect(screen.getByText('0.5 W')).toBeTruthy()
    expect(screen.getByText('GPU activity telemetry requires a Metal counter collector.')).toBeTruthy()
  })

  it('renders stale live metrics as cached host telemetry', () => {
    render(
      <MetricsPanel
        history={[]}
        module={{
          id: 'power-draw',
          name: 'Power Draw',
          summary: 'Best-effort power telemetry sampled from cached powermetrics SMC output.',
          status: 'healthy',
          x: 2,
          y: 2,
          primaryMetric: {
            state: 'live',
            source: 'tauri-host',
            value: '8.4 W',
            numericValue: 8.4,
            unit: 'watts',
            updatedAt: '123',
            freshness: 'stale',
          },
          secondaryMetrics: [],
          alerts: [],
        }}
      />,
    )

    expect(screen.getByText('8.4 W')).toBeTruthy()
    expect(screen.getByText('真实宿主遥测读数（缓存，可能已过期）')).toBeTruthy()
  })

  it('renders a truthful sparkline only when real numeric history exists', () => {
    render(
      <MetricsPanel
        history={cpuHistory}
        module={{
          id: 'cpu-cluster',
          name: 'CPU Cluster',
          summary: 'Host CPU usage sampled across 8 logical cores.',
          status: 'healthy',
          x: 0,
          y: 0,
          primaryMetric: {
            state: 'live',
            source: 'tauri-host',
            value: '76%',
            numericValue: 76,
            unit: 'percent',
            updatedAt: '2026-04-14T09:02:00.000Z',
            freshness: 'fresh',
          },
          secondaryMetrics: [],
          alerts: [],
        }}
      />,
    )

    expect(screen.getByLabelText('主指标真实历史曲线')).toBeTruthy()
    expect(screen.getByText('最近 3 次真实采样')).toBeTruthy()
  })
})
