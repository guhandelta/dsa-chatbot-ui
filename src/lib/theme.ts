/**
 * Theme handling for the whole app.
 *
 * A learner's choice is one of three modes for now:
 *  - `light`: the light tokens in styles.css
 *  - `dark`:  the dark tokens in styles.css
 *  - `auto`:  follow the operating system's light/dark setting
 *
 * The choice is stored in localStorage under `THEME_STORAGE_KEY`, so it applies
 * to this browser only. It is applied by setting `data-theme` (or removing it for
 * `auto`) and `color-scheme` on the document element. Stored values that are not
 * one of the three modes are ignored, so an old or corrupted value falls back to
 * `auto` instead of breaking the page.
 */

export type ThemeMode = 'light' | 'dark' | 'auto'

export const THEME_STORAGE_KEY = 'theme'
const MODES: readonly ThemeMode[] = ['light', 'dark', 'auto']

/** Reads the stored choice, returning `auto` when nothing valid is stored. */
export function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'auto'
  } catch {
    // Storage can be blocked (private mode, disabled cookies). Fall back quietly.
    return 'auto'
  }
}

/** Saves the choice. A blocked or full storage must never stop the theme changing. */
export function writeStoredMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // The theme still applies for this page visit; it just is not remembered.
  }
}

/** Whether the operating system asks for a dark interface. */
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies a mode to the document and returns the scheme that is actually shown
 * (`light` or `dark`), which differs from `mode` only for `auto`.
 */
export function applyMode(mode: ThemeMode): 'light' | 'dark' {
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
