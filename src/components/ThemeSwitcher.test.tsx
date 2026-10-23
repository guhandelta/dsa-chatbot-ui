import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSwitcher from './ThemeSwitcher'
import { THEME_STORAGE_KEY } from '../lib/theme'

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
  document.documentElement.className = ''
})

describe('ThemeSwitcher', () => {
  it('shows one labelled button per mode inside a named group', () => {
    render(<ThemeSwitcher />)
    expect(screen.getByRole('group', { name: 'Color theme' })).toBeTruthy()
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('title'))
    expect(names).toEqual(['Auto', 'Light', 'Dark'])
  })

  it('marks the current mode as pressed and switches on click', () => {
    render(<ThemeSwitcher />)
    const auto = screen.getByRole('button', { name: /^Auto theme/ })
    const dark = screen.getByRole('button', { name: /^Dark theme/ })
    expect(auto.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(dark)
    expect(dark.getAttribute('aria-pressed')).toBe('true')
    expect(auto.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('restores the stored mode on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    render(<ThemeSwitcher />)
    expect(screen.getByRole('button', { name: /^Light theme/ }).getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('follows live system changes only in auto', () => {
    render(<ThemeSwitcher />)
    systemDark = true
    listeners.forEach((fn) => fn())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Light theme/ }))
    expect(listeners.size).toBe(0)
  })

  it('shows the name as a tooltip element for each option', () => {
    render(<ThemeSwitcher />)
    const tips = Array.from(document.querySelectorAll('.theme-switcher-tip')).map((t) => t.textContent)
    expect(tips).toEqual(['Auto', 'Light', 'Dark'])
  })
})
