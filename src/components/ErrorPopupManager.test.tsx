import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import axios, { AxiosError } from 'axios'
import { ErrorPopupManager, TOAST_DURATION_MS } from './ErrorPopupManager'
import { addError, clearAllErrors, getErrors, reportError } from '../lib/errorStore'
import { api, getApiErrorMessage } from '../lib/api'

function axiosError(status: number | undefined, data?: unknown, config: Record<string, unknown> = {}) {
  const err = new AxiosError('fail', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', { headers: {}, ...config } as never,
    {}, status ? ({ status, data, statusText: '', headers: {}, config: { headers: {} } } as never) : undefined)
  return err
}

describe('ErrorPopupManager toasts', () => {
  beforeEach(() => { vi.useFakeTimers(); clearAllErrors() })
  afterEach(() => { cleanup(); clearAllErrors(); vi.useRealTimers() })

  it('shows a non-blocking toast in a polite status region, without stealing focus', () => {
    render(<><button>field</button><ErrorPopupManager /></>)
    screen.getByText('field').focus()
    act(() => addError({ type: 'api', title: 'Request failed', message: 'Nope', status: 404 }))
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText('Request failed')).toBeTruthy()
    expect(screen.getByText('Status 404')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(screen.getByText('field'))
  })

  it('uses role=alert only for severe toasts', () => {
    render(<ErrorPopupManager />)
    act(() => reportError(axiosError(503), 'api'))
    expect(screen.getByRole('alert').textContent).toContain('Server error')
  })

  it('collapses duplicates into a ×N counter', () => {
    render(<ErrorPopupManager />)
    act(() => { for (let i = 0; i < 3; i++) addError({ type: 'api', message: 'down', status: 500 }) })
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
    expect(screen.getByText(/×3/)).toBeTruthy()
  })

  it('shows at most 3 toasts, newest first', () => {
    render(<ErrorPopupManager />)
    act(() => { for (let i = 1; i <= 5; i++) addError({ type: 'ui', message: `m${i}` }) })
    const toasts = screen.getAllByTestId('toast')
    expect(toasts).toHaveLength(3)
    expect(toasts[0].textContent).toContain('m5')
    expect(getErrors()).toHaveLength(5)
  })

  it('auto-dismisses and pauses while hovered', () => {
    render(<ErrorPopupManager />)
    act(() => addError({ type: 'ui', message: 'hello' }))
    const toast = screen.getByTestId('toast')
    fireEvent.mouseEnter(toast)
    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS * 2) })
    expect(screen.getByTestId('toast')).toBeTruthy()
    fireEvent.mouseLeave(toast)
    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS + 10) })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('closes via the close button and Escape', () => {
    render(<ErrorPopupManager />)
    act(() => addError({ type: 'ui', message: 'a' }))
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
    expect(screen.queryByTestId('toast')).toBeNull()
    act(() => addError({ type: 'ui', message: 'b' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('ignores axios rejections in the unhandledrejection handler', () => {
    render(<ErrorPopupManager />)
    const ev = new Event('unhandledrejection') as Event & { reason: unknown }
    ev.reason = { isAxiosError: true }
    act(() => { window.dispatchEvent(ev) })
    expect(getErrors()).toHaveLength(0)
    const ev2 = new Event('unhandledrejection') as Event & { reason: unknown }
    ev2.reason = new Error('boom')
    act(() => { window.dispatchEvent(ev2) })
    expect(getErrors()).toHaveLength(1)
  })
})

describe('API error reporting', () => {
  beforeEach(() => clearAllErrors())
  afterEach(() => clearAllErrors())

  const failWith = async (config: Record<string, unknown>, error: AxiosError) => {
    // The adapter error carries the request config, as real axios errors do.
    await expect(api.get('/x', {
      ...config,
      adapter: (c) => { error.config = c; return Promise.reject(error) },
    })).rejects.toBeTruthy()
    await new Promise((r) => setTimeout(r, 0))
  }

  it('toasts failing requests but skips silentError and cancelled ones', async () => {
    await failWith({ silentError: true }, axiosError(500))
    expect(getErrors()).toHaveLength(0)
    const cancelled = axiosError(undefined)
    cancelled.code = 'ERR_CANCELED'
    await failWith({}, cancelled)
    expect(getErrors()).toHaveLength(0)
    await failWith({}, axiosError(500))
    expect(getErrors()).toHaveLength(1)
  })

  it('never toasts 401', async () => {
    await failWith({ skipAuthRedirect: true }, axiosError(401))
    expect(getErrors()).toHaveLength(0)
  })
})

describe('getApiErrorMessage', () => {
  it('formats FastAPI 422 detail arrays', () => {
    const msg = getApiErrorMessage(axiosError(422, { detail: [
      { loc: ['body', 'email'], msg: 'value is not a valid email address' },
      { loc: ['body', 'password'], msg: 'field required' },
    ] }))
    expect(msg).toBe('email: value is not a valid email address; password: field required')
  })
  it('hides raw 5xx detail and gives a friendly network message', () => {
    expect(getApiErrorMessage(axiosError(500, { detail: 'Traceback: secret' }))).not.toContain('secret')
    const net = getApiErrorMessage(axiosError(undefined))
    expect(net).not.toMatch(/8000|backend/i)
    expect(axios.isAxiosError(axiosError(undefined))).toBe(true)
  })
  it('keeps string detail for 4xx', () => {
    expect(getApiErrorMessage(axiosError(400, { detail: 'Bad thing' }))).toBe('Bad thing')
  })
})
