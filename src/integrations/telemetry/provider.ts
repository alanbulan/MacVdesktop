import { createBrowserTelemetrySnapshot } from '../../domain/telemetry/browserSnapshot'
import type { PrivilegedHelperStatus, TelemetrySnapshot } from '../../domain/telemetry/types'
import { getRuntimeKind } from '../../lib/runtime'
import { createTauriTelemetryProvider } from './tauriProvider'

export interface TelemetryProvider {
  getSnapshot: () => Promise<TelemetrySnapshot>
  getHelperStatus: () => Promise<PrivilegedHelperStatus | null>
  startHelper: () => Promise<PrivilegedHelperStatus | null>
  stopHelper: () => Promise<PrivilegedHelperStatus | null>
}

export function createTelemetryProvider(): TelemetryProvider {
  if (getRuntimeKind() === 'tauri') {
    return createTauriTelemetryProvider()
  }

  return {
    getSnapshot: async () => createBrowserTelemetrySnapshot(),
    getHelperStatus: async () => null,
    startHelper: async () => null,
    stopHelper: async () => null,
  }
}
