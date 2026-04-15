import { invoke } from '@tauri-apps/api/core'
import type {
  LlmRuntimeConfigInput,
  LlmRuntimeState,
  LlmSmokeTestResult,
} from '../../domain/llmRuntime/types'
import type { LlmRuntimeProvider } from './provider'

export function createTauriLlmRuntimeProvider(): LlmRuntimeProvider {
  return {
    getState: async () => invoke<LlmRuntimeState>('get_llm_runtime_state'),
    refreshState: async () => invoke<LlmRuntimeState>('refresh_llm_runtime_state'),
    saveConfig: async (settings: LlmRuntimeConfigInput) => invoke<LlmRuntimeState>('save_llm_runtime_config', { settings }),
    startRuntime: async () => invoke<LlmRuntimeState>('start_llm_runtime'),
    stopRuntime: async () => invoke<LlmRuntimeState>('stop_llm_runtime'),
    pullModel: async () => invoke<LlmRuntimeState>('pull_llm_model'),
    runSmokeTest: async () => invoke<LlmSmokeTestResult>('run_llm_smoke_test'),
  }
}
