import { useEffect, useId, useState, type ReactNode } from 'react'
import { applyMode, readStoredMode, writeStoredMode, type ThemeMode } from '../lib/theme'

/**
 * One choice the learner can make in the header: its stored value, the name shown
 * on hover and to assistive technology, and the icon that represents it.
 */
type ThemeOption = { mode: ThemeMode; name: string; description: string; icon: ReactNode }

/** Shared SVG attributes: decorative (aria-hidden), outlined, scaled by the button's font size. */
const svg = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

/** The three modes, in the order they appear in the header. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    mode: 'auto',
    name: 'Auto',
    description: 'Follows your device setting',
    // A half-filled circle: one side light, one side dark.
    icon: (<svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>),
  },
  {
    mode: 'light',
    name: 'Light',
    description: 'Light background',
    // A sun.
    icon: (<svg {...svg}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>),
  },
  {
    mode: 'dark',
    name: 'Dark',
    description: 'Dark background',
    // A crescent moon.
    icon: (<svg {...svg}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>),
  },
]

/**
 * The header's theme control: three icon buttons, one per mode. The current mode
 * is marked with aria-pressed. Each button shows its name as a tooltip on hover
 * and on keyboard focus, and sets the same name as its accessible label.
 */
export default function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const groupId = useId()

  // On mount, restore the stored choice before the first user interaction.
  useEffect(() => {
    const initial = readStoredMode()
    setMode(initial)
    applyMode(initial)
  }, [])

  // In auto, follow live changes to the device setting.
  useEffect(() => {
    if (mode !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyMode('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  function choose(next: ThemeMode) {
    setMode(next)
    applyMode(next)
    writeStoredMode(next)
  }

  return (
    <div role="group" aria-labelledby={groupId} className="theme-switcher">
      <span id={groupId} className="sr-only">Color theme</span>
      {THEME_OPTIONS.map((option) => {
        const pressed = option.mode === mode
        return (
          <button
            key={option.mode}
            type="button"
            className="theme-switcher-btn"
            aria-pressed={pressed}
            aria-label={`${option.name} theme: ${option.description}`}
            title={option.name}
            onClick={() => choose(option.mode)}
          >
            {option.icon}
            <span role="tooltip" className="theme-switcher-tip">{option.name}</span>
          </button>
        )
      })}
    </div>
  )
}
