export type RuntimeKind = 'browser' | 'tauri'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export function getRuntimeKind(): RuntimeKind {
  if (typeof window === 'undefined') {
    return 'browser'
  }

  const tauriInternals = window.__TAURI_INTERNALS__

  return tauriInternals && typeof tauriInternals === 'object' ? 'tauri' : 'browser'
}
