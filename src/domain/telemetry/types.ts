export type TelemetryRuntimeKind = 'browser' | 'tauri'

export interface TelemetryRuntime {
  kind: TelemetryRuntimeKind
}

export type TelemetryMetricSource = 'browser-fallback' | 'tauri-host'
export type TelemetryMetricUnit = 'percent' | 'celsius' | 'watts' | 'rpm' | 'ghz' | 'count' | 'state'
export type TelemetryMetricFreshness = 'fresh' | 'stale' | 'unknown'

interface TelemetryMetricBase {
  source: TelemetryMetricSource
}

export interface TelemetryLiveMetric extends TelemetryMetricBase {
  state: 'live'
  value: string
  numericValue?: number
  unit?: TelemetryMetricUnit
  updatedAt: string
  freshness: Exclude<TelemetryMetricFreshness, 'unknown'>
}

export interface TelemetryLoadingMetric extends TelemetryMetricBase {
  state: 'loading'
  reason?: string
}

export interface TelemetryUnavailableMetric extends TelemetryMetricBase {
  state: 'unavailable'
  reason: string
}

export interface TelemetryErrorMetric extends TelemetryMetricBase {
  state: 'error'
  reason: string
  updatedAt?: string
  freshness?: TelemetryMetricFreshness
}

export type TelemetryMetric =
  | TelemetryLiveMetric
  | TelemetryLoadingMetric
  | TelemetryUnavailableMetric
  | TelemetryErrorMetric

export type TelemetryModuleStatus = 'healthy' | 'warning' | 'critical' | 'unavailable'

export interface TelemetrySecondaryMetric {
  id: string
  label: string
  metric: TelemetryMetric
}

export interface TelemetryAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export interface TelemetryModuleSnapshot {
  id: string
  name: string
  summary: string
  status: TelemetryModuleStatus
  x: number
  y: number
  primaryMetric: TelemetryMetric
  secondaryMetrics: TelemetrySecondaryMetric[]
  alerts: TelemetryAlert[]
}

export interface TelemetrySnapshot {
  runtime: TelemetryRuntime
  modules: TelemetryModuleSnapshot[]
}

export type PrivilegedHelperState = 'authorization_required' | 'starting' | 'running' | 'stale' | 'failed'

export interface PrivilegedHelperStatus {
  state: PrivilegedHelperState
  message: string
  updatedAt?: string
}
