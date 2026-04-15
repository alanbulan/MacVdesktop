export type LlmRuntimeKind = 'ollama' | 'llama_cpp'
export type LlmInstallationStatus = 'missing' | 'installed' | 'running' | 'unhealthy'
export type LlmRuntimeProfile = 'utility' | 'default' | 'quality'
export type LlmGpuOffloadMode = 'auto' | 'metal' | 'disabled'
export type LlmSmokeTestStatus = 'not_run' | 'passed' | 'failed'

export interface LlmRuntimeModel {
  id: string
  sizeLabel?: string | null
  digest?: string | null
  modifiedAt?: string | null
  family?: string | null
  parameterSize?: string | null
  quantization?: string | null
}

export interface LlmRunningModel {
  id: string
  sizeLabel?: string | null
  processor?: string | null
  until?: string | null
  contextLength?: number | null
  quantization?: string | null
}

export interface LlmSmokeTestRecord {
  status: LlmSmokeTestStatus
  latencyMs?: number | null
  updatedAt?: string | null
  preview?: string | null
  error?: string | null
}

export interface LlmRuntimeState {
  runtimeKind: LlmRuntimeKind
  installationStatus: LlmInstallationStatus
  runtimeLabel: string
  version?: string | null
  endpoint: string
  openaiBaseUrl: string
  lanOpenaiBaseUrl?: string | null
  lanNativeBaseUrl?: string | null
  apiKeyHint: string
  activeModelId?: string | null
  preferredModelId?: string | null
  profile: LlmRuntimeProfile
  modelFamily?: string | null
  modelClass: string
  quantization?: string | null
  contextLength: number
  keepAlive: string
  threads?: number | null
  gpuOffload: string
  managedByApp: boolean
  availableModels: LlmRuntimeModel[]
  runningModels: LlmRunningModel[]
  warnings: string[]
  lastError?: string | null
  lastSmokeTest: LlmSmokeTestRecord
}

export interface LlmRuntimeConfigInput {
  selectedRuntime: LlmRuntimeKind
  selectedProfile: LlmRuntimeProfile
  preferredModelId?: string | null
  endpoint: string
  contextLength: number
  keepAlive: string
  threads?: number | null
  gpuOffload: LlmGpuOffloadMode
  autostart: boolean
  localModelPath?: string | null
}

export interface LlmSmokeTestResult {
  status: LlmSmokeTestStatus
  latencyMs?: number | null
  updatedAt: string
  preview?: string | null
  error?: string | null
}
