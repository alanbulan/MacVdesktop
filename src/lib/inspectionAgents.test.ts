import { describe, expect, it } from 'vitest'
import { createInspectionAgents } from './inspectionAgents'

const modules = [
  {
    id: 'cpu-cluster',
    name: 'CPU Cluster',
    summary: 'Host CPU usage sampled across 8 logical cores.',
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
]

describe('createInspectionAgents', () => {
  it('moves patrol agents across phases for the same telemetry module', () => {
    const first = createInspectionAgents(modules, 0)[0]
    const second = createInspectionAgents(modules, 1)[0]
    const third = createInspectionAgents(modules, 4)[0]

    expect(first.x).not.toBe(second.x)
    expect(first.y).not.toBe(second.y)
    expect(third.status).toBe('working')
  })

  it('derives richer action detail from live module telemetry', () => {
    const first = createInspectionAgents(modules, 0)[0]

    expect(first.task).toBe('巡检 CPU Cluster')
    expect(first.detail).toBe('主指标 42% · fresh · 无宿主告警')
  })

  it('varies healthy agent narration across patrol phases', () => {
    const first = createInspectionAgents(modules, 0)[0]
    const second = createInspectionAgents(modules, 1)[0]
    const third = createInspectionAgents(modules, 2)[0]

    expect(first.task).not.toBe(second.task)
    expect(first.detail).not.toBe(second.detail)
    expect(['更新时间', '来源']).toContain(third.detail?.split(' ')[0])
  })

  it('cycles healthy agents through a richer choreography instead of only walking loops', () => {
    const phaseZero = createInspectionAgents(modules, 0)[0]
    const phaseFour = createInspectionAgents(modules, 4)[0]
    const phaseSeven = createInspectionAgents(modules, 7)[0]

    expect(phaseZero.status).toBe('idle')
    expect(phaseFour.status).toBe('working')
    expect(phaseSeven.task).toContain('同步')
    expect(phaseSeven.detail).toContain('扫描')
  })
})
