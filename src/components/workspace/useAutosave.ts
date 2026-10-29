// Debounced autosave with optimistic concurrency. The server rejects a save
// based on an old revision (another tab or device saved since), and the
// learner then chooses which version to keep instead of losing either.
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { saveWorkspace, type WorkspaceFile } from '../../lib/workspaceApi'

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'conflict' | 'error' | 'offline'

export interface Snapshot {
  files: WorkspaceFile[]
  entry: string
  template: string
}

export type Saver = (snapshot: Snapshot & { revision: number | null; force: boolean }) =>
  Promise<{ revision: number; updated_at: string }>

/** `saver` replaces the practice-workspace endpoint (the web playground passes its own). */
export function useAutosave(problemId: string, language: string, enabled: boolean, delay = 1000, saver?: Saver) {
  const [status, setStatus] = useState<SaveStatus>(enabled ? 'idle' : 'offline')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const revision = useRef<number | null>(null)
  const pending = useRef<Snapshot | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef<Promise<void> | null>(null)
  const blocked = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  useEffect(() => { setStatus((current) => (!enabled ? 'offline' : current === 'offline' ? 'idle' : current)) }, [enabled])

  const write = useCallback(async (force = false) => {
    const snapshot = pending.current
    if (!snapshot || (blocked.current && !force)) return
    pending.current = null
    if (alive.current) setStatus('saving')
    try {
      const body = { ...snapshot, revision: revision.current, force }
      const saved = saver ? await saver(body) : await saveWorkspace(problemId, { language, ...body })
      revision.current = saved.revision
      blocked.current = false
      if (alive.current) {
        setSavedAt(saved.updated_at)
        setError(null)
        setStatus(pending.current ? 'unsaved' : 'saved')
      }
    } catch (err) {
      // Keep the unsaved files so a retry or "keep mine" can still send them.
      pending.current = pending.current ?? snapshot
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        blocked.current = true
        if (alive.current) setStatus('conflict')
      } else if (alive.current) {
        setError(getApiErrorMessage(err))
        setStatus('error')
      }
    }
  }, [problemId, language, saver])

  const flush = useCallback(async (force = false) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inflight.current) await inflight.current
    inflight.current = write(force).finally(() => { inflight.current = null })
    await inflight.current
  }, [write])

  const schedule = useCallback((snapshot: Snapshot) => {
    if (!enabled) return
    pending.current = snapshot
    if (blocked.current) return
    setStatus('unsaved')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, delay)
  }, [enabled, delay, flush])

  /** Adopt a server draft (load, reset, restore) as the saved baseline. */
  const adopt = useCallback((nextRevision: number | null, updatedAt: string | null = null) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    pending.current = null
    blocked.current = false
    revision.current = nextRevision
    setSavedAt(updatedAt)
    setError(null)
    setStatus(nextRevision === null ? 'idle' : 'saved')
  }, [])

  // Save what is pending when the workspace unmounts (problem or language change).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (pending.current && !blocked.current) void write()
  }, [write])

  // Warn before leaving the page with edits that have not reached the server.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const flushChecked = async () => {
    if (!enabled) throw new Error('Workspace saving is unavailable')
    await flush()
    if (blocked.current || pending.current) throw new Error('Workspace still has unsaved changes')
  }
  return { status, error, savedAt, schedule, flush, flushChecked, adopt, keepMine: () => flush(true) }
}
