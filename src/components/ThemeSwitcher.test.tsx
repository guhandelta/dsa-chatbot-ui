import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSwitcher from './ThemeSwitcher'
import { THEME_STORAGE_KEY, PALETTES } from '../lib/theme'

let systemDark = false
const listeners = new Set<() => void>()

beforeEach(() => {
  localStorage.clear()
  systemDark = false
  listeners.clear()
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return systemDark },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-palette')
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
})

describe('ThemeSwitcher', () => {
  it('shows Auto and the four palettes inside a named group', () => {
    render(<ThemeSwitcher />)
    expect(screen.getByRole('group', { name: 'Color theme' })).toBeTruthy()
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('title'))
    expect(names).toEqual(['Auto', 'Calm', 'Energize', 'Focus', 'Warm'])
  })

  it('marks the current choice as pressed and applies a palette on click', () => {
    render(<ThemeSwitcher />)
    const auto = screen.getByRole('button', { name: /^Auto theme/ })
    const focus = screen.getByRole('button', { name: /^Focus theme/ })
    expect(auto.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(focus)
    expect(focus.getAttribute('aria-pressed')).toBe('true')
    expect(auto.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.getAttribute('data-palette')).toBe('focus')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('focus')
  })

  it('returns to auto and clears the palette', () => {
    render(<ThemeSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: /^Calm theme/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Auto theme/ }))
    expect(document.documentElement.hasAttribute('data-palette')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto')
  })

  it('restores the stored palette on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'energize')
    render(<ThemeSwitcher />)
    expect(screen.getByRole('button', { name: /^Energize theme/ }).getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.getAttribute('data-palette')).toBe('energize')
  })

  it('follows live system changes only in auto', () => {
    render(<ThemeSwitcher />)
    systemDark = true
    listeners.forEach((fn) => fn())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Warm theme/ }))
    expect(listeners.size).toBe(0)
  })

  it('shows each name as a tooltip element', () => {
    render(<ThemeSwitcher />)
    const tips = Array.from(document.querySelectorAll('.theme-switcher-tip')).map((t) => t.textContent)
    expect(tips).toEqual(['Auto', 'Calm', 'Energize', 'Focus', 'Warm'])
  })

  it('describes each palette with its own name and base', () => {
    render(<ThemeSwitcher />)
    expect(screen.getByRole('button', { name: /^Calm theme: Light, teal/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Warm theme: Dark, amber/ })).toBeTruthy()
    expect(PALETTES.calm.label).toBe('Calm')
  })
})
