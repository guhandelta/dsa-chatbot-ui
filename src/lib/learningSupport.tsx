import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react'

export const MILESTONES = ['Review an example', 'Make an attempt', 'Review feedback', 'Try a variation'] as const
export type LearningRecord = { milestones: boolean[]; difficulties: number; nextStep: string; paused: boolean; updatedAt: string }
export const freshRecord = (): LearningRecord => ({ milestones: [false, false, false, false], difficulties: 0,
  nextStep: 'Review one small example and describe what it does.', paused: false, updatedAt: '' })
export function practiceTopicKey(problem: string, language: string) {
  const stage = problem.startsWith(`${language}-path-`) ? problem.slice(`${language}-path-`.length).match(/^(\d{2})-/)?.[1] : undefined
  return stage ? `study:${language}:${language}:stage-${stage}` : `practice:${language}:${problem}`
}
export function storageKey(owner: string, topic: string) { return `learning-support:v1:${encodeURIComponent(owner)}:${encodeURIComponent(topic)}` }
export function readRecord(owner: string, topic: string): LearningRecord {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(owner, topic)) ?? 'null')
    if (!data || !Array.isArray(data.milestones) || data.milestones.length !== 4 || !data.milestones.every((v: unknown) => typeof v === 'boolean')) return freshRecord()
    return { milestones: data.milestones, difficulties: Number.isSafeInteger(data.difficulties) ? Math.max(0, Math.min(100, data.difficulties)) : 0,
      nextStep: typeof data.nextStep === 'string' ? data.nextStep.slice(0, 500) : freshRecord().nextStep,
      paused: data.paused === true, updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '' }
  } catch { return freshRecord() }
}
export function writeRecord(owner: string, topic: string, record: LearningRecord) {
  localStorage.setItem(storageKey(owner, topic), JSON.stringify(record))
}
export type SupportTask = { id: string; title: string; save?: () => Promise<void>; busy?: boolean }
type ContextValue = {
  owner: string
  register: (task: SupportTask) => () => void
  report: (id: string, outcome: 'attempt' | 'success' | 'difficulty') => void
  reportCurrent: (outcome: 'attempt' | 'success' | 'difficulty') => void
  registerSaver: (key: string, save: () => void) => () => void
}
const Context = createContext<ContextValue | null>(null)

export function useLearningFeedback() {
  return useContext(Context)?.reportCurrent ?? (() => {})
}
export function useLearningPauseGuard(busy: boolean) {
  const context = useContext(Context)
  const key = useRef(`busy:${Math.random()}`)
  useEffect(() => {
    if (!context) return
    return context.registerSaver(key.current, () => { if (busy) throw new Error('Wait for the current operation to finish') })
  }, [context?.registerSaver, busy])
}

/** Drafts stay on this browser, scoped by account, topic and field. */
export function useLearningDraft<T>(id: string, initial: T, valid: (value: unknown) => value is T) {
  const context = useContext(Context)
  const key = context ? storageKey(context.owner, `draft:${id}`) : `memory:${id}`
  const read = () => {
    try { const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return valid(data) ? data : initial }
    catch { return initial }
  }
  const [state, setState] = useState(() => ({ key, value: context ? read() : initial }))
  const current = state.key === key ? state : { key, value: context ? read() : initial }
  if (state.key !== key) setState(current)
  const latest = useRef(current)
  latest.current = current
  const set = (action: SetStateAction<T>) => {
    const value = typeof action === 'function' ? (action as (previous: T) => T)(latest.current.value) : action
    latest.current = { key, value }; setState({ key, value })
    try { if (context) localStorage.setItem(key, JSON.stringify(value)) } catch { /* Pause reports save failures. */ }
  }
  useEffect(() => {
    if (!context || !key) return
    return context.registerSaver(key, () => localStorage.setItem(key, JSON.stringify(latest.current.value)))
  }, [context?.registerSaver, key])
  return [current.value, set] as const
}
export const isDraftText = (value: unknown): value is string => typeof value === 'string' && value.length <= 100_000

