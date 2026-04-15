import { describe, expect, it } from 'vitest'
import { createDashboardViewModel } from './telemetryViewModels'

const result = {
  snapshot: {
    runtime: { kind: 'tauri' as const },
    modules: [
      {
        id: 'cpu-cluster',
        name: 'CPU 簇',
        summary: 'CPU telemetry is live.',
        status: 'healthy' as const,
        x: 0,
        y: 0,
        primaryMetric: {
          state: 'live' as const,
          source: 'tauri-host' as const,
          value: '42%',
          numericValue: 42,
          unit: 'percent' as const,
          updatedAt: '123',
          freshness: 'fresh' as const,
        },
        secondaryMetrics: [],
        alerts: [],
      },
    ],
  },
  history: {},
  status: 'ready' as const,
  error: null,
  helperStatus: null,
  startHelper: async () => {},
  stopHelper: async () => {},
}

describe('telemetryViewModels', () => {
  it('derives dashboard view model fields from telemetry result', () => {
    const viewModel = createDashboardViewModel(result, 'cpu-cluster')

    expect(viewModel.selectedModule?.id).toBe('cpu-cluster')
    expect(viewModel.snapshotStateLabel).toBe('宿主遥测快照')
    expect(viewModel.telemetryStatusClass).toBe('text-emerald-400')
    expect(viewModel.logLines[0]).toContain('CPU telemetry is live.')
  })

  it('maps loading state to truthful snapshot status labels', () => {
    const loadingViewModel = createDashboardViewModel({
      ...result,
      status: 'loading',
      snapshot: {
        runtime: { kind: 'tauri' as const },
        modules: [
          {
            ...result.snapshot.modules[0],
            primaryMetric: {
              state: 'loading' as const,
              source: 'tauri-host' as const,
              reason: '正在等待快照',
            },
            status: 'warning' as const,
          },
        ],
      },
    }, null)

    expect(loadingViewModel.snapshotStateLabel).toBe('快照加载中')
    expect(loadingViewModel.overview.statusLabel).toBe('遥测加载中')
  })
})
