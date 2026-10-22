// Non-blocking toast stack for errors nobody handled locally. Never steals focus.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlertCircle, AlertTriangle, X } from 'lucide-react'
import { addError, dismissError, getErrors, subscribeToErrors, type AppError } from '../lib/errorStore'

export const MAX_VISIBLE_TOASTS = 3
export const TOAST_DURATION_MS = 8000

function Toast({ error }: { error: AppError }) {
  const [paused, setPaused] = useState(false)
  const { id, count } = error

  // A repeat (count change) restarts the timer so the user can see the new count.
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => dismissError(id), TOAST_DURATION_MS)
    return () => clearTimeout(t)
  }, [id, count, paused])

  const Icon = error.type === 'api' ? AlertTriangle : AlertCircle
  const body = (
    <>
      <Icon className="toast-icon" aria-hidden="true" />
      <div className="toast-body">
        <p className="toast-title">
          {error.title}
          {error.count > 1 && <span className="toast-count" aria-label={`${error.count} times`}> ×{error.count}</span>}
        </p>
        <p className="toast-message">{error.message}</p>
        {error.status !== undefined && <p className="toast-meta">Status {error.status}</p>}
      </div>
      <button type="button" className="toast-close" aria-label={`Dismiss: ${error.title}`} onClick={() => dismissError(id)}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  )
  const props = {
    className: `toast ${error.severe ? 'toast-severe' : ''}`,
    'data-testid': 'toast',
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
  }
  // Severe toasts are announced assertively; the rest politely via the container.
  return error.severe
    ? <div role="alert" {...props}>{body}</div>
    : <div {...props}>{body}</div>
}

export function ErrorPopupManager() {
  const errors = useSyncExternalStore(subscribeToErrors, getErrors, getErrors)

  // Report uncaught window errors and promise rejections.
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      if (event.message?.includes('ResizeObserver')) return
      addError({
        type: 'ui',
        message: event.message || 'An unexpected error occurred in the user interface.',
      })
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      // The axios interceptor already reported (or deliberately silenced) this request failure.
      if (reason?.isAxiosError || reason?.config?.url || reason?.response) return
      addError({
        type: 'ui',
        message: reason?.message || String(reason || 'Unhandled promise rejection'),
      })
    }
    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  const visible = errors.slice(0, MAX_VISIBLE_TOASTS)

  // Escape dismisses the newest toast without any focus being moved.
  useEffect(() => {
    if (visible.length === 0) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissError(visible[0].id) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible[0]?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-label="Notifications">
      {visible.map((e) => <Toast key={e.id} error={e} />)}
    </div>
  )
}
