import type { TelemetryMetric } from './types'
import type { TelemetryHistorySample } from '../../types'

const MAX_HISTORY_SAMPLES = 20

export function appendMetricHistory(
  history: Record<string, TelemetryHistorySample[]>,
  moduleId: string,
  metricId: string,
  metric: TelemetryMetric,
): Record<string, TelemetryHistorySample[]> {
  if (metric.state !== 'live' || metric.numericValue === undefined) {
    return history
  }

  const historyKey = `${moduleId}:${metricId}`
  const currentSamples = history[historyKey] ?? []

  if (currentSamples[currentSamples.length - 1]?.updatedAt === metric.updatedAt) {
    return history
  }

  const nextSamples = [
    ...currentSamples,
    {
      moduleId,
      metricId,
      value: metric.value,
      numericValue: metric.numericValue,
      updatedAt: metric.updatedAt,
      freshness: metric.freshness,
    },
  ].slice(-MAX_HISTORY_SAMPLES)

  return {
    ...history,
    [historyKey]: nextSamples,
  }
}
