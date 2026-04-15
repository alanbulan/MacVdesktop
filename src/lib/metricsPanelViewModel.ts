import { Activity, CircleAlert, Cpu, Info } from 'lucide-react'
import type React from 'react'
import type { TelemetryMetric } from '../domain/telemetry/types'
import type { DashboardModule } from '../types'

export interface MetricDisplay {
  label: string
  value: string
  description: string
  colorClass: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export interface MetricsPanelViewModel {
  primaryMetric: MetricDisplay
  secondaryMetrics: MetricDisplay[]
  statusLabel: string
}

function formatPrimaryMetric(metric: TelemetryMetric): MetricDisplay {
  if (metric.state === 'live') {
    return {
      label: '主指标',
      value: metric.value,
      description: metric.freshness === 'fresh' ? '真实宿主遥测读数' : '真实宿主遥测读数（缓存，可能已过期）',
      colorClass: 'text-cyan-300',
      icon: Activity,
    }
  }

  if (metric.state === 'loading') {
    return {
      label: '主指标',
      value: '加载中',
      description: metric.reason ?? '遥测加载中',
      colorClass: 'text-amber-300',
      icon: Activity,
    }
  }

  if (metric.state === 'error') {
    return {
      label: '主指标',
      value: '错误',
      description: metric.reason,
      colorClass: 'text-pink-400',
      icon: CircleAlert,
    }
  }

  return {
    label: '主指标',
    value: '不可用',
    description: metric.reason,
    colorClass: 'text-gray-300',
    icon: CircleAlert,
  }
}

function formatSecondaryMetric(metric: TelemetryMetric, label: string): MetricDisplay {
  if (metric.state === 'live') {
    return {
      label,
      value: metric.value,
      description: metric.freshness === 'stale' ? '来源：tauri-host（缓存样本）' : `来源：${metric.source}`,
      colorClass: 'text-cyan-300',
      icon: Activity,
    }
  }

  return {
    label,
    value: metric.state === 'error' ? '错误' : metric.state === 'loading' ? '加载中' : '不可用',
    description: 'reason' in metric && metric.reason ? metric.reason : `来源：${metric.source}`,
    colorClass: metric.state === 'error' ? 'text-pink-400' : metric.state === 'loading' ? 'text-amber-300' : 'text-gray-300',
    icon: metric.state === 'error' ? CircleAlert : metric.state === 'loading' ? Activity : Info,
  }
}

function formatStatusLabel(status: DashboardModule['status']) {
  if (status === 'healthy') {
    return '健康'
  }

  if (status === 'warning') {
    return '警告'
  }

  if (status === 'critical') {
    return '严重'
  }

  return '不可用'
}

export function createMetricsPanelViewModel(module: DashboardModule): MetricsPanelViewModel {
  return {
    primaryMetric: formatPrimaryMetric(module.primaryMetric),
    secondaryMetrics: module.secondaryMetrics.map((metric) => formatSecondaryMetric(metric.metric, metric.label)),
    statusLabel: formatStatusLabel(module.status),
  }
}

export const EmptyMetricsPanelIcon = Cpu
