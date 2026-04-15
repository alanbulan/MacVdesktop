import { describe, expect, it } from 'vitest'
import { createFactoryAgentIntents } from './sceneChoreography'

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
    alerts: [
      {
        id: 'power-critical',
        severity: 'critical' as const,
        message: '功耗已达到临界阈值。',
      },
    ],
  },
]

describe('sceneChoreography', () => {
  it('creates worker intents for each module', () => {
    const intents = createFactoryAgentIntents(modules, 0)

    expect(intents).toHaveLength(2)
    expect(intents[0].task).toContain('CPU 簇')
  })

  it('elevates critical modules into urgent work states', () => {
    const intents = createFactoryAgentIntents(modules, 1)
    const powerIntent = intents.find((intent) => intent.id === 'inspection-agent-power-draw')

    expect(powerIntent?.status).toMatch(/moving|working/)
    expect(powerIntent?.task).toMatch(/紧急转运|压制/)
    expect(powerIntent?.detail).toContain('功耗已达到临界阈值')
  })

  it('moves workers along different lane offsets across phases', () => {
    const first = createFactoryAgentIntents(modules, 0)[0]
    const second = createFactoryAgentIntents(modules, 1)[0]

    expect(first.x).not.toBe(second.x)
    expect(first.y).not.toBe(second.y)
  })

})
