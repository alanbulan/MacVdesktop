import { useEffect, useState } from 'react'
import type { LlmRuntimeState, LlmSmokeTestResult } from '../domain/llmRuntime/types'
import { createLlmRuntimeProvider } from '../integrations/llmRuntime/provider'
import type { UseLlmRuntimeResult } from '../types'

const provider = createLlmRuntimeProvider()
const TAURI_REFRESH_INTERVAL_MS = 15000

function createInitialState(): LlmRuntimeState {
  return {
    runtimeKind: 'ollama',
    installationStatus: 'missing',
    runtimeLabel: 'Ollama',
    version: null,
    endpoint: 'http://127.0.0.1:11434',
    openaiBaseUrl: 'http://127.0.0.1:11434/v1',
    lanOpenaiBaseUrl: null,
    lanNativeBaseUrl: null,
    apiKeyHint: '等待 Tauri 宿主返回局域网接入信息。',
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
    warnings: ['正在等待本机 LLM runtime 状态。'],
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

export function useLlmRuntime(): UseLlmRuntimeResult {
  const [result, setResult] = useState<UseLlmRuntimeResult>({
    state: createInitialState(),
    status: 'loading',
    error: null,
    refresh: async () => {},
    startRuntime: async () => {},
    stopRuntime: async () => {},
    pullModel: async () => {},
    runSmokeTest: async () => ({
      status: 'failed',
      updatedAt: `${Date.now()}`,
      error: 'LLM runtime 尚未初始化。',
    }),
  })

  useEffect(() => {
    let cancelled = false
    let intervalId: number | null = null

    async function loadState() {
      try {
        const state = await provider.getState()
        if (cancelled) {
          return
        }

        setResult((current) => ({
          ...current,
          state,
          status: 'ready',
          error: null,
        }))
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'LLM runtime 状态加载失败'
        setResult((current) => ({
          ...current,
          status: 'error',
          error: message,
        }))
      }
    }

    async function refresh() {
      try {
        const state = await provider.refreshState()
        if (cancelled) {
          return
        }

        setResult((current) => ({
          ...current,
          state,
          status: 'ready',
          error: null,
        }))
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'LLM runtime 状态刷新失败'
        setResult((current) => ({
          ...current,
          status: 'error',
          error: message,
        }))
      }
    }

    async function updateState(action: () => Promise<LlmRuntimeState>) {
      const state = await action()
      if (cancelled) {
        return
      }

      setResult((current) => ({
        ...current,
        state,
        status: 'ready',
        error: null,
      }))
    }

    async function startRuntime() {
      await updateState(() => provider.startRuntime())
    }

    async function stopRuntime() {
      await updateState(() => provider.stopRuntime())
    }

    async function pullModel() {
      await updateState(() => provider.pullModel())
    }

    async function runSmokeTest(): Promise<LlmSmokeTestResult> {
      const smokeTest = await provider.runSmokeTest()
      if (cancelled) {
        return smokeTest
      }

      await refresh()
      return smokeTest
    }

    setResult((current) => ({
      ...current,
      refresh,
      startRuntime,
      stopRuntime,
      pullModel,
      runSmokeTest,
    }))

    void loadState()
    intervalId = window.setInterval(() => {
      void refresh()
    }, TAURI_REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  return result
}
