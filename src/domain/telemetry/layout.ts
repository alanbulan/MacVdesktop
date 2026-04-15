import type { TelemetryMetric, TelemetryModuleSnapshot } from './types'

function createUnavailableMetric(reason: string): TelemetryMetric {
  return {
    state: 'unavailable',
    source: 'browser-fallback',
    reason,
  }
}

const browserFallbackReason = '需要 Tauri 桌面宿主集成'

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
    primaryMetric: createUnavailableMetric(browserFallbackReason),
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

const telemetryClusterScaleConfig = {
  rackWidth: 124,
  rackHeight: 176,
  totalHorizontalReserve: 720,
  totalVerticalReserve: 180,
  minScale: 1,
  maxScale: 1.35,
} as const

export function calculateTelemetryClusterScale(viewportWidth: number, viewportHeight: number): number {
  const baseWidth = telemetryChamberLayout.spacing * telemetryChamberLayout.pixelUnit * 2 + telemetryClusterScaleConfig.rackWidth
  const baseHeight = telemetryChamberLayout.spacing * telemetryChamberLayout.pixelUnit * 2 + telemetryClusterScaleConfig.rackHeight

  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) {
    return telemetryClusterScaleConfig.minScale
  }

  const availableWidth = Math.max(viewportWidth - telemetryClusterScaleConfig.totalHorizontalReserve, baseWidth)
  const availableHeight = Math.max(viewportHeight - telemetryClusterScaleConfig.totalVerticalReserve, baseHeight)
  const scale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight)

  return Math.min(
    telemetryClusterScaleConfig.maxScale,
    Math.max(telemetryClusterScaleConfig.minScale, scale),
  )
}

export const browserTelemetryModules: ReadonlyArray<TelemetryModuleSnapshot> = [
  createUnavailableModule('cpu-cluster', 'CPU 簇', '需要 Tauri 桌面宿主才能提供实时处理器遥测。', 0, 0),
  createUnavailableModule('gpu-activity', 'GPU 活动', '需要 Tauri 桌面宿主才能提供实时 GPU 遥测。', 1, 0),
  createUnavailableModule('memory-pressure', '内存压力', '需要 Tauri 桌面宿主才能提供统一内存遥测。', 2, 0),
  createUnavailableModule('disk-usage', '磁盘占用', '需要 Tauri 桌面宿主才能提供存储遥测。', 0, 1),
  createUnavailableModule('network-throughput', '网络吞吐', '需要 Tauri 桌面宿主才能提供网络遥测。', 1, 1),
  createUnavailableModule('top-process', '高占用进程', '需要 Tauri 桌面宿主才能提供进程遥测。', 2, 1),
  createUnavailableModule('thermal-state', '热状态', '需要 Tauri 桌面宿主才能提供实时热状态遥测。', 0, 2),
  createUnavailableModule('fan-speed', '风扇转速', '需要 Tauri 桌面宿主才能提供风扇遥测。', 1, 2),
  createUnavailableModule('power-draw', '功耗', '需要 Tauri 桌面宿主才能提供功耗遥测。', 2, 2),
]
