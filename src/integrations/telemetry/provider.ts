import { createBrowserTelemetrySnapshot } from '../../domain/telemetry/browserSnapshot'
import type { TelemetrySnapshot } from '../../domain/telemetry/types'
import { getRuntimeKind } from '../../lib/runtime'
import { createTauriTelemetryProvider } from './tauriProvider'

export interface TelemetryProvider {
  getSnapshot: () => Promise<TelemetrySnapshot>
}

export function createTelemetryProvider(): TelemetryProvider {
  if (getRuntimeKind() === 'tauri') {
    return createTauriTelemetryProvider()
  }

  return {
    getSnapshot: async () => createBrowserTelemetrySnapshot(),
  }
}
