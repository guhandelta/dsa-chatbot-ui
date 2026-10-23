import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, applyMode, readStoredMode, systemPrefersDark, writeStoredMode } from './theme'

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('theme storage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('defaults to auto when nothing is stored', () => {
    expect(readStoredMode()).toBe('auto')
  })

  it('reads each valid stored mode', () => {
    for (const mode of ['light', 'dark', 'auto'] as const) {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
      expect(readStoredMode()).toBe(mode)
    }
  })

  it('ignores an unknown stored value and falls back to auto', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    expect(readStoredMode()).toBe('auto')
  })

  it('remembers a written mode', () => {
    writeStoredMode('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readStoredMode()).toBe('auto')
    expect(() => writeStoredMode('light')).not.toThrow()
  })
})

describe('applyMode', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''
    vi.unstubAllGlobals()
  })

  it('sets the explicit mode on the document', () => {
    setSystemDark(false)
    expect(applyMode('dark')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('removes the attribute for auto and resolves to the system scheme', () => {
    setSystemDark(true)
    document.documentElement.setAttribute('data-theme', 'light')
    expect(applyMode('auto')).toBe('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('resolves auto to light when the system is light', () => {
    setSystemDark(false)
    expect(applyMode('auto')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('replaces the previous scheme class when the mode changes', () => {
    setSystemDark(false)
    applyMode('dark')
    applyMode('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('reports the system preference', () => {
    setSystemDark(true)
    expect(systemPrefersDark()).toBe(true)
    setSystemDark(false)
    expect(systemPrefersDark()).toBe(false)
  })
})
