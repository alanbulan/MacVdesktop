import type { TelemetryMetric, TelemetryModuleSnapshot, TelemetrySnapshot } from './types'

function formatFreshnessLabel(freshness: 'fresh' | 'stale'): string {
  return freshness === 'fresh' ? '实时' : '缓存'
}

function formatUpdatedAt(updatedAt: string): string {
  const asNumber = Number(updatedAt)

  if (!Number.isNaN(asNumber) && updatedAt.trim() !== '') {
    return new Date(asNumber * 1000).toLocaleString('zh-CN', { hour12: false })
  }

  const parsed = new Date(updatedAt)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('zh-CN', { hour12: false })
  }

  return updatedAt
}

export interface TelemetryOverviewSummary {
  runtimeLabel: string
  runtimeWarning: string
  moduleCountLabel: string
  statusLabel: string
  selectedHint: string
}

function formatMetricValue(metric: TelemetryMetric): string {
  if (metric.state === 'live') {
    return metric.value
  }

  if (metric.state === 'loading') {
    return '加载中'
  }

  if (metric.state === 'error') {
    return '错误'
  }

  return '不可用'
}

export function getTelemetryOverviewSummary(snapshot: TelemetrySnapshot): TelemetryOverviewSummary {
  const unavailableModuleCount = snapshot.modules.filter((module) => module.status === 'unavailable').length
  const loadingModuleCount = snapshot.modules.filter((module) => module.primaryMetric.state === 'loading').length
  const allUnavailable = unavailableModuleCount === snapshot.modules.length
  const allLoading = loadingModuleCount === snapshot.modules.length && snapshot.modules.length > 0
  const isBrowserRuntime = snapshot.runtime.kind === 'browser'

  return {
    runtimeLabel: isBrowserRuntime ? '浏览器开发模式' : 'Tauri 桌面壳层',
    runtimeWarning: isBrowserRuntime
      ? '需要 Tauri 桌面宿主才能提供实时遥测'
      : allLoading
        ? 'Tauri 壳层已启动，宿主遥测仍在加载中'
        : allUnavailable
          ? 'Tauri 壳层已启动，但宿主遥测采集仍不可用'
          : '宿主遥测正由桌面宿主提供',
    moduleCountLabel: `${snapshot.modules.length} 个遥测模块`,
    statusLabel: allLoading
      ? '遥测加载中'
      : allUnavailable
        ? '实时遥测不可用'
        : `${snapshot.modules.length - unavailableModuleCount} 个模块正在上报`,
    selectedHint: '请选择一个遥测模块以查看当前状态。',
  }
}

export function getModuleDetailLines(module: TelemetryModuleSnapshot): string[] {
  const detailLines = [module.summary]

  if (module.primaryMetric.state === 'live') {
    detailLines.push(`主指标: ${module.primaryMetric.value}`)
    detailLines.push(`主指标来源: ${module.primaryMetric.source}`)
    detailLines.push(`数据新鲜度: ${formatFreshnessLabel(module.primaryMetric.freshness)}`)
    detailLines.push(`最近更新: ${formatUpdatedAt(module.primaryMetric.updatedAt)}`)
  }

  if (module.primaryMetric.state === 'loading') {
    detailLines.push('主指标状态: 加载中')
    if (module.primaryMetric.reason) {
      detailLines.push(module.primaryMetric.reason)
    }
  }

  if (module.primaryMetric.state === 'unavailable') {
    detailLines.push('主指标状态: 不可用')
    detailLines.push(module.primaryMetric.reason)
  }

  if (module.primaryMetric.state === 'error') {
    detailLines.push('主指标状态: 错误')
    detailLines.push(module.primaryMetric.reason)
  }

  if (module.secondaryMetrics.length > 0) {
    detailLines.push(
      ...module.secondaryMetrics.map((metric) => {
        if (metric.metric.state === 'live') {
          const freshnessSuffix = metric.metric.freshness === 'stale' ? ' · 缓存' : ' · 实时'
          return `${metric.label}: ${metric.metric.value} · ${metric.metric.source}${freshnessSuffix}`
        }

        return `${metric.label}: ${formatMetricValue(metric.metric)} · ${metric.metric.source}`
      }),
    )
  } else {
    detailLines.push('次级遥测: 无')
  }

  if (module.alerts.length > 0) {
    detailLines.push(...module.alerts.map((alert) => `宿主告警: ${alert.message}`))
  } else {
    detailLines.push('宿主告警: 无')
  }

  return detailLines
}