/** Hooks are optional so embedded editors and existing component consumers still work. */
export function useSupportTask(task: SupportTask | null) {
  const context = useContext(Context)
  const save = useRef(task?.save)
  save.current = task?.save
  const id = task?.id, title = task?.title, busy = task?.busy
  useEffect(() => {
    if (!context || !id || !title) return
    return context.register({ id, title, busy, save: () => save.current?.() ?? Promise.resolve() })
  }, [context?.register, id, title, busy])
  return useCallback((outcome: 'attempt' | 'success' | 'difficulty') => {
    if (id) context?.report(id, outcome)
  }, [context?.report, id])
}

export function LearningSupportProvider({ owner, children, fallback }: { owner: string; children: ReactNode; fallback: SupportTask | null }) {
  const [task, setTask] = useState<SupportTask | null>(null)
  const registration = useRef<symbol | null>(null)
  const register = useCallback((value: SupportTask) => {
    const token = Symbol(); registration.current = token; setTask(value)
    return () => { if (registration.current === token) setTask(null) }
  }, [])
  const active = task ?? fallback
  const savers = useRef(new Map<string, () => void>())
  const registerSaver = useCallback((key: string, save: () => void) => {
    savers.current.set(key, save)
    return () => { if (savers.current.get(key) === save) savers.current.delete(key) }
  }, [])
  const [signals, setSignals] = useState<{ id: string; outcome: 'attempt' | 'success' | 'difficulty'; serial: number }[]>([])
  const report = useCallback((id: string, outcome: 'attempt' | 'success' | 'difficulty') => {
    setSignals(previous => [...previous.slice(-99), { id, outcome, serial: (previous.at(-1)?.serial ?? 0) + 1 }])
  }, [])
  const reportCurrent = (outcome: 'attempt' | 'success' | 'difficulty') => { if (active) report(active.id, outcome) }
  const saveDrafts = async () => { for (const save of savers.current.values()) save() }
  return <Context.Provider value={{ owner, register, report, reportCurrent, registerSaver }}>
    {active && <SupportPanel key={`${owner}:${active.id}`} owner={owner} task={active} signals={signals} saveDrafts={saveDrafts} />}
    {children}
  </Context.Provider>
}

