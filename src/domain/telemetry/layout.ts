import type { TelemetryMetric, TelemetryModuleSnapshot } from './types'

function createUnavailableMetric(reason: string): TelemetryMetric {
  return {
    state: 'unavailable',
    source: 'browser-fallback',
    reason,
  }
}

function createUnavailableModule(
  id: string,
  name: string,
  summary: string,
  x: number,
  y: number,
): TelemetryModuleSnapshot {
  return {
    id,
    name,
    summary,
    status: 'unavailable',
    x,
    y,
    primaryMetric: createUnavailableMetric('Requires Tauri desktop host integration'),
    secondaryMetrics: [],
    alerts: [],
  }
}

export const telemetryChamberLayout = {
  anchorX: 9.25,
  anchorY: 9.6,
  spacing: 3.05,
  pixelUnit: 84,
} as const

export const browserTelemetryModules: ReadonlyArray<TelemetryModuleSnapshot> = [
  createUnavailableModule('cpu-cluster', 'CPU Cluster', 'Requires Tauri desktop host for live processor telemetry.', 0, 0),
  createUnavailableModule('gpu-activity', 'GPU Activity', 'Requires Tauri desktop host for live GPU telemetry.', 1, 0),
  createUnavailableModule('memory-pressure', 'Memory Pressure', 'Requires Tauri desktop host for unified memory telemetry.', 2, 0),
  createUnavailableModule('disk-usage', 'Disk Usage', 'Requires Tauri desktop host for storage telemetry.', 0, 1),
  createUnavailableModule('network-throughput', 'Network Throughput', 'Requires Tauri desktop host for network telemetry.', 1, 1),
  createUnavailableModule('top-process', 'Top Process', 'Requires Tauri desktop host for process telemetry.', 2, 1),
  createUnavailableModule('thermal-state', 'Thermal State', 'Requires Tauri desktop host for live thermal telemetry.', 0, 2),
  createUnavailableModule('fan-speed', 'Fan Speed', 'Requires Tauri desktop host for fan telemetry.', 1, 2),
  createUnavailableModule('power-draw', 'Power Draw', 'Requires Tauri desktop host for power telemetry.', 2, 2),
]
