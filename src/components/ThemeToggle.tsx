import { useEffect, useState } from 'react'
import { applyMode, readStoredMode, systemPrefersDark, writeStoredMode, type ThemeMode } from '../lib/theme'

/** The order a click moves through the modes: light, dark, then auto. */
const NEXT_MODE: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'auto', auto: 'light' }

/**
 * A button that cycles through light, dark and auto. It shows the current mode
 * and announces the next one in its accessible name and tooltip.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('auto')

  // On mount, read the stored choice and apply it to the document.
  useEffect(() => {
    const initial = readStoredMode()
    setMode(initial)
    applyMode(initial)
  }, [])

  // While in auto, follow live changes to the system setting.
  useEffect(() => {
    if (mode !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyMode('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  function toggleMode() {
    const next = NEXT_MODE[mode]
    setMode(next)
    applyMode(next)
    writeStoredMode(next)
  }

  const label = mode === 'auto'
    ? `Theme mode: auto (system, currently ${systemPrefersDark() ? 'dark' : 'light'}). Click to switch to light mode.`
    : `Theme mode: ${mode}. Click to switch mode.`

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5"
    >
      {mode === 'auto' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
