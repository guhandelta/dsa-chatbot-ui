// Global error store for capturing UI and API errors.
// Distinguishes between UI errors (red) and API errors (orange).
import { getApiErrorMessage } from './api'
import { isAxiosError } from 'axios'

export type ErrorType = 'ui' | 'api'

export interface AppError {
  id: string
  type: ErrorType
  title: string
  message: string
  status?: number
  timestamp: number
}

type Listener = () => void

let errors: AppError[] = []
let activeError: AppError | null = null
let isPopupOpen = false
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function getErrors(): AppError[] {
  return errors
}

export function getActiveError(): AppError | null {
  return activeError
}

export function isErrorPopupOpen(): boolean {
  return isPopupOpen
}

export function addError(err: { type: ErrorType; title?: string; message: string; status?: number }) {
  // A failing API fires many identical errors at once; collapse repeats so the
  // popup does not re-open or flood the list after the user closed it.
  const dup = errors.find((e) => e.type === err.type && e.message === err.message && e.status === err.status
    && Date.now() - e.timestamp < 5000)
  if (dup) return
  const newErr: AppError = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: err.type,
    title: err.title || (err.type === 'ui' ? 'Application UI Error' : 'API Service Error'),
    message: err.message,
    status: err.status,
    timestamp: Date.now(),
  }
  errors = [newErr, ...errors].slice(0, 20)
  activeError = newErr
  isPopupOpen = true // opens the popup automatically when an error occurs
  notify()
}

export function openErrorPopup(error?: AppError) {
  if (error) {
    activeError = error
  } else if (!activeError && errors.length > 0) {
    activeError = errors[0]
  }
  isPopupOpen = true
  notify()
}

export function closeErrorPopup() {
  isPopupOpen = false
  notify()
}

export function dismissActiveError() {
  if (!activeError) return
  errors = errors.filter((e) => e.id !== activeError?.id)
  activeError = errors[0] || null
  if (!activeError) {
    isPopupOpen = false
  }
  notify()
}

export function clearAllErrors() {
  errors = []
  activeError = null
  isPopupOpen = false
  notify()
}

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Convenience helper to report an error from anywhere in the app.
 */
export function reportError(err: unknown, defaultType: ErrorType = 'ui') {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const message = getApiErrorMessage(err)
    addError({
      type: 'api',
      title: status ? `API Error (${status})` : 'API Network Error',
      message: message || 'Failed to communicate with the server.',
      status,
    })
    return
  }

  if (err instanceof Error) {
    addError({
      type: defaultType,
      title: defaultType === 'ui' ? 'UI Error' : 'API Error',
      message: err.message,
    })
    return
  }

  if (typeof err === 'string') {
    addError({
      type: defaultType,
      title: defaultType === 'ui' ? 'UI Notice' : 'API Notice',
      message: err,
    })
    return
  }

  addError({
    type: defaultType,
    title: 'Unknown Error',
    message: String(err),
  })
}