function SupportPanel({ owner, task, signals, saveDrafts }: { owner: string; task: SupportTask; signals: { id: string; outcome: string; serial: number }[]; saveDrafts: () => Promise<void> }) {
  const [record, setRecord] = useState(() => readRecord(owner, task.id))
  const latest = useRef(record)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alive = useRef(true)
  const lastSignal = useRef(signals.at(-1)?.serial ?? 0)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const update = (change: (value: LearningRecord) => LearningRecord) => {
    const stored = readRecord(owner, task.id)
    const next = { ...change({ ...latest.current, milestones: latest.current.milestones.map((done, i) => done || stored.milestones[i]) }), updatedAt: new Date().toISOString() }
    latest.current = next; setRecord(next)
    try { writeRecord(owner, task.id, next); setError('') }
    catch { setError('Browser storage is unavailable. Keep this page open; progress cannot be saved on this device.') }
    return next
  }
  useEffect(() => {
    const unseen = signals.filter(signal => signal.serial > lastSignal.current && signal.id === task.id)
    lastSignal.current = signals.at(-1)?.serial ?? lastSignal.current
    if (!unseen.length) return
    update(value => unseen.reduce((previous, signal) => ({ ...previous, milestones: previous.milestones.map((done, i) => done || i === 1),
      difficulties: signal.outcome === 'difficulty' ? Math.min(100, previous.difficulties + 1) : signal.outcome === 'success' ? 0 : previous.difficulties,
      nextStep: signal.outcome === 'success' ? 'Explain why your approach works, then try a small variation.' : 'Trace the smallest example that does not behave as expected.' }), value))
    const signal = unseen.at(-1)!
    setMessage(signal.outcome === 'success' ? 'This check passed. Next, explain why the approach works.' : signal.outcome === 'difficulty'
      ? 'This attempt gives you an example to investigate. Next, trace its first unexpected step.' : 'Your attempt is recorded. Next, compare what happened with what you expected.')
  }, [signals, task.id])
  const pause = async () => {
    if (saving || task.busy) return
    setSaving(true); setError('')
    try {
      await task.save?.()
      await saveDrafts()
      if (!alive.current) return
      const stored = readRecord(owner, task.id)
      const next = { ...latest.current, milestones: latest.current.milestones.map((done, i) => done || stored.milestones[i]), paused: true, updatedAt: new Date().toISOString() }
      writeRecord(owner, task.id, next)
      const href = window.location.pathname + window.location.search
      if (/^\/(chat|practice|track|playground|learn)(\/|\?|$)/.test(href)) {
        localStorage.setItem(storageKey(owner, 'last-pause'), JSON.stringify({ href, title: task.title }))
      }
      latest.current = next; setRecord(next)
      setMessage('Paused. Your next step and supported drafts are saved. Keep using this browser to return to them.')
    } catch { if (alive.current) setError('Saving did not finish. Keep this page open and retry before leaving.') }
    finally { if (alive.current) setSaving(false) }
  }
  const completed = record.milestones.filter(Boolean).length
  return <aside className="learning-support" aria-label="Learning support">
    <div className="learning-support-heading">
      <div><strong>{task.title}</strong><p className="m-0 text-xs">Learning steps · {completed} of 4 recorded · separate from graded mastery</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="mini-btn" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>I’m stuck</button>
        {record.paused ? <button type="button" className="mini-btn" onClick={() => { update(value => ({ ...value, paused: false })); setMessage('Welcome back. Continue with your saved next step.') }}>Resume learning</button>
          : <button type="button" className="mini-btn" disabled={saving || task.busy} onClick={() => void pause()}>{saving ? 'Saving…' : 'Pause and save'}</button>}
      </div>
    </div>
    <progress aria-label="Topic learning steps" value={completed} max={4} />
    <div className="learning-milestones">{MILESTONES.map((label, i) => <button key={label} type="button" className="mini-btn" aria-pressed={record.milestones[i]}
      onClick={() => { if (!record.milestones[i]) { update(value => ({ ...value, milestones: value.milestones.map((done, index) => done || index === i) })); setMessage(`${label} recorded. Your completed steps stay recorded when you make mistakes.`) } }}>
      {record.milestones[i] ? '✓ ' : ''}{label}</button>)}</div>
    <p className="my-1 text-sm">Next step: {record.nextStep}</p>
    {record.difficulties >= 3 && !expanded && <p className="my-1 text-sm">A few attempts have been difficult. You can try a different approach with “I’m stuck”.</p>}
    {expanded && <div className="learning-recovery"><p className="my-1">Let’s find a smaller step. Choose the approach that helps you.</p>
      {['Trace one small example and identify its first unexpected step.', 'Break this task into one input, one operation, and one expected result.', 'Review the prerequisite or worked example, then explain it in your own words.'].map(step =>
        <button type="button" className="mini-btn" key={step} onClick={() => { update(value => ({ ...value, nextStep: step, difficulties: 0 })); setMessage('Your new approach is ready. Take one step at a time.'); setExpanded(false) }}>{step}</button>)}
      <label className="selector mt-2">My next step<input maxLength={500} value={record.nextStep} onChange={e => update(value => ({ ...value, nextStep: e.target.value }))} /></label>
    </div>}
    <p className="m-0 text-xs">Steps are self-recorded; attempts are also recorded by supported exercises. Pausing does not stop the editor.</p>
    <p className="my-1 text-sm" role="status">{message}</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </aside>
}
