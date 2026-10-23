/**
 * Theme handling for the whole app.
 *
 * A learner picks one of five choices:
 *  - `auto`: follow the device's light or dark setting (the stylesheet's own rules)
 *  - four named palettes, each with its own colors and a fixed light or dark base:
 *      `calm` (light, teal), `energize` (light, orange), `focus` (dark, indigo), `warm` (dark, amber)
 *
 * A palette sets the stylesheet's `data-theme` (light or dark, so component rules
 * still apply), a `data-palette` attribute, and the palette's color variables as
 * inline custom properties on the document element. Auto clears all of them.
 *
 * The choice is stored in localStorage under `THEME_STORAGE_KEY`, so it applies to
 * this browser only. Storage from the earlier light/dark toggle is migrated:
 * `light` becomes `calm` and `dark` becomes `focus`. Any other stored value falls
 * back to `auto`, so an old or corrupted value never breaks the page.
 */

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Palette = 'calm' | 'energize' | 'focus' | 'warm'
export type ThemeChoice = 'auto' | Palette

export const THEME_STORAGE_KEY = 'theme'

/** The colors a palette sets. Each key is a stylesheet custom property name without the leading `--`. */
export type PaletteTokens = Record<
  | 'sea-ink' | 'sea-ink-soft' | 'lagoon' | 'lagoon-deep' | 'palm' | 'sand' | 'foam'
  | 'surface' | 'surface-strong' | 'line' | 'inset-glint' | 'kicker' | 'bg-base' | 'header-bg'
  | 'chip-bg' | 'chip-line' | 'link-bg-hover' | 'hero-a' | 'hero-b',
  string
>

export type PaletteDefinition = {
  /** Name shown on hover and to assistive technology. */
  label: string
  /** Whether the palette uses the stylesheet's light or dark rules. */
  base: 'light' | 'dark'
  tokens: PaletteTokens
}

/**
 * The four palettes. Text pairs are checked for WCAG AA in theme.test.ts:
 * body text at 4.5:1 or better, large text at 3:1 or better.
 */
export const PALETTES: Record<Palette, PaletteDefinition> = {
  calm: {
    label: 'Calm',
    base: 'light',
    tokens: {
      'sea-ink': '#1F3A3D', 'sea-ink-soft': '#4B6568', lagoon: '#1F6F78', 'lagoon-deep': '#155A62',
      palm: '#1F6F78', sand: '#E3EFEC', foam: '#F8FBFA', surface: 'rgba(255, 255, 255, 0.82)',
      'surface-strong': 'rgba(255, 255, 255, 0.94)', line: 'rgba(31, 58, 61, 0.16)',
      'inset-glint': 'rgba(255, 255, 255, 0.85)', kicker: '#1F6F78', 'bg-base': '#F4F8F7',
      'header-bg': 'rgba(244, 248, 247, 0.92)', 'chip-bg': 'rgba(255, 255, 255, 0.86)',
      'chip-line': 'rgba(31, 111, 120, 0.24)', 'link-bg-hover': 'rgba(255, 255, 255, 0.95)',
      'hero-a': 'rgba(31, 111, 120, 0.18)', 'hero-b': 'rgba(31, 111, 120, 0.08)',
    },
  },
  energize: {
    label: 'Energize',
    base: 'light',
    tokens: {
      'sea-ink': '#2B1B10', 'sea-ink-soft': '#5C4330', lagoon: '#B64A00', 'lagoon-deep': '#8F3A00',
      palm: '#9A4300', sand: '#F7EBDD', foam: '#FFFBF6', surface: 'rgba(255, 255, 255, 0.84)',
      'surface-strong': 'rgba(255, 255, 255, 0.95)', line: 'rgba(43, 27, 16, 0.16)',
      'inset-glint': 'rgba(255, 255, 255, 0.85)', kicker: '#8F3A00', 'bg-base': '#FFF8F0',
      'header-bg': 'rgba(255, 248, 240, 0.92)', 'chip-bg': 'rgba(255, 255, 255, 0.88)',
      'chip-line': 'rgba(182, 74, 0, 0.26)', 'link-bg-hover': 'rgba(255, 255, 255, 0.95)',
      'hero-a': 'rgba(182, 74, 0, 0.14)', 'hero-b': 'rgba(182, 74, 0, 0.06)',
    },
  },
  focus: {
    label: 'Focus',
    base: 'dark',
    tokens: {
      'sea-ink': '#E8ECF4', 'sea-ink-soft': '#B5BDCF', lagoon: '#8FA8FF', 'lagoon-deep': '#A9BDFF',
      palm: '#9FB8FF', sand: '#151A26', foam: '#1E2433', surface: 'rgba(37, 43, 59, 0.86)',
      'surface-strong': 'rgba(37, 43, 59, 0.95)', line: 'rgba(143, 168, 255, 0.2)',
      'inset-glint': 'rgba(255, 255, 255, 0.08)', kicker: '#C9D5FF', 'bg-base': '#1B1F2A',
      'header-bg': 'rgba(27, 31, 42, 0.92)', 'chip-bg': 'rgba(37, 43, 59, 0.9)',
      'chip-line': 'rgba(143, 168, 255, 0.3)', 'link-bg-hover': 'rgba(47, 55, 74, 0.9)',
      'hero-a': 'rgba(143, 168, 255, 0.16)', 'hero-b': 'rgba(143, 168, 255, 0.08)',
    },
  },
  warm: {
    label: 'Warm',
    base: 'dark',
    tokens: {
      'sea-ink': '#F5EBDD', 'sea-ink-soft': '#D2BFA8', lagoon: '#E0B36B', 'lagoon-deep': '#F0CC8C',
      palm: '#E8C48F', sand: '#241D18', foam: '#2F261F', surface: 'rgba(56, 46, 38, 0.86)',
      'surface-strong': 'rgba(56, 46, 38, 0.95)', line: 'rgba(224, 179, 107, 0.2)',
      'inset-glint': 'rgba(255, 240, 220, 0.08)', kicker: '#F0D2A0', 'bg-base': '#2A211B',
      'header-bg': 'rgba(42, 33, 27, 0.92)', 'chip-bg': 'rgba(56, 46, 38, 0.9)',
      'chip-line': 'rgba(224, 179, 107, 0.3)', 'link-bg-hover': 'rgba(70, 58, 48, 0.9)',
      'hero-a': 'rgba(224, 179, 107, 0.15)', 'hero-b': 'rgba(224, 179, 107, 0.07)',
    },
  },
}

