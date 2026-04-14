import { afterEach, describe, expect, it } from 'vitest'
import { getRuntimeKind } from './runtime'

describe('getRuntimeKind', () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__
  })

  it('defaults to browser when Tauri globals are absent', () => {
    expect(getRuntimeKind()).toBe('browser')
  })

  it('returns tauri when Tauri globals are present', () => {
    window.__TAURI_INTERNALS__ = {}

    expect(getRuntimeKind()).toBe('tauri')
  })
})
