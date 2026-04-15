import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseLlmRuntimeResult, UseTelemetryResult } from '../types'
import { calculateTelemetryClusterScale } from '../domain/telemetry/layout'
import { Dashboard } from './Dashboard'
import { ServerRoom } from './ServerRoom'

const mockUseTelemetry = vi.fn<() => UseTelemetryResult>()
const mockUseLlmRuntime = vi.fn<() => UseLlmRuntimeResult>()

function createTelemetryResult(overrides: Partial<UseTelemetryResult> = {}): UseTelemetryResult {
  return {
    snapshot: {
      runtime: { kind: 'browser' },
      modules: [],
    },
    history: {},
    status: 'ready',
    error: null,
    helperStatus: null,
    startHelper: async () => {},
    stopHelper: async () => {},
    ...overrides,
  }
}

function createLlmRuntimeResult(overrides: Partial<UseLlmRuntimeResult> = {}): UseLlmRuntimeResult {
  return {
    state: {
      runtimeKind: 'ollama',
      installationStatus: 'installed',
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
        status: 'not_run',
        latencyMs: null,
        updatedAt: null,
        preview: null,
        error: null,
      },
    },
    status: 'ready',
    error: null,
    refresh: async () => {},
    startRuntime: async () => {},
    stopRuntime: async () => {},
    pullModel: async () => {},
    runSmokeTest: async () => ({ status: 'passed', updatedAt: '123', latencyMs: 1, preview: '已连接', error: null }),
    ...overrides,
  }
}

vi.mock('../hooks/useTelemetry', () => ({
  useTelemetry: () => mockUseTelemetry(),
}))

