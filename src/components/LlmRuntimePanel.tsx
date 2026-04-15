import React from 'react'
import { Bot, Cpu, Play, RefreshCcw, Square, TestTubeDiagonal } from 'lucide-react'
import { createLlmRuntimeViewModel } from '../lib/llmRuntimeViewModel'
import type { UseLlmRuntimeResult } from '../types'

interface Props {
  runtime: UseLlmRuntimeResult
}

export const LlmRuntimePanel: React.FC<Props> = ({ runtime }) => {
  const viewModel = createLlmRuntimeViewModel(runtime)

  return (
    <div className="w-80 h-full glass-panel rounded-2xl p-6 flex flex-col text-white overflow-y-auto relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent"></div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.18)]">
          <Bot className="text-fuchsia-300" size={22} />
        </div>
        <div>
          <h2 className="text-2xl text-fuchsia-300 font-tech tracking-widest">{viewModel.title}</h2>
          <div className={`text-sm font-mono ${viewModel.statusClass}`}>{viewModel.statusLabel}</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-black/40 p-4 rounded-xl border border-fuchsia-900/50 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech">Runtime</div>
            <div className="mt-1 text-lg font-mono text-fuchsia-200">{viewModel.runtimeLabel}</div>
            <div className="text-xs text-gray-400">版本：{viewModel.versionLabel}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech">当前模型</div>
            <div className="mt-1 text-sm font-mono text-cyan-200 break-all">{viewModel.modelLabel}</div>
            <div className="text-xs text-gray-400">档位：{viewModel.profileLabel}</div>
          </div>
        </div>

        <div className="bg-black/40 p-4 rounded-xl border border-fuchsia-900/50 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech flex items-center gap-2">
            <Cpu size={14} />
            <span>运行参数</span>
          </div>
          {viewModel.detailRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-tech">{row.label}</div>
              <div className="text-sm text-right font-mono text-fuchsia-100 break-all">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-black/40 p-4 rounded-xl border border-fuchsia-900/50 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech">对外接入</div>
          {viewModel.accessRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-tech">{row.label}</div>
              <div className="text-sm text-right font-mono text-cyan-100 break-all max-w-[180px]">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-black/40 p-4 rounded-xl border border-fuchsia-900/50 space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech">{viewModel.smokeTestLabel}</div>
          <div className="text-sm text-cyan-100">{viewModel.smokeTestSummary}</div>
          {runtime.state.lastSmokeTest.preview ? (
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
              返回：{runtime.state.lastSmokeTest.preview}
            </div>
          ) : null}
        </div>

        <div className="bg-black/40 p-4 rounded-xl border border-fuchsia-900/50 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-400/80 font-tech">运行操作</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void runtime.refresh()}
              className="rounded-md border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20 flex items-center justify-center gap-2"
            >
              <RefreshCcw size={12} />
              刷新
            </button>
            {viewModel.canStart ? (
              <button
                type="button"
                onClick={() => void runtime.startRuntime()}
                className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-400/20 flex items-center justify-center gap-2"
              >
                <Play size={12} />
                启动
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runtime.stopRuntime()}
                className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-400/20 flex items-center justify-center gap-2"
              >
                <Square size={12} />
                停止
              </button>
            )}
            <button
              type="button"
              onClick={() => void runtime.pullModel()}
              disabled={!viewModel.canPull}
              className="rounded-md border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20 disabled:opacity-50"
            >
              拉取模型
            </button>
            <button
              type="button"
              onClick={() => void runtime.runSmokeTest()}
              className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-400/20 flex items-center justify-center gap-2"
            >
              <TestTubeDiagonal size={12} />
              Smoke Test
            </button>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-fuchsia-900/30">
          <div className="text-xs text-fuchsia-400/80 mb-3 font-tech tracking-widest uppercase">运行提示</div>
          <div className="bg-black/50 p-3 rounded-lg border border-fuchsia-900/50 text-[11px] text-fuchsia-200/70 font-mono space-y-1">
            {viewModel.warningLines.length > 0 ? (
              viewModel.warningLines.map((line, index) => (
                <div key={`${line}-${index}`} className={index === 0 ? 'text-fuchsia-100' : ''}>
                  &gt; {line}
                </div>
              ))
            ) : (
              <div>&gt; 当前未发现额外警告。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
