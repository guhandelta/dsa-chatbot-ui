import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PALETTES, PALETTE_NAMES, THEME_STORAGE_KEY, applyChoice, applyMode, applyPalette, applyStoredChoice,
  clearPalette, contrastRatio, isPalette, readStoredChoice, systemPrefersDark, writeStoredChoice,
} from './theme'

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function resetDocument() {
  const root = document.documentElement
  root.removeAttribute('data-theme')
  root.removeAttribute('data-palette')
  root.className = ''
  root.removeAttribute('style')
}

describe('stored choice', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('defaults to auto when nothing is stored', () => {
    expect(readStoredChoice()).toBe('auto')
  })

  it('reads auto and each named palette', () => {
    for (const choice of ['auto', ...PALETTE_NAMES]) {
      localStorage.setItem(THEME_STORAGE_KEY, choice)
      expect(readStoredChoice()).toBe(choice)
    }
  })

  it('migrates the old light and dark values to the matching palettes', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readStoredChoice()).toBe('calm')
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredChoice()).toBe('focus')
  })

  it('ignores an unknown stored value and falls back to auto', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    expect(readStoredChoice()).toBe('auto')
  })

  it('remembers a written choice', () => {
    writeStoredChoice('warm')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('warm')
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readStoredChoice()).toBe('auto')
    expect(() => writeStoredChoice('calm')).not.toThrow()
  })

  it('recognises palette names only', () => {
    expect(isPalette('calm')).toBe(true)
    expect(isPalette('auto')).toBe(false)
    expect(isPalette(42)).toBe(false)
  })
})

describe('applyMode', () => {
  beforeEach(resetDocument)
  afterEach(() => { resetDocument(); vi.unstubAllGlobals() })

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

describe('palettes', () => {
  beforeEach(resetDocument)
  afterEach(() => { resetDocument(); vi.unstubAllGlobals() })

  it('applies the palette base, attribute and every palette color', () => {
    setSystemDark(false)
    applyPalette('focus')
    const root = document.documentElement
    expect(root.getAttribute('data-palette')).toBe('focus')
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.style.getPropertyValue('--bg-base')).toBe(PALETTES.focus.tokens['bg-base'])
    expect(root.style.getPropertyValue('--sea-ink')).toBe(PALETTES.focus.tokens['sea-ink'])
  })

  it('switching palettes replaces the colors rather than mixing them', () => {
    applyPalette('calm')
    applyPalette('warm')
    expect(document.documentElement.style.getPropertyValue('--bg-base')).toBe(PALETTES.warm.tokens['bg-base'])
    expect(document.documentElement.getAttribute('data-palette')).toBe('warm')
  })

  it('auto clears the palette and returns control to the stylesheet', () => {
    setSystemDark(false)
    applyPalette('energize')
    applyChoice('auto')
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--bg-base')).toBe('')
  })

  it('clearPalette removes the attribute and all custom colors', () => {
    applyPalette('calm')
    clearPalette()
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--lagoon')).toBe('')
  })

  it('applyChoice routes a palette to applyPalette', () => {
    applyChoice('calm')
    expect(document.documentElement.getAttribute('data-palette')).toBe('calm')
  })

  it('applyStoredChoice applies and returns the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(applyStoredChoice()).toBe('focus')
    expect(document.documentElement.getAttribute('data-palette')).toBe('focus')
    localStorage.clear()
  })
})

describe('palette definitions', () => {
  // Text colors must stay readable on the backgrounds they sit on. These are the
  // solid colors that text actually sits on; the translucent surfaces are close to them.
  const textPairs: Array<[keyof typeof PALETTES.calm.tokens, keyof typeof PALETTES.calm.tokens]> = [
    ['sea-ink', 'bg-base'], ['sea-ink', 'foam'], ['sea-ink', 'sand'],
    ['sea-ink-soft', 'bg-base'], ['sea-ink-soft', 'sand'],
    ['lagoon', 'bg-base'], ['kicker', 'bg-base'], ['palm', 'bg-base'],
    ['text-primary', 'bg-app'], ['text-primary', 'bg-surface'],
    ['text-muted', 'bg-app'], ['text-muted', 'bg-surface'],
    ['accent-calm', 'bg-surface'], ['accent-calm', 'accent-calm-subtle'],
    ['accent-energize', 'bg-app'], ['accent-energize', 'accent-subtle'],
  ]

  it.each(PALETTE_NAMES)('%s meets WCAG AA for body text (4.5:1) on every text pair', (name) => {
    const tokens = PALETTES[name].tokens
    for (const [text, background] of textPairs) {
      expect(contrastRatio(tokens[text], tokens[background]), `${name}: ${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(PALETTE_NAMES)('%s has a label, a light or dark base, and every token', (name) => {
    expect(PALETTES[name].label.length).toBeGreaterThan(0)
    expect(['light', 'dark']).toContain(PALETTES[name].base)
    expect(Object.keys(PALETTES[name].tokens)).toHaveLength(Object.keys(PALETTES.calm.tokens).length)
  })

  it('computes WCAG contrast correctly for known pairs', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})
