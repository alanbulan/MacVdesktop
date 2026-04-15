import type {
  LlmRuntimeConfigInput,
  LlmRuntimeState,
  LlmSmokeTestResult,
} from '../../domain/llmRuntime/types'
import { getRuntimeKind } from '../../lib/runtime'
import { createTauriLlmRuntimeProvider } from './tauriProvider'

export interface LlmRuntimeProvider {
  getState: () => Promise<LlmRuntimeState>
  refreshState: () => Promise<LlmRuntimeState>
  saveConfig: (settings: LlmRuntimeConfigInput) => Promise<LlmRuntimeState>
  startRuntime: () => Promise<LlmRuntimeState>
  stopRuntime: () => Promise<LlmRuntimeState>
  pullModel: () => Promise<LlmRuntimeState>
  runSmokeTest: () => Promise<LlmSmokeTestResult>
}

function createBrowserFallbackState(): LlmRuntimeState {
  return {
    runtimeKind: 'ollama',
    installationStatus: 'missing',
    runtimeLabel: 'Ollama',
    version: null,
    endpoint: 'http://127.0.0.1:11434',
    openaiBaseUrl: 'http://127.0.0.1:11434/v1',
    lanOpenaiBaseUrl: null,
    lanNativeBaseUrl: null,
    apiKeyHint: '浏览器模式下仅提供占位说明，当前没有可校验的 API key。',
    activeModelId: null,
    preferredModelId: 'qwen3.5:4b-q4_K_M',
    profile: 'default',
    modelFamily: null,
    modelClass: 'default',
    quantization: null,
    contextLength: 4096,
    keepAlive: '5m',
    threads: null,
    gpuOffload: 'auto',
    managedByApp: false,
    availableModels: [],
    runningModels: [],
    warnings: ['浏览器模式下无法直接探测本机 LLM runtime，需要 Tauri 桌面宿主。'],
    lastError: null,
    lastSmokeTest: {
      status: 'not_run',
      latencyMs: null,
      updatedAt: null,
      preview: null,
      error: null,
    },
  }
}

export function createLlmRuntimeProvider(): LlmRuntimeProvider {
  if (getRuntimeKind() === 'tauri') {
    return createTauriLlmRuntimeProvider()
  }

  return {
    getState: async () => createBrowserFallbackState(),
    refreshState: async () => createBrowserFallbackState(),
    saveConfig: async (_settings: LlmRuntimeConfigInput) => createBrowserFallbackState(),
    startRuntime: async () => createBrowserFallbackState(),
    stopRuntime: async () => createBrowserFallbackState(),
    pullModel: async () => createBrowserFallbackState(),
    runSmokeTest: async () => ({
      status: 'failed',
      latencyMs: null,
      updatedAt: `${Date.now()}`,
      preview: null,
      error: '浏览器模式下无法运行本机 LLM smoke test。',
    }),
  }
}