export const PALETTE_NAMES = Object.keys(PALETTES) as Palette[]

/** Whether a value is one of the named palettes. */
export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTE_NAMES as string[]).includes(value)
}

/** Reads the stored choice. Migrates the old light/dark values and falls back to auto. */
export function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light') return 'calm'
    if (stored === 'dark') return 'focus'
    if (stored === 'auto' || isPalette(stored)) return stored
    return 'auto'
  } catch {
    // Storage can be blocked (private mode, disabled cookies). Fall back quietly.
    return 'auto'
  }
}

/** Saves the choice. Blocked or full storage must never stop the theme changing. */
export function writeStoredChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // The theme still applies for this page visit; it just is not remembered.
  }
}

/** Whether the operating system asks for a dark interface. */
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies a light, dark or auto mode and returns the scheme actually shown.
 * Auto resolves to the system setting. Clears any palette attribute and colors.
 */
export function applyMode(mode: ThemeMode): 'light' | 'dark' {
  clearPalette()
  const resolved = mode === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : mode
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  if (mode === 'auto') {
    // No attribute means the stylesheet's own system-preference rules decide.
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
  root.style.colorScheme = resolved
  return resolved
}

/** Removes the palette attribute and every palette color. */
export function clearPalette(): void {
  const root = document.documentElement
  root.removeAttribute('data-palette')
  for (const name of PALETTE_TOKEN_NAMES) root.style.removeProperty(`--${name}`)
}

const PALETTE_TOKEN_NAMES = Object.keys(PALETTES.calm.tokens) as (keyof PaletteTokens)[]

/**
 * Applies a named palette: its light or dark base, the palette attribute, and each
 * of its colors as an inline custom property (these override the stylesheet).
 */
export function applyPalette(palette: Palette): void {
  const definition = PALETTES[palette]
  applyMode(definition.base)
  const root = document.documentElement
  root.setAttribute('data-palette', palette)
  for (const name of PALETTE_TOKEN_NAMES) root.style.setProperty(`--${name}`, definition.tokens[name])
}

/** Applies any choice: auto, or a named palette. */
export function applyChoice(choice: ThemeChoice): void {
  if (choice === 'auto') applyMode('auto')
  else applyPalette(choice)
}

/** Applies the learner's stored choice. Call once before the first render to avoid a flash. */
export function applyStoredChoice(): ThemeChoice {
  const choice = readStoredChoice()
  applyChoice(choice)
  return choice
}

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio between two #RRGGBB colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
