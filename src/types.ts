import type {
  TelemetryMetric,
  TelemetryModuleSnapshot,
  TelemetrySnapshot,
} from './domain/telemetry/types'

export type DashboardModule = TelemetryModuleSnapshot
export type DashboardMetric = TelemetryMetric
export type DashboardSnapshot = TelemetrySnapshot
export type TelemetryLoadStatus = 'loading' | 'ready' | 'error'

export interface InspectionAgent {
  id: string
  name: string
  task: string
  detail?: string
  role: 'engineer' | 'courier' | 'security' | 'admin'
  x: number
  y: number
  status: 'idle' | 'moving' | 'working'
}

export interface TelemetryHistorySample {
  moduleId: string
  metricId: string
  value: string
  numericValue: number
  updatedAt: string
  freshness: 'fresh' | 'stale'
}

export interface UseTelemetryResult {
  snapshot: DashboardSnapshot
  history: Record<string, TelemetryHistorySample[]>
  status: TelemetryLoadStatus
  error: string | null
}