vi.mock('../hooks/useLlmRuntime', () => ({
  useLlmRuntime: () => mockUseLlmRuntime(),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    mockUseTelemetry.mockReturnValue(createTelemetryResult())
    mockUseLlmRuntime.mockReturnValue(createLlmRuntimeResult())
  })

  it('uses Chinese browser-mode warning copy instead of fake telemetry status', () => {
    render(<Dashboard />)

    expect(screen.getAllByText(/浏览器开发模式/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/需要 Tauri 桌面宿主/i).length).toBeGreaterThan(0)
  })

  it('does not crash when the telemetry hook returns an undefined history object', () => {
    mockUseTelemetry.mockReturnValue(
      createTelemetryResult({
        history: undefined as unknown as UseTelemetryResult['history'],
        snapshot: {
          runtime: { kind: 'tauri' },
          modules: [
            {
              id: 'disk-usage',
              name: 'Disk Usage',
              summary: 'Host storage telemetry is live.',
              status: 'healthy',
              x: 0,
              y: 0,
              primaryMetric: {
                state: 'live',
                source: 'tauri-host',
                value: '61%',
                numericValue: 61,
                unit: 'percent',
                updatedAt: '123',
                freshness: 'fresh',
              },
              secondaryMetrics: [],
              alerts: [],
            },
          ],
        },
      }),
    )

    render(<Dashboard />)

    expect(screen.getAllByText('宿主遥测快照').length).toBeGreaterThan(0)
  })

  it('shows Chinese truthful loading snapshot labels', () => {
    mockUseTelemetry.mockReturnValue(
      createTelemetryResult({
        snapshot: {
          runtime: { kind: 'tauri' },
          modules: [
            {
              id: 'cpu-cluster',
              name: 'CPU Cluster',
              summary: '正在等待 Tauri 原生宿主遥测快照。',
              status: 'warning',
              x: 0,
              y: 0,
              primaryMetric: {
                state: 'loading',
                source: 'tauri-host',
                reason: '正在等待 Tauri 原生宿主遥测快照。',
              },
              secondaryMetrics: [],
              alerts: [],
            },
          ],
        },
        history: {},
        status: 'loading',
        error: null,
      }),
    )

    render(<Dashboard />)

    expect(screen.getAllByText('快照加载中').length).toBeGreaterThan(0)
    expect(screen.getAllByText('遥测加载中').length).toBeGreaterThan(0)
  })

  it('uses a Chinese product title', () => {
    render(<Dashboard />)

    expect(screen.getAllByText('原生遥测舱').length).toBeGreaterThan(0)
  })

  it('shows the local LLM runtime card and chosen model', () => {
    render(<Dashboard />)

    expect(screen.getAllByText('LLM Runtime').length).toBeGreaterThan(0)
    expect(screen.getAllByText('qwen3.5:4b-q4_K_M').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ollama').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Smoke Test/i).length).toBeGreaterThan(0)
  })

  it('keeps the center scene offset left to balance the added right panel', () => {
    const { container } = render(
      <ServerRoom
        modules={[]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    const shiftedScene = container.querySelector('[style*="margin-left: -140px"]') as HTMLDivElement | null
    expect(shiftedScene).toBeTruthy()
  })

  it('shows a truthful ready snapshot state label in Chinese', () => {
    render(<Dashboard />)

    expect(screen.getAllByText('浏览器回退快照').length).toBeGreaterThan(0)
  })

  it('shows a truthful error snapshot state label in Chinese', () => {
    mockUseTelemetry.mockReturnValue(createTelemetryResult({ status: 'error', error: 'Timed out' }))

    render(<Dashboard />)

    expect(screen.getAllByText('快照加载失败').length).toBeGreaterThan(0)
  })

  it('shows native host messaging in Chinese when live Tauri telemetry is available', () => {
    mockUseTelemetry.mockReturnValue(
      createTelemetryResult({
        snapshot: {
          runtime: { kind: 'tauri' },
          modules: [
            {
              id: 'cpu-cluster',
              name: 'CPU Cluster',
              summary: 'Host CPU usage sampled across 8 logical cores.',
              status: 'healthy',
              x: 0,
              y: 0,
              primaryMetric: {
                state: 'live',
                source: 'tauri-host',
                value: '42%',
                numericValue: 42,
                unit: 'percent',
                updatedAt: '123',
                freshness: 'fresh',
              },
              secondaryMetrics: [],
              alerts: [],
            },
          ],
        },
      }),
    )

    render(<Dashboard />)

    expect(screen.getAllByText(/Tauri 桌面壳层/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/宿主遥测正由桌面宿主提供/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('宿主遥测快照').length).toBeGreaterThan(0)
    expect(screen.getAllByText('运行台持续汇报中').length).toBeGreaterThan(0)
  })

  it('keeps unavailable tauri telemetry visually marked as unavailable instead of healthy', () => {
    mockUseTelemetry.mockReturnValue(
      createTelemetryResult({
        snapshot: {
          runtime: { kind: 'tauri' },
          modules: [
            {
              id: 'gpu-activity',
              name: 'GPU Activity',
              summary: 'GPU activity is unavailable.',
              status: 'unavailable',
              x: 0,
              y: 0,
              primaryMetric: {
                state: 'unavailable',
                source: 'tauri-host',
                reason: 'GPU activity telemetry requires a Metal counter collector.',
              },
              secondaryMetrics: [],
              alerts: [],
            },
          ],
        },
      }),
    )

    render(<Dashboard />)

    const unavailableLabels = screen.getAllByText('实时遥测不可用')

    expect(unavailableLabels.length).toBeGreaterThan(0)
    unavailableLabels.forEach((label) => {
      expect(label.className).toContain('text-gray-300')
    })
  })

  it('calculates a larger centered cluster scale for roomy fullscreen viewports', () => {
    expect(calculateTelemetryClusterScale(1600, 900)).toBeGreaterThan(1)
    expect(calculateTelemetryClusterScale(900, 700)).toBe(1)
  })

  it('renders animated inspection agents in the chamber view', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/巡检角色/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/计算中枢区 工厂区/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/工厂路径网络/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/计算中枢区 装配坞/i).length).toBeGreaterThan(0)
  })

  it('renders a richer center chamber scaffold without fake telemetry modules', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText('中央反应核心').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/能量连线/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/舱室粒子/i).length).toBeGreaterThan(0)
  })

  it('renders a stronger second-stage chamber scaffold', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/环形步道/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/扫描光束/i).length).toBeGreaterThan(0)
  })

  it('fills the center chamber with centered animated structural layers', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/纵深雾化层/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/核心支撑柱/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/舱室扫描网格/i).length).toBeGreaterThan(0)
  })

  it('fills the side and lower chamber gaps with structural props', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/左侧结构塔/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/右侧结构塔/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/下方维护平台/i).length).toBeGreaterThan(0)
  })

  it('adds a denser outer infrastructure ring around the chamber footprint', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/外环基座/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/弧形管廊/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/边缘框架/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/支撑桥/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/分段平台/i).length).toBeGreaterThan(0)
  })

  it('fills the far perimeter corners with anchor and corridor structures', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/角部锚点/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/外缘走廊/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/外围支撑臂/i).length).toBeGreaterThan(0)
  })

  it('adds a more architectural shell with wall spans and base decks around the chamber', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/上部墙体跨梁/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/侧壁基槽/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/底部总地基/i).length).toBeGreaterThan(0)
  })

  it('fills the inner empty perimeter with solid roof wall and base structures', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/内层顶棚块/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/内层侧壁块/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/内层底座块/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/顶部屋盖/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/侧壁承重仓/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/底部承重台/i).length).toBeGreaterThan(0)
  })

  it('adds larger centered fill layers for the chamber core footprint', () => {
    render(
      <ServerRoom
        modules={[
          {
            id: 'cpu-cluster',
            name: 'CPU Cluster',
            summary: 'Host CPU usage sampled across 8 logical cores.',
            status: 'healthy',
            x: 0,
            y: 0,
            primaryMetric: {
              state: 'live',
              source: 'tauri-host',
              value: '42%',
              numericValue: 42,
              unit: 'percent',
              updatedAt: '123',
              freshness: 'fresh',
            },
            secondaryMetrics: [],
            alerts: [],
          },
        ]}
        onSelectModule={() => {}}
        selectedModuleId={null}
      />,
    )

    expect(screen.getAllByLabelText(/中央承载地台/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/对角导流翼/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/轨道填充环/i).length).toBeGreaterThan(0)
  })

})
