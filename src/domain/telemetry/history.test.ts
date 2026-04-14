import { describe, expect, it } from 'vitest'
import type { TelemetryMetric } from './types'
import { appendMetricHistory } from './history'

function createLiveMetric(overrides: Partial<Extract<TelemetryMetric, { state: 'live' }>> = {}): Extract<TelemetryMetric, { state: 'live' }> {
  return {
    state: 'live',
    source: 'tauri-host',
    value: '42%',
    numericValue: 42,
    unit: 'percent',
    updatedAt: '2026-04-14T09:00:00.000Z',
    freshness: 'fresh',
    ...overrides,
  }
}

describe('appendMetricHistory', () => {
  it('records a new live numeric sample for a module metric', () => {
    const result = appendMetricHistory({}, 'cpu-cluster', 'primary', createLiveMetric())

    expect(result['cpu-cluster:primary']).toEqual([
      {
        moduleId: 'cpu-cluster',
        metricId: 'primary',
        value: '42%',
        numericValue: 42,
        updatedAt: '2026-04-14T09:00:00.000Z',
        freshness: 'fresh',
      },
    ])
  })

  it('ignores metrics that are not live numeric samples', () => {
    const result = appendMetricHistory(
      {},
      'cpu-cluster',
      'primary',
      {
        state: 'unavailable',
        source: 'tauri-host',
        reason: 'GPU activity is unavailable.',
      },
    )

    expect(result).toEqual({})
  })

  it('deduplicates repeated updates with the same timestamp', () => {
    const initial = appendMetricHistory({}, 'cpu-cluster', 'primary', createLiveMetric())
    const result = appendMetricHistory(initial, 'cpu-cluster', 'primary', createLiveMetric())

    expect(result['cpu-cluster:primary']).toHaveLength(1)
  })

  it('keeps only the most recent 20 samples', () => {
    let history = {}

    for (let index = 0; index < 22; index += 1) {
      history = appendMetricHistory(
        history,
        'cpu-cluster',
        'primary',
        createLiveMetric({
          value: `${index}%`,
          numericValue: index,
          updatedAt: `2026-04-14T09:00:${index.toString().padStart(2, '0')}.000Z`,
        }),
      )
    }

    expect(history['cpu-cluster:primary']).toHaveLength(20)
    expect(history['cpu-cluster:primary'][0]?.numericValue).toBe(2)
    expect(history['cpu-cluster:primary'][19]?.numericValue).toBe(21)
  })
})
