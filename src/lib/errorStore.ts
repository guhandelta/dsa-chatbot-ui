// Global store behind the toast stack: UI and API failures that no caller handled itself.
import { isAxiosError } from 'axios'
import { getApiErrorMessage, NETWORK_ERROR_MESSAGE } from './api'

export type ErrorType = 'ui' | 'api'

export interface AppError {
  id: string
  type: ErrorType
  title: string
  message: string
  status?: number
  /** Severe toasts (network down, 5xx) are announced assertively. */
  severe: boolean
  /** How many identical errors were collapsed into this one. */
  count: number
  timestamp: number
}

type Listener = () => void

const DEDUPE_WINDOW_MS = 5000
const MAX_STORED = 20

let errors: AppError[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

/** Newest first. */
export function getErrors(): AppError[] {
  return errors
}

export function addError(err: {
  type: ErrorType
  title?: string
  message: string
  status?: number
  severe?: boolean
}) {
  const now = Date.now()
  // A failing API fires many identical errors at once; collapse repeats into a counter.
  const dup = errors.find((e) => e.type === err.type && e.message === err.message && e.status === err.status
    && now - e.timestamp < DEDUPE_WINDOW_MS)
  if (dup) {
    errors = errors.map((e) => (e.id === dup.id ? { ...e, count: e.count + 1, timestamp: now } : e))
    notify()
    return
  }
  const newErr: AppError = {
    id: `err-${now}-${Math.random().toString(36).slice(2, 7)}`,
    type: err.type,
    title: err.title || (err.type === 'ui' ? 'Something went wrong' : 'Request failed'),
    message: err.message,
    status: err.status,
    severe: err.severe ?? false,
    count: 1,
    timestamp: now,
  }
  errors = [newErr, ...errors].slice(0, MAX_STORED)
  notify()
}

export function dismissError(id: string) {
  if (!errors.some((e) => e.id === id)) return
  errors = errors.filter((e) => e.id !== id)
  notify()
}

export function clearAllErrors() {
  errors = []
  notify()
}

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Report an error from anywhere in the app. Never toasts cancelled requests. */
export function reportError(err: unknown, defaultType: ErrorType = 'ui') {
  if (isAxiosError(err)) {
    if (err.code === 'ERR_CANCELED') return
    const status = err.response?.status
    const network = !err.response
    const serverError = status !== undefined && status >= 500
    addError({
      type: 'api',
      title: network ? 'Connection problem' : serverError ? 'Server error' : 'Request failed',
      message: getApiErrorMessage(err) || (network ? NETWORK_ERROR_MESSAGE : 'Failed to communicate with the server.'),
      status,
      severe: network || serverError,
    })
    return
  }

  if (err instanceof Error) {
    addError({ type: defaultType, message: err.message })
    return
  }

  addError({ type: defaultType, message: typeof err === 'string' ? err : String(err) })
}
