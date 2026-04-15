import { getModuleDetailLines, getTelemetryOverviewSummary } from '../domain/telemetry/summary'
import type { PrivilegedHelperStatus } from '../domain/telemetry/types'
import type { DashboardModule, DashboardSnapshot, UseTelemetryResult } from '../types'

export interface DashboardViewModel {
  overview: ReturnType<typeof getTelemetryOverviewSummary>
  snapshotStateLabel: string
  telemetryStatusClass: string
  summaryStatusClass: string
  logLines: string[]
  selectedModule: DashboardModule | null
  helperStatus: PrivilegedHelperStatus | null
  status: UseTelemetryResult['status']
  error: string | null
}

function getSnapshotStateLabel(snapshot: DashboardSnapshot, status: UseTelemetryResult['status'], overviewStatusLabel: string) {
  if (status === 'error') {
    return '快照加载失败'
  }

  if (status === 'loading') {
    return '快照加载中'
  }

  if (snapshot.runtime.kind === 'browser') {
    return '浏览器回退快照'
  }

  if (overviewStatusLabel === '实时遥测不可用') {
    return 'Tauri 占位快照'
  }

  return '宿主遥测快照'
}

function getTelemetryStatusClass(status: UseTelemetryResult['status'], isTelemetryUnavailable: boolean) {
  if (status === 'error') {
    return 'text-pink-400'
  }

  if (status === 'loading') {
    return 'text-amber-300'
  }

  if (isTelemetryUnavailable) {
    return 'text-gray-300'
  }

  return 'text-emerald-400'
}

export function createDashboardViewModel(result: UseTelemetryResult, selectedModuleId: string | null): DashboardViewModel {
  const selectedModule = result.snapshot.modules.find((module) => module.id === selectedModuleId) ?? null
  const overview = getTelemetryOverviewSummary(result.snapshot)
  const snapshotStateLabel = getSnapshotStateLabel(result.snapshot, result.status, overview.statusLabel)
  const isTelemetryUnavailable = overview.statusLabel === '实时遥测不可用'
  const logLines = selectedModule
    ? getModuleDetailLines(selectedModule)
    : [
        overview.selectedHint,
        overview.runtimeWarning,
        `快照状态: ${snapshotStateLabel}`,
        `当前可见模块: ${overview.moduleCountLabel}`,
        `系统汇报: ${overview.statusLabel}`,
      ]

  return {
    overview,
    snapshotStateLabel,
    telemetryStatusClass: getTelemetryStatusClass(result.status, isTelemetryUnavailable),
    summaryStatusClass: isTelemetryUnavailable ? 'text-gray-300' : 'text-emerald-400',
    logLines,
    selectedModule,
    helperStatus: result.helperStatus,
    status: result.status,
    error: result.error,
  }
}
