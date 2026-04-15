import React, { useState } from 'react'
import { Activity, AlertTriangle, Terminal, Zap } from 'lucide-react'
import { useLlmRuntime } from '../hooks/useLlmRuntime'
import { useTelemetry } from '../hooks/useTelemetry'
import { createDashboardViewModel } from '../lib/telemetryViewModels'
import type { DashboardModule } from '../types'
import { LlmRuntimePanel } from './LlmRuntimePanel'
import { MetricsPanel } from './MetricsPanel'
import { ServerRoom } from './ServerRoom'

export const Dashboard: React.FC = () => {
  const telemetryResult = useTelemetry()
  const llmRuntimeResult = useLlmRuntime()
  const history = telemetryResult.history ?? {}
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const viewModel = createDashboardViewModel(telemetryResult, selectedModuleId)
  const {
    selectedModule,
    overview,
    snapshotStateLabel,
    telemetryStatusClass,
    summaryStatusClass,
    logLines,
    helperStatus,
    status,
    error,
  } = viewModel
  const { snapshot, startHelper, stopHelper } = telemetryResult

  function handleSelectModule(module: DashboardModule) {
    setSelectedModuleId(module.id)
  }

  return (
    <div className="relative w-screen h-screen bg-[#030508] text-white font-sans overflow-hidden">
      <ServerRoom
        modules={snapshot.modules}
        onSelectModule={handleSelectModule}
        selectedModuleId={selectedModuleId}
      />

      <header className="absolute top-6 left-6 right-6 glass-panel rounded-2xl p-4 flex justify-between items-center z-50 gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-xl border border-cyan-400/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Zap className="text-cyan-400" size={28} />
          </div>
          <div>
            <h1 className="text-3xl text-cyan-300 font-tech tracking-widest font-bold">原生遥测舱</h1>
            <p className="text-sm text-cyan-600/80 font-tech tracking-widest uppercase">真实宿主遥测</p>
          </div>
        </div>

        <div className="flex space-x-12 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">运行环境</span>
            <span className="text-2xl font-mono text-cyan-300">{overview.runtimeLabel}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">遥测状态</span>
            <span className={`text-2xl font-mono ${telemetryStatusClass}`}>
              {status === 'error' ? '加载失败' : status === 'loading' ? '加载中' : overview.statusLabel}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-cyan-600/80 font-tech tracking-widest uppercase text-xs">可见模块</span>
            <span className="text-2xl font-mono text-cyan-300">{overview.moduleCountLabel}</span>
          </div>
        </div>
      </header>

      <div className="absolute left-6 top-32 bottom-6 w-80 glass-panel rounded-2xl p-6 flex flex-col z-50">
        <h2 className="text-xl mb-6 text-cyan-400 font-tech tracking-widest flex items-center space-x-2">
          <Activity size={20} />
          <span>遥测总览</span>
        </h2>

        <div className="space-y-6 flex-1">
          {helperStatus && snapshot.runtime.kind === 'tauri' ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-50">
              <div className="text-xs uppercase tracking-[0.25em] font-tech text-cyan-300">高权限宿主遥测</div>
              <div className="mt-2 text-sm leading-relaxed">{helperStatus.message}</div>
              <div className="mt-3 flex gap-2">
                {helperStatus.state !== 'running' ? (
                  <button
                    type="button"
                    onClick={() => void startHelper()}
                    className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-400/20"
                  >
                    启用高权限遥测
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void stopHelper()}
                    className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-400/20"
                  >
                    停止高权限遥测
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <div className="flex items-start space-x-3">
              <AlertTriangle size={18} className="mt-0.5 text-amber-300" />
              <div>
                <div className="text-xs uppercase tracking-[0.25em] font-tech text-amber-300">运行警告</div>
                <div className="mt-2 text-sm leading-relaxed">{overview.runtimeWarning}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech uppercase tracking-widest">当前模块</div>
            <div className="text-2xl font-mono text-cyan-300">{selectedModule?.name ?? '未选择'}</div>
          </div>

          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech uppercase tracking-widest">状态摘要</div>
            <div className={`text-3xl font-mono ${summaryStatusClass}`}>{overview.statusLabel}</div>
          </div>

          <div>
            <div className="text-xs text-cyan-500/80 mb-2 font-tech uppercase tracking-widest">快照状态</div>
            <div className="text-3xl font-mono text-purple-400">{snapshotStateLabel}</div>
          </div>

          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 text-fuchsia-50">
            <div className="text-xs uppercase tracking-[0.25em] font-tech text-fuchsia-300">LLM Runtime</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-fuchsia-100">{llmRuntimeResult.state.runtimeLabel}</div>
                <div className="text-xs text-fuchsia-200/70 font-mono break-all">{llmRuntimeResult.state.activeModelId ?? llmRuntimeResult.state.preferredModelId ?? '未配置模型'}</div>
              </div>
              <div className={`text-lg font-mono ${llmRuntimeResult.status === 'error' ? 'text-pink-300' : llmRuntimeResult.state.installationStatus === 'running' ? 'text-emerald-300' : llmRuntimeResult.state.installationStatus === 'installed' ? 'text-cyan-200' : 'text-gray-300'}`}>
                {llmRuntimeResult.status === 'loading'
                  ? '探测中'
                  : llmRuntimeResult.status === 'error'
                    ? '失败'
                    : llmRuntimeResult.state.installationStatus === 'running'
                      ? '运行中'
                      : llmRuntimeResult.state.installationStatus === 'installed'
                        ? '已安装'
                        : llmRuntimeResult.state.installationStatus === 'unhealthy'
                          ? '异常'
                          : '未安装'}
              </div>
            </div>
            <div className="mt-3 text-xs text-fuchsia-100/80 leading-relaxed">
              {llmRuntimeResult.error ?? llmRuntimeResult.state.warnings[0] ?? `Endpoint: ${llmRuntimeResult.state.endpoint}`}
            </div>
          </div>

          <div className="pt-6 border-t border-cyan-900/30 mt-auto">
            <h3 className="text-sm text-cyan-500 mb-3 font-tech tracking-widest flex items-center space-x-2">
              <Terminal size={14} />
              <span>遥测日志</span>
            </h3>
            <div className="bg-black/70 p-3 rounded-lg border border-cyan-800/70 text-xs text-cyan-300/80 font-mono h-56 overflow-hidden flex flex-col justify-end space-y-1 shadow-[inset_0_0_30px_rgba(34,211,238,0.08)]">
              <div className="opacity-45">&gt; 运行环境: {overview.runtimeLabel}</div>
              <div className="opacity-55">&gt; {overview.runtimeWarning}</div>
              <div className="opacity-65">&gt; 界面状态: {status === 'loading' ? '加载中' : status === 'error' ? '加载失败' : '就绪'}</div>
              {error ? <div className="opacity-90 text-pink-300">&gt; 错误: {error}</div> : null}
              {logLines.map((line, index) => (
                <div key={`${line}-${index}`} className={index >= logLines.length - 2 ? 'opacity-95 text-cyan-200' : 'opacity-75'}>
                  &gt; {line}
                </div>
              ))}
              <div className="border-t border-cyan-900/60 pt-2 text-[10px] uppercase tracking-[0.25em] text-cyan-400/60 font-tech">运行台持续汇报中</div>
              <div className="animate-pulse text-cyan-100">&gt; _</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-6 top-32 bottom-6 z-50 flex gap-4 pointer-events-none">
        <div className="pointer-events-auto h-full">
          <MetricsPanel
            module={selectedModule}
            history={selectedModule ? history[`${selectedModule.id}:primary`] ?? [] : []}
            helperMessage={helperStatus?.message ?? null}
            onStartHelper={startHelper}
          />
        </div>
        <div className="pointer-events-auto h-full">
          <LlmRuntimePanel runtime={llmRuntimeResult} />
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] z-40"></div>
    </div>
  )
}
