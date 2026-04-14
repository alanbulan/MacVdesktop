import { browserTelemetryModules } from './layout'
import type { TelemetrySnapshot } from './types'

export function createBrowserTelemetrySnapshot(): TelemetrySnapshot {
  return {
    runtime: {
      kind: 'browser',
    },
    modules: browserTelemetryModules.map((module) => ({
      ...module,
      primaryMetric: { ...module.primaryMetric },
      secondaryMetrics: module.secondaryMetrics.map((metric) => ({
        ...metric,
        metric: { ...metric.metric },
      })),
      alerts: module.alerts.map((alert) => ({ ...alert })),
    })),
  }
}
