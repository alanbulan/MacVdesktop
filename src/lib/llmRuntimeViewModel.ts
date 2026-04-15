import type { LlmRuntimeState } from '../domain/llmRuntime/types'
import type { UseLlmRuntimeResult } from '../types'

export interface LlmRuntimeViewModel {
  title: string
  statusLabel: string
  statusClass: string
  runtimeLabel: string
  modelLabel: string
  versionLabel: string
  profileLabel: string
  detailRows: Array<{ label: string; value: string }>
  accessRows: Array<{ label: string; value: string }>
  warningLines: string[]
  smokeTestLabel: string
  smokeTestSummary: string
  actionLabel: string
  canStart: boolean
  canStop: boolean
  canPull: boolean
}

function getStatusLabel(state: LlmRuntimeState, loadStatus: UseLlmRuntimeResult['status']) {
  if (loadStatus === 'loading') {
    return '探测中'
  }

  if (loadStatus === 'error') {
    return '读取失败'
  }

  if (state.installationStatus === 'missing') {
    return '未安装'
  }

  if (state.installationStatus === 'installed') {
    return '已安装'
  }

  if (state.installationStatus === 'running') {
    return '运行中'
  }

  return '异常'
}

function getStatusClass(state: LlmRuntimeState, loadStatus: UseLlmRuntimeResult['status']) {
  if (loadStatus === 'loading') {
    return 'text-amber-300'
  }

  if (loadStatus === 'error') {
    return 'text-pink-400'
  }

  if (state.installationStatus === 'running') {
    return 'text-emerald-400'
  }

  if (state.installationStatus === 'installed') {
    return 'text-cyan-300'
  }

  return 'text-gray-300'
}

function getProfileLabel(modelClass: string) {
  if (modelClass === 'utility') {
    return '轻量档'
  }

  if (modelClass === 'quality') {
    return '质量档'
  }

  return '默认档'
}

function getModelLabel(state: LlmRuntimeState) {
  return state.activeModelId ?? state.preferredModelId ?? '未配置'
}

function getSmokeTestSummary(state: LlmRuntimeState) {
  if (state.lastSmokeTest.status === 'passed') {
    return state.lastSmokeTest.latencyMs ? `最近成功 · ${state.lastSmokeTest.latencyMs} ms` : '最近成功'
  }

  if (state.lastSmokeTest.status === 'failed') {
    return state.lastSmokeTest.error ?? '最近失败'
  }

  return '尚未运行'
}

export function createLlmRuntimeViewModel(result: UseLlmRuntimeResult): LlmRuntimeViewModel {
  const { state, status, error } = result
  const warningLines = [...state.warnings]

  if (error) {
    warningLines.unshift(error)
  }

  if (state.lastError) {
    warningLines.push(state.lastError)
  }

  return {
    title: 'LLM Runtime',
    statusLabel: getStatusLabel(state, status),
    statusClass: getStatusClass(state, status),
    runtimeLabel: state.runtimeLabel,
    modelLabel: getModelLabel(state),
    versionLabel: state.version ?? '未知版本',
    profileLabel: getProfileLabel(state.modelClass),
    detailRows: [
      { label: 'Endpoint', value: state.endpoint },
      { label: '量化', value: state.quantization ?? '未识别' },
      { label: 'Context', value: `${state.contextLength}` },
      { label: 'Keep Alive', value: state.keepAlive },
      { label: 'GPU Offload', value: state.gpuOffload },
      { label: '已发现模型', value: `${state.availableModels.length}` },
    ],
    accessRows: [
      { label: 'OpenAI Base URL', value: state.openaiBaseUrl },
      { label: '局域网 OpenAI', value: state.lanOpenaiBaseUrl ?? '当前不可用' },
      { label: '局域网 Native', value: state.lanNativeBaseUrl ?? '当前不可用' },
      { label: 'API Key', value: state.apiKeyHint },
      { label: 'Model ID', value: state.activeModelId ?? state.preferredModelId ?? '未配置' },
    ],
    warningLines,
    smokeTestLabel: state.lastSmokeTest.status === 'passed' ? 'Smoke Test 已通过' : 'Smoke Test',
    smokeTestSummary: getSmokeTestSummary(state),
    actionLabel: state.installationStatus === 'running' ? '停止 Runtime' : '启动 Runtime',
    canStart: state.installationStatus !== 'running',
    canStop: state.installationStatus === 'running',
    canPull: state.installationStatus !== 'missing',
  }
}
