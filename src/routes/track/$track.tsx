import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatWindow } from '../../components/ChatWindow'
import { ProviderSelector } from '../../components/ProviderSelector'
import { fetchTrackItems, fetchContentItem, fetchCurriculumProgress, getApiErrorMessage } from '../../lib/api'
import { hasToken } from '../../lib/auth'
import { LANGUAGE_LABELS, useLanguageAccess } from '../../lib/languageAccess'
import type { ContentMeta, Mode, Provider, Track } from '../../types'

export const Route = createFileRoute('/track/$track')({
  beforeLoad: () => { if (!hasToken()) throw redirect({ to: '/login' }) },
  validateSearch: (search: Record<string, unknown>): { mode: Mode } => ({
    mode: search.mode === 'practice' ? 'practice' : search.mode === 'learn' ? 'learn' : 'browse',
  }),
  component: TrackPage,
})

function TrackPage() {
  const { track } = Route.useParams()
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const access = useLanguageAccess()
  const student = access.data?.role === 'student'
  const language = access.data?.preferred_language ?? ''
  const [items, setItems] = useState<ContentMeta[]>([])
  const [focus, setFocus] = useState<ContentMeta | null>(null)
  const [provider, setProvider] = useState<Provider>('gemini')
  const [error, setError] = useState<string | null>(null)
  const [supplemental, setSupplemental] = useState(false)
  const [difficulty, setDifficulty] = useState('')
  const [completed, setCompleted] = useState<string[]>([])
  const [totalExercises, setTotalExercises] = useState(0)
  useEffect(() => {
    let active = true
    setCompleted([])
    if (language && track === 'language') fetchCurriculumProgress(language).then((p) => { if (active) { setCompleted(p.completed_ids); setTotalExercises(p.total) } }).catch(() => {})
    return () => { active = false }
  }, [track, language])

  useEffect(() => {
    let active = true
    setFocus(null); setItems([]); setError(null)
    if (!language) return () => { active = false }
    fetchTrackItems(track, { language, difficulty: difficulty || undefined })
      .then((rows) => { if (active) setItems(rows) })
      .catch((e) => { if (active) setError(getApiErrorMessage(e)) })
    return () => { active = false }
  }, [track, language, difficulty])

  const visible = items.filter((item) => track !== 'language' || supplemental || (item.order > 0 && item.order < 100))
  const switchMode = (next: Mode) => navigate({ to: '/track/$track', params: { track }, search: { mode: next } })
  if (!['language', 'dsa', 'algorithm'].includes(track)) return <main className="page-wrap py-8"><p>This subject is planned for a later release.</p><Link to="/learn">Back to learning</Link></main>

  return <main className="page-wrap px-4 py-8">
    <Link to="/learn">← Learning home</Link>
    <h1 className="display-title mt-3 text-3xl font-bold">{track === 'language' ? 'Your language path' : 'DSA workouts'}</h1>
    <p className="my-3 text-[var(--sea-ink-soft)]">{track === 'language'
      ? 'The same foundations for everyone. Follow the sequence, or use each exercise as a mastery check and move ahead.'
      : 'Choose a technique to study or a problem to solve. Solutions become available after evaluation when you choose to reveal them.'}</p>
    <div className="controls mb-4">
      {(['browse', 'learn', 'practice'] as Mode[]).map((m) => <button key={m} type="button" onClick={() => switchMode(m)} className={`lang-tab ${mode === m ? 'is-active' : ''}`}>{m === 'browse' ? 'Lessons' : m === 'learn' ? 'Ask mentor' : 'Practice'}</button>)}
      {track === 'language' ? <label><input type="checkbox" checked={supplemental} onChange={(e) => setSupplemental(e.target.checked)} /> Include reference library</label>
        : <label className="selector">Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Any</option>{['Easy', 'Medium', 'Hard'].map((d) => <option key={d}>{d}</option>)}</select></label>}
      {mode === 'learn' && !student && <ProviderSelector value={provider} onChange={setProvider} />}
    </div>
    {access.data && !language && <p>No languages are available for your account.</p>}
    {access.isError && <p role="alert">Language access could not be loaded.</p>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="track-layout">
      <aside className="island-shell rounded-2xl p-4">
        <p className="mb-3 text-sm">{LANGUAGE_LABELS[language] ?? language} · {visible.length} topics{track === 'language' ? ` · ${completed.length}/${totalExercises} exercises passed` : ''}</p>
        <ul className="item-list">{visible.map((item) => <li key={item.id}><button type="button" onClick={() => setFocus(item)} className={`item-btn ${focus?.id === item.id ? 'is-active' : ''}`}>
          <span>{completed.includes(item.id) ? '✓ ' : ''}{item.order > 0 && item.order < 100 ? `${item.order}. ` : ''}{item.title}</span>
          <span className="text-xs">{item.level ?? item.difficulty}{item.has_tests ? ' · exercise' : ' · lesson'}</span>
        </button></li>)}</ul>
      </aside>
      <section>{focus ? mode === 'learn'
        ? <ChatWindow key={`${language}-${focus.id}`} provider={student ? 'auto' : provider} language={language} track={focus.track as Track} focusId={focus.id} chatCost={1} />
        : <Lesson key={focus.id} item={focus} practice={mode === 'practice'} />
        : <div className="island-shell rounded-2xl p-5">Choose a topic to read its lesson, ask questions, or practice. Interview candidates can start with any DSA problem.</div>}
      </section>
    </div>
  </main>
}

function Lesson({ item, practice }: { item: ContentMeta; practice: boolean }) {
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    fetchContentItem(item.id).then((data) => { if (active) setMarkdown(data.markdown) }).catch((e) => { if (active) setError(getApiErrorMessage(e)) })
    return () => { active = false }
  }, [item.id])
  return <article className="island-shell rounded-2xl p-5">
    {error && <div className="error-banner" role="alert">{error}</div>}
    {!markdown && !error && <p>Loading lesson…</p>}
    <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{markdown}</ReactMarkdown></div>
    {item.has_tests ? <Link to="/practice" search={{ problem: item.id }} className="primary-btn mt-5 inline-block">{practice ? 'Open exercise' : 'Check your understanding'}</Link>
      : <p className="mt-4 text-sm">This is a reference lesson. Choose an exercise in the curriculum or a DSA workout to practice with evaluated code.</p>}
  </article>
}
