import React from 'react'
import { TelemetrySparkline } from './TelemetrySparkline'
import type { TelemetryMetric } from '../domain/telemetry/types'
import type { DashboardModule, TelemetryHistorySample } from '../types'
import { Activity, CircleAlert, Cpu, HardDrive, Info, Terminal } from 'lucide-react'

interface Props {
  module: DashboardModule | null
  history: TelemetryHistorySample[]
}

interface MetricDisplay {
  label: string
  value: string
  description: string
  colorClass: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

function formatPrimaryMetric(metric: TelemetryMetric): MetricDisplay {
  if (metric.state === 'live') {
    const value = metric.value
    const description = metric.freshness === 'fresh' ? '实时遥测读数' : '遥测数据可能已过期'

    return {
      label: '主指标',
      value,
      description,
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
      description: `来源：${metric.source}`,
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

export const MetricsPanel: React.FC<Props> = ({ module, history }) => {
  if (!module) {
    return (
      <div className="w-80 h-full glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
        <div className="w-24 h-24 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center mb-6 animate-[spin_10s_linear_infinite]">
          <div className="w-16 h-16 rounded-full border border-cyan-400/50 flex items-center justify-center animate-[spin_5s_linear_infinite_reverse]">
            <Cpu size={32} className="text-cyan-500/50 animate-pulse" />
          </div>
        </div>
        <p className="text-center tracking-widest text-sm font-tech">
          请在舱室视图中
          <br />
          选择一个遥测模块
          <br />
          查看真实状态
        </p>
      </div>
    )
  }

  const primaryMetric = formatPrimaryMetric(module.primaryMetric)
  const secondaryMetrics = module.secondaryMetrics.map((metric) =>
    formatSecondaryMetric(metric.metric, metric.label),
  )

  return (
    <div className="w-80 h-full glass-panel-active rounded-2xl p-6 flex flex-col text-white overflow-y-auto relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>

      <h2 className="text-2xl mb-2 text-cyan-300 font-tech tracking-widest">{module.name}</h2>

      <div className="flex items-center space-x-2 mb-8 text-sm font-tech tracking-wider">
        <span className="text-gray-400">当前状态：</span>
        <span className={module.status === 'healthy' ? 'text-cyan-400 text-glow' : module.status === 'warning' ? 'text-amber-300' : module.status === 'critical' ? 'text-pink-400' : 'text-gray-300'}>
          ● {module.status === 'healthy' ? '健康' : module.status === 'warning' ? '警告' : module.status === 'critical' ? '严重' : '不可用'}
        </span>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-xs text-cyan-500/80 mb-4 font-tech tracking-widest uppercase">主遥测</h3>
          <div className="bg-black/40 p-4 rounded-xl border border-cyan-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-xs tracking-widest text-gray-300 uppercase font-tech">
                <primaryMetric.icon size={14} className="opacity-70" />
                <span>{primaryMetric.label}</span>
              </div>
              <span className={`text-2xl font-mono ${primaryMetric.colorClass}`}>{primaryMetric.value}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{primaryMetric.description}</p>
            <TelemetrySparkline samples={history} label="主指标真实历史曲线" />
            {history.length >= 2 ? null : <div className="mt-3 text-xs text-gray-400">尚无足够真实数值样本。</div>}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-cyan-500/80 mb-4 font-tech tracking-widest uppercase">遥测摘要</h3>
          <div className="bg-black/40 p-4 rounded-xl border border-cyan-900/50 space-y-3 text-sm text-gray-300">
            <p>{module.summary}</p>
            {secondaryMetrics.length > 0 ? (
              secondaryMetrics.map((metric) => (
                <div key={`${module.id}-${metric.label}`} className="flex items-start justify-between gap-3 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-500/80 font-tech">{metric.label}</div>
                    <p className="mt-1 text-xs text-gray-400">{metric.description}</p>
                  </div>
                  <div className={`font-mono ${metric.colorClass}`}>{metric.value}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">该模块暂无可用的次级遥测指标。</div>
            )}
            {module.alerts.length > 0 ? (
              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-500/80 font-tech">宿主告警</div>
                {module.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-md border px-3 py-2 text-xs ${alert.severity === 'critical' ? 'border-pink-500/40 text-pink-300' : alert.severity === 'warning' ? 'border-amber-400/40 text-amber-200' : 'border-cyan-500/30 text-cyan-200'}`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-cyan-900/30">
          <h3 className="text-xs text-cyan-500/80 mb-3 font-tech tracking-widest uppercase flex items-center space-x-2">
            <Terminal size={14} />
            <span>遥测备注</span>
          </h3>
          <div className="bg-black/50 p-3 rounded-lg border border-cyan-900/50 text-[11px] text-cyan-400/70 font-mono h-32 overflow-hidden flex flex-col justify-end space-y-1">
            <div className="opacity-50">&gt; 已选择模块：{module.name}</div>
            <div className="opacity-70">&gt; 上报状态：{module.status === 'healthy' ? '健康' : module.status === 'warning' ? '警告' : module.status === 'critical' ? '严重' : '不可用'}</div>
            <div className="opacity-80">&gt; 主指标：{primaryMetric.value}</div>
            <div className="opacity-90 text-cyan-300">&gt; {primaryMetric.description}</div>
            <div className="animate-pulse text-cyan-200">&gt; _</div>
          </div>
        </div>
      </div>
    </div>
  )
}
