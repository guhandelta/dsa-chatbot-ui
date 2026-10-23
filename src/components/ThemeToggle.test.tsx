import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'
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

describe('ThemeToggle', () => {
  it('starts in auto and cycles light, dark, auto, storing each choice', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button.textContent).toBe('Auto')

    fireEvent.click(button)
    expect(button.textContent).toBe('Light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    fireEvent.click(button)
    expect(button.textContent).toBe('Dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    fireEvent.click(button)
    expect(button.textContent).toBe('Auto')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('restores the stored mode on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    render(<ThemeToggle />)
    expect(screen.getByRole('button').textContent).toBe('Dark')
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Theme mode: dark. Click to switch mode.')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('follows a live system change while in auto', () => {
    render(<ThemeToggle />)
    systemDark = true
    listeners.forEach((fn) => fn())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('stops following the system once a fixed mode is chosen', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    render(<ThemeToggle />)
    expect(listeners.size).toBe(0)
  })

  it('names the current mode and the next one for assistive tech', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('auto (system, currently light)')
  })

  it('says when the system is currently dark', () => {
    systemDark = true
    render(<ThemeToggle />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('currently dark')
  })
})
