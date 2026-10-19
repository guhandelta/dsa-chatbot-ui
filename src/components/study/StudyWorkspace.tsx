// The Study Room workspace: the learner's path beside the focused node and
// the active mode. Every mode is tied to the focus; with none chosen, the
// server works on the learner's next unfinished node.
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getApiErrorMessage } from '../../lib/api'
import { fetchAllowance, fetchStudyPath, type Allowance, type StudyMode, type StudyPath } from '../../lib/studyApi'
import type { ChatProvider } from '../../types'
import { CompareMode, DebugMode, ExplainMode } from './ConversationModes'
import { NextMode } from './NextMode'
import { NodeCard } from './NodeCard'
import { PathPanel } from './PathPanel'
import { QuizMode } from './QuizMode'

interface Props {
  language: string
  languages: string[]
  mode: Exclude<StudyMode, 'chat'>
  focus?: string
  provider: ChatProvider
  onFocus: (nodeId: string) => void
  onOpen: (mode: StudyMode, focus: string) => void
}

export function StudyWorkspace({ language, languages, mode, focus, provider, onFocus, onOpen }: Props) {
  const [path, setPath] = useState<StudyPath | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  const request = useRef(0)
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    const version = ++request.current
    setLoading(true); setError(null)
    fetchStudyPath(language).then((data) => { if (version === request.current) setPath(data) })
      .catch((err) => {
        if (version !== request.current) return
        setPath(null)
        setError(isAxiosError(err) && err.response?.status === 404
          ? 'The connected server does not support Study Room yet. Update or restart the server, then retry.'
          : getApiErrorMessage(err))
      }).finally(() => { if (version === request.current) setLoading(false) })
  }, [language])
  useEffect(() => { setPath(null); load(); return () => { ++request.current } }, [load])
  useEffect(() => { fetchAllowance().then(setAllowance).catch(() => setAllowance(null)) }, [])
  const node = path?.nodes.find((n) => n.id === (focus ?? path.current_id))
  const shared = { language, focusId: focus, provider, onAllowance: setAllowance }
  return <div className="track-layout">
    {path ? <PathPanel path={path} focusId={node?.id ?? null} onFocus={onFocus} />
      : <aside className="island-shell rounded-2xl p-4" role="status">{error ? 'Your path could not be loaded.' : 'Loading your path…'}</aside>}
    <section>
      {error && <div className="error-banner mb-3" role="alert"><p>{error}</p>
        <button type="button" className="mini-btn" disabled={loading} onClick={load}>Retry loading path</button>
      </div>}
      {allowance && <p className="cost-note mb-3" role="status">
        {allowance.free_left > 0 ? `${allowance.free_left} of ${allowance.daily_free} free Study Room messages left today` : 'Free messages used for today'}, then {allowance.cost_after_free} peppercorn each. Quizzes and What next are free.
      </p>}
      {node && <NodeCard key={node.id} node={node} language={language} levelLabel={path?.levels[node.level]} />}
      {path && <>
      {mode === 'explain' && <ExplainMode {...shared} />}
      {mode === 'debug' && <DebugMode {...shared} />}
      {mode === 'compare' && <CompareMode {...shared} languages={languages} />}
      {mode === 'quiz' && <QuizMode language={language} focusId={focus} onComplete={load} />}
      {mode === 'next' && <NextMode language={language} onOpen={onOpen} />}
      </>}
    </section>
  </div>
}
