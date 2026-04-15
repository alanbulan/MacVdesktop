import { useEffect, useState } from 'react'
import { createBrowserTelemetrySnapshot } from '../domain/telemetry/browserSnapshot'
import { appendMetricHistory } from '../domain/telemetry/history'
import type { TelemetrySnapshot } from '../domain/telemetry/types'
import { createTelemetryProvider } from '../integrations/telemetry/provider'
import { getRuntimeKind } from '../lib/runtime'
import type { UseTelemetryResult } from '../types'

const provider = createTelemetryProvider()

const TAURI_REFRESH_INTERVAL_MS = 4000

function createInitialSnapshot(): TelemetrySnapshot {
  if (getRuntimeKind() === 'browser') {
    return createBrowserTelemetrySnapshot()
  }

  const browserSnapshot = createBrowserTelemetrySnapshot()

  return {
    runtime: { kind: 'tauri' },
    modules: browserSnapshot.modules.map((module) => ({
      ...module,
      status: 'warning',
      summary: '正在等待 Tauri 原生宿主遥测快照。',
      primaryMetric: {
        state: 'loading',
        source: 'tauri-host',
        reason: '正在等待 Tauri 原生宿主遥测快照。',
      },
      secondaryMetrics: [],
      alerts: [],
    })),
  }
}

export function useTelemetry(): UseTelemetryResult {
  const initialSnapshot = createInitialSnapshot()
  const [result, setResult] = useState<UseTelemetryResult>({
    snapshot: initialSnapshot,
    history: {},
    status: initialSnapshot.runtime.kind === 'browser' ? 'ready' : 'loading',
    error: null,
    helperStatus: null,
    startHelper: async () => {},
    stopHelper: async () => {},
  })

  useEffect(() => {
    let cancelled = false
    let intervalId: number | null = null

    async function loadTelemetry() {
      try {
        const [snapshot, helperStatus] = await Promise.all([
          provider.getSnapshot(),
          provider.getHelperStatus(),
        ])

        if (cancelled) {
          return
        }

        setResult((currentResult) => {
          const nextHistory = snapshot.modules.reduce((history, module) => {
            return appendMetricHistory(history, module.id, 'primary', module.primaryMetric)
          }, currentResult.history)

          return {
            snapshot,
            history: nextHistory,
            status: 'ready',
            error: null,
            helperStatus,
            startHelper: currentResult.startHelper,
            stopHelper: currentResult.stopHelper,
          }
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : '遥测快照加载失败'

        setResult((currentResult) => ({
          snapshot: currentResult.snapshot,
          history: currentResult.history,
          status: 'error',
          error: message,
          helperStatus: currentResult.helperStatus,
          startHelper: currentResult.startHelper,
          stopHelper: currentResult.stopHelper,
        }))
      }
    }

    async function startHelper() {
      const helperStatus = await provider.startHelper()
      if (cancelled) {
        return
      }
      setResult((currentResult) => ({
        ...currentResult,
        helperStatus,
      }))
      await loadTelemetry()
    }

    async function stopHelper() {
      const helperStatus = await provider.stopHelper()
      if (cancelled) {
        return
      }
      setResult((currentResult) => ({
        ...currentResult,
        helperStatus,
      }))
      await loadTelemetry()
    }

    setResult((currentResult) => ({
      ...currentResult,
      startHelper,
      stopHelper,
    }))

    loadTelemetry()

    if (initialSnapshot.runtime.kind === 'tauri') {
      intervalId = window.setInterval(() => {
        void loadTelemetry()
      }, TAURI_REFRESH_INTERVAL_MS)
    }

    return () => {
      cancelled = true

      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [initialSnapshot.runtime.kind])

  return result
}
