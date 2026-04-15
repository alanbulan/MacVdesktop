import { describe, expect, it } from 'vitest'
import { getModuleDetailLines } from './summary'
import type { TelemetryModuleSnapshot } from './types'

function createModule(overrides: Partial<TelemetryModuleSnapshot> = {}): TelemetryModuleSnapshot {
  return {
    id: 'cpu-cluster',
    name: 'CPU Cluster',
    summary: 'Host CPU usage sampled across 8 logical cores.',
    status: 'healthy',
    x: 0,
    y: 0,
    primaryMetric: {
      state: 'live',
      source: 'tauri-host',
      value: '42%',
      numericValue: 42,
      unit: 'percent',
      updatedAt: '2026-04-14T09:00:00.000Z',
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
          updatedAt: '2026-04-14T09:00:00.000Z',
          freshness: 'fresh',
        },
      },
    ],
    alerts: [],
    ...overrides,
  }
}

describe('getModuleDetailLines', () => {
  it('returns richer real-telemetry detail lines for live modules', () => {
    const lines = getModuleDetailLines(createModule())

    expect(lines).toEqual(
      expect.arrayContaining([
        'Host CPU usage sampled across 8 logical cores.',
        '主指标: 42%',
        '主指标来源: tauri-host',
        '数据新鲜度: 实时',
        '最近更新: 2026/4/14 17:00:00',
        'Logical cores: 8 · tauri-host · 实时',
        '宿主告警: 无',
      ]),
    )
  })

  it('keeps unavailable modules truthful about host limitations', () => {
    const lines = getModuleDetailLines(
      createModule({
        status: 'unavailable',
        summary: 'GPU activity is unavailable.',
        primaryMetric: {
          state: 'unavailable',
          source: 'tauri-host',
          reason: 'GPU activity telemetry requires a Metal counter collector.',
        },
        secondaryMetrics: [],
      }),
    )

    expect(lines).toEqual(
      expect.arrayContaining([
        'GPU activity is unavailable.',
        '主指标状态: 不可用',
        'GPU activity telemetry requires a Metal counter collector.',
        '次级遥测: 无',
        '宿主告警: 无',
      ]),
    )
  })

  it('marks stale live secondary metrics as cached host telemetry in detail lines', () => {
    const lines = getModuleDetailLines(
      createModule({
        secondaryMetrics: [
          {
            id: 'gpu-power',
            label: 'GPU power',
            metric: {
              state: 'live',
              source: 'tauri-host',
              value: '0.5 W',
              numericValue: 0.5,
              unit: 'watts',
              updatedAt: '2026-04-14T09:00:00.000Z',
              freshness: 'stale',
            },
          },
        ],
      }),
    )

    expect(lines).toEqual(expect.arrayContaining(['GPU power: 0.5 W · tauri-host · 缓存']))
  })
})
