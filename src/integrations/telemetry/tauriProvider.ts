import { invoke } from '@tauri-apps/api/core'
import type { PrivilegedHelperStatus, TelemetrySnapshot } from '../../domain/telemetry/types'
import type { TelemetryProvider } from './provider'

export interface TauriTelemetryProvider extends TelemetryProvider {
  getSnapshot: () => Promise<TelemetrySnapshot>
}

export function createTauriTelemetryProvider(): TauriTelemetryProvider {
  return {
    getSnapshot: async () => invoke<TelemetrySnapshot>('get_telemetry_snapshot'),
    getHelperStatus: async () => invoke<PrivilegedHelperStatus>('get_privileged_helper_status'),
    startHelper: async () => invoke<PrivilegedHelperStatus>('start_privileged_helper'),
    stopHelper: async () => invoke<PrivilegedHelperStatus>('stop_privileged_helper'),
  }
}
