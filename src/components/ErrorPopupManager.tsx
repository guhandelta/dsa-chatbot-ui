// Component managing the closable error popup and the floating error icon below the nav bar.
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, X, Trash2 } from 'lucide-react'
import {
  addError,
  clearAllErrors,
  closeErrorPopup,
  getActiveError,
  getErrors,
  isErrorPopupOpen,
  openErrorPopup,
  subscribeToErrors,
  type AppError,
} from '../lib/errorStore'

export function ErrorPopupManager() {
  const [activeError, setActiveError] = useState<AppError | null>(getActiveError())
  const [isOpen, setIsOpen] = useState(isErrorPopupOpen())
  const [allErrors, setAllErrors] = useState<AppError[]>(getErrors())

  useEffect(() => {
    return subscribeToErrors(() => {
      setActiveError(getActiveError())
      setIsOpen(isErrorPopupOpen())
      setAllErrors(getErrors())
    })
  }, [])

  // Auto-listen for uncaught window errors and promise rejections
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      // Don't intercept resize observer loop limit warnings or devtools
      if (event.message?.includes('ResizeObserver')) return
      addError({
        type: 'ui',
        title: 'UI Runtime Error',
        message: event.message || 'An unexpected error occurred in the user interface.',
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const isApi = reason?.isAxiosError || reason?.config?.url || reason?.response
      if (isApi) {
        // The axios interceptor already reported this request failure.
        return
      } else {
        addError({
          type: 'ui',
          title: 'UI Unhandled Error',
          message: reason?.message || String(reason || 'Unhandled promise rejection'),
        })
      }
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  const closeRef = useRef<HTMLButtonElement>(null)
  const open = isOpen && activeError !== null
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeErrorPopup() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [open])

  const hasErrors = allErrors.length > 0 && activeError !== null
  const isApiError = activeError?.type === 'api'

  return (
    <>
      {/* Floating icon on the top right, below the header nav bar */}
      {hasErrors && !isOpen && (
        <button
          type="button"
          onClick={() => openErrorPopup()}
          aria-label={`Open ${isApiError ? 'API' : 'UI'} error details (${allErrors.length} notices)`}
          title={`Click to view ${isApiError ? 'API error' : 'UI error'}`}
          className={`fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
            isApiError
              ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 border border-orange-300 ring-2 ring-orange-400/40'
              : 'bg-red-600 hover:bg-red-700 shadow-red-500/30 border border-red-300 ring-2 ring-red-400/40'
          }`}
        >
          {isApiError ? (
            <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 animate-bounce" />
          )}
          <span>{isApiError ? 'API Error' : 'UI Error'}</span>
          {allErrors.length > 1 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-[10px] font-extrabold">
              {allErrors.length}
            </span>
          )}
        </button>
      )}

      {/* Closable Error Modal Popup */}
      {hasErrors && isOpen && activeError && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="error-dialog-title"
          aria-describedby="error-dialog-message"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl backdrop-blur-md transition-all ${
              isApiError
                ? 'border-orange-500/30 bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-orange-950/20'
                : 'border-red-500/30 bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-red-950/20'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isApiError
                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}
                >
                  {isApiError ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isApiError
                          ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                          : 'bg-red-500/20 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {isApiError ? 'API Error' : 'UI Error'}
                    </span>
                    {activeError.status && (
                      <span className="font-mono text-xs text-[var(--sea-ink-soft)]">
                        Status {activeError.status}
                      </span>
                    )}
                  </div>
                  <h2
                    id="error-dialog-title"
                    className="mt-1 text-base font-bold text-[var(--sea-ink)]"
                  >
                    {activeError.title}
                  </h2>
                </div>
              </div>

              {/* Close Button ('x') */}
              <button
                type="button"
                ref={closeRef}
                onClick={() => closeErrorPopup()}
                aria-label="Close error popup"
                className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--sea-ink)] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message Body */}
            <div id="error-dialog-message" className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-sm text-[var(--sea-ink)] leading-relaxed font-sans break-words max-h-60 overflow-y-auto">
              {activeError.message}
            </div>

            {/* Other queued errors list */}
            {allErrors.length > 1 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--sea-ink-soft)] mb-1.5">
                  Other notices ({allErrors.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allErrors.map((err) => (
                    <button
                      key={err.id}
                      type="button"
                      onClick={() => openErrorPopup(err)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                        err.id === activeError.id
                          ? 'bg-[var(--sea-ink)] text-white'
                          : err.type === 'api'
                          ? 'border border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300'
                          : 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {err.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
              <span className="text-[11px] text-[var(--sea-ink-soft)]">
                {new Date(activeError.timestamp).toLocaleTimeString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearAllErrors()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] hover:bg-[var(--surface)] transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dismiss All
                </button>
                <button
                  type="button"
                  onClick={() => closeErrorPopup()}
                  className={`inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm transition ${
                    isApiError
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Close Popup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
