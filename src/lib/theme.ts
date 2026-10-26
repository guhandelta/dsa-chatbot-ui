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
  | 'chip-bg' | 'chip-line' | 'link-bg-hover' | 'hero-a' | 'hero-b'
  | 'bg-app' | 'bg-surface' | 'border-subtle' | 'text-primary' | 'text-muted'
  | 'accent-calm' | 'accent-calm-hover' | 'accent-calm-subtle'
  | 'accent-energize' | 'accent-energize-hover' | 'accent-subtle'
  | 'status-trained-text' | 'status-trained-bg' | 'status-trained-border',
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
      'sea-ink': '#182c29', 'sea-ink-soft': '#455c57', lagoon: '#245b56', 'lagoon-deep': '#32766f',
      palm: '#245b56', sand: '#cdded8', foam: '#e8efec', surface: '#e8efec',
      'surface-strong': 'rgba(232, 239, 236, 0.95)', line: '#cbd7d5',
      'inset-glint': 'rgba(255, 255, 255, 0.85)', kicker: '#245b56', 'bg-base': '#dce6e3',
      'header-bg': 'rgba(220, 230, 227, 0.92)', 'chip-bg': '#e8efec',
      'chip-line': '#cbd7d5', 'link-bg-hover': '#cdded8',
      'hero-a': 'rgba(36, 91, 86, 0.18)', 'hero-b': 'rgba(36, 91, 86, 0.08)',
      'bg-app': '#dce6e3', 'bg-surface': '#e8efec', 'border-subtle': '#cbd7d5',
      'text-primary': '#182c29', 'text-muted': '#455c57',
      'accent-calm': '#245b56', 'accent-calm-hover': '#32766f', 'accent-calm-subtle': '#cdded8',
      'accent-energize': '#245b56', 'accent-energize-hover': '#32766f', 'accent-subtle': '#cdded8',
      'status-trained-text': '#285444', 'status-trained-bg': '#e2ede8', 'status-trained-border': '#b8d4c7',
    },
  },
  energize: {
    label: 'Energize',
    base: 'light',
    tokens: {
      'sea-ink': '#2a1b16', 'sea-ink-soft': '#68544d', lagoon: '#914015', 'lagoon-deep': '#7f3510',
      palm: '#914015', sand: '#e4d5c2', foam: '#efe8dd', surface: '#efe8dd',
      'surface-strong': 'rgba(239, 232, 221, 0.95)', line: '#dbcfc2',
      'inset-glint': 'rgba(255, 255, 255, 0.85)', kicker: '#914015', 'bg-base': '#e5ddd1',
      'header-bg': 'rgba(229, 221, 209, 0.92)', 'chip-bg': '#efe8dd',
      'chip-line': '#dbcfc2', 'link-bg-hover': '#e4d5c2',
      'hero-a': 'rgba(200, 100, 40, 0.16)', 'hero-b': 'rgba(200, 100, 40, 0.08)',
      'bg-app': '#e5ddd1', 'bg-surface': '#efe8dd', 'border-subtle': '#dbcfc2',
      'text-primary': '#2a1b16', 'text-muted': '#68544d',
      'accent-calm': '#914015', 'accent-calm-hover': '#7f3510', 'accent-calm-subtle': '#e4d5c2',
      'accent-energize': '#914015', 'accent-energize-hover': '#7f3510', 'accent-subtle': '#e4d5c2',
      'status-trained-text': '#2f6044', 'status-trained-bg': '#eaf3ed', 'status-trained-border': '#b8dac5',
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
      'bg-app': '#1B1F2A', 'bg-surface': '#1E2433', 'border-subtle': 'rgba(143, 168, 255, 0.2)',
      'text-primary': '#E8ECF4', 'text-muted': '#B5BDCF',
      'accent-calm': '#8FA8FF', 'accent-calm-hover': '#A9BDFF', 'accent-calm-subtle': '#151A26',
      'accent-energize': '#8FA8FF', 'accent-energize-hover': '#A9BDFF', 'accent-subtle': '#151A26',
      'status-trained-text': '#6ec89a', 'status-trained-bg': 'rgba(110, 200, 154, 0.15)', 'status-trained-border': 'rgba(110, 200, 154, 0.3)',
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
      'bg-app': '#2A211B', 'bg-surface': '#2F261F', 'border-subtle': 'rgba(224, 179, 107, 0.2)',
      'text-primary': '#F5EBDD', 'text-muted': '#D2BFA8',
      'accent-calm': '#E0B36B', 'accent-calm-hover': '#F0CC8C', 'accent-calm-subtle': '#241D18',
      'accent-energize': '#E0B36B', 'accent-energize-hover': '#F0CC8C', 'accent-subtle': '#241D18',
      'status-trained-text': '#6ec89a', 'status-trained-bg': 'rgba(110, 200, 154, 0.15)', 'status-trained-border': 'rgba(110, 200, 154, 0.3)',
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
