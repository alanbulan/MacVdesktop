import { describe, expect, it } from 'vitest'
import { createLlmRuntimeViewModel } from './llmRuntimeViewModel'
import type { UseLlmRuntimeResult } from '../types'

function createRuntimeResult(overrides: Partial<UseLlmRuntimeResult> = {}): UseLlmRuntimeResult {
  return {
    state: {
      runtimeKind: 'ollama',
      installationStatus: 'running',
      runtimeLabel: 'Ollama',
      version: '0.20.7',
      endpoint: 'http://127.0.0.1:11434',
      openaiBaseUrl: 'http://127.0.0.1:11434/v1',
      lanOpenaiBaseUrl: 'http://192.168.12.98:11434/v1',
      lanNativeBaseUrl: 'http://192.168.12.98:11434',
      apiKeyHint: 'sk-local-ollama',
      activeModelId: 'qwen3.5:4b-q4_K_M',
      preferredModelId: 'qwen3.5:4b-q4_K_M',
      profile: 'default',
      modelFamily: 'qwen3',
      modelClass: 'default',
      quantization: 'Q4_K_M',
      contextLength: 4096,
      keepAlive: '5m',
      threads: null,
      gpuOffload: 'auto',
      managedByApp: false,
      availableModels: [],
      runningModels: [],
      warnings: [],
      lastError: null,
      lastSmokeTest: {
        status: 'passed',
        latencyMs: 320,
        updatedAt: '123',
        preview: '已连接',
        error: null,
      },
    },
    status: 'ready',
    error: null,
    refresh: async () => {},
    startRuntime: async () => {},
    stopRuntime: async () => {},
    pullModel: async () => {},
    runSmokeTest: async () => ({ status: 'passed', updatedAt: '123', latencyMs: 320, preview: '已连接', error: null }),
    ...overrides,
  }
}

describe('llmRuntimeViewModel', () => {
  it('marks a running runtime as healthy and shows the smoke test latency', () => {
    const viewModel = createLlmRuntimeViewModel(createRuntimeResult())

    expect(viewModel.statusLabel).toBe('运行中')
    expect(viewModel.statusClass).toContain('text-emerald-400')
    expect(viewModel.smokeTestSummary).toContain('320 ms')
  })

  it('surfaces loading and warning states truthfully', () => {
    const viewModel = createLlmRuntimeViewModel(
      createRuntimeResult({
        status: 'loading',
        state: {
          ...createRuntimeResult().state,
          installationStatus: 'missing',
          warnings: ['浏览器模式下无法直接探测本机 LLM runtime，需要 Tauri 桌面宿主。'],
        },
      }),
    )

    expect(viewModel.statusLabel).toBe('探测中')
    expect(viewModel.warningLines[0]).toContain('浏览器模式')
  })
})
