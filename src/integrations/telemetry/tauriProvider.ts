import { invoke } from '@tauri-apps/api/core'
import type { TelemetrySnapshot } from '../../domain/telemetry/types'
import type { TelemetryProvider } from './provider'

export interface TauriTelemetryProvider extends TelemetryProvider {
  getSnapshot: () => Promise<TelemetrySnapshot>
}

export function createTauriTelemetryProvider(): TauriTelemetryProvider {
  return {
    getSnapshot: async () => invoke<TelemetrySnapshot>('get_telemetry_snapshot'),
  }
}
