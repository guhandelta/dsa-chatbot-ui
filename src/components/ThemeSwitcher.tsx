import { useEffect, useId, useState, type ReactNode } from 'react'
import {
  applyChoice, applyStoredChoice, PALETTES, writeStoredChoice, type ThemeChoice,
} from '../lib/theme'

/**
 * One choice in the header: its value, the name shown on hover and to assistive
 * technology, a one-line description, and the icon that represents it.
 */
type ThemeOption = { choice: ThemeChoice; name: string; description: string; icon: ReactNode }

/** Shared SVG attributes: decorative (hidden from assistive technology), outlined, sized by the button's font. */
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

/**
 * The five choices, in header order: Auto first, then the four palettes.
 * Each palette's name and description come from PALETTES so they can't drift apart.
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    choice: 'auto',
    name: 'Auto',
    description: 'Follows your device setting',
    // A half-filled circle: one side light, one side dark.
    icon: (<svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>),
  },
  {
    choice: 'calm',
    name: PALETTES.calm.label,
    description: 'Light, teal: a quiet, open background',
    // A leaf.
    icon: (<svg {...svg}><path d="M4 20c0-9 5-14 16-16-1 11-6 16-14 16" /><path d="M4 20l8-8" /></svg>),
  },
  {
    choice: 'energize',
    name: PALETTES.energize.label,
    description: 'Light, orange: a brighter, lively background',
    // A lightning bolt.
    icon: (<svg {...svg}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>),
  },
  {
    choice: 'focus',
    name: PALETTES.focus.label,
    description: 'Dark, indigo: low glare for long sessions',
    // A target.
    icon: (<svg {...svg}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>),
  },
  {
    choice: 'warm',
    name: PALETTES.warm.label,
    description: 'Dark, amber: a soft, cozy background',
    // A flame.
    icon: (<svg {...svg}><path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-2 4-2 4-1-1-2-2-2-4-3 3-6 6-6 10a6 6 0 0 0 6 6z" /></svg>),
  },
]

/**
 * The header's theme control: five icon buttons, shared by every page. The current
 * choice is marked with aria-pressed. Each button shows its name as a tooltip on
 * hover and on keyboard focus, and the same name is its accessible label.
 */
export default function ThemeSwitcher() {
  const [choice, setChoice] = useState<ThemeChoice>('auto')
  const groupId = useId()

  // On mount, mirror the choice already applied at startup (see main.tsx).
  useEffect(() => {
    setChoice(applyStoredChoice())
  }, [])

  // In auto, follow live changes to the device setting.
  useEffect(() => {
    if (choice !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyChoice('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [choice])

  function choose(next: ThemeChoice) {
    setChoice(next)
    applyChoice(next)
    writeStoredChoice(next)
  }

  return (
    <div role="group" aria-labelledby={groupId} className="theme-switcher">
      <span id={groupId} className="sr-only">Color theme</span>
      {THEME_OPTIONS.map((option) => {
        const pressed = option.choice === choice
        return (
          <button
            key={option.choice}
            type="button"
            className="theme-switcher-btn"
            aria-pressed={pressed}
            aria-label={`${option.name} theme: ${option.description}`}
            title={option.name}
            onClick={() => choose(option.choice)}
          >
            {option.icon}
            <span role="tooltip" className="theme-switcher-tip">{option.name}</span>
          </button>
        )
      })}
    </div>
  )
}
