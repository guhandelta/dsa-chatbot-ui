// The Study Room workspace: the learner's path beside the focused node and
// the active mode. Every mode is tied to the focus; with none chosen, the
// server works on the learner's next unfinished node.
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getApiErrorMessage } from '../../lib/api'
import { fetchAllowance, fetchStudyPath, type Allowance, type StudyMode, type StudyPath } from '../../lib/studyApi'
import type { ChatProvider } from '../../types'
import { CompareMode, DebugMode, ExplainMode } from './ConversationModes'
import { ExplainCourse } from './ExplainCourse'
import { ExplainPathway } from './ExplainPathway'
import { NextMode } from './NextMode'
import { NodeCard } from './NodeCard'
import { PathPanel } from './PathPanel'
import { QuizMode } from './QuizMode'
import { TopicQuestionsSection } from './TopicQuestionsSection'

interface Props {
  language: string
  languages: string[]
  mode: Exclude<StudyMode, 'chat'>
  focus?: string
  provider: ChatProvider
  subject?: string
  onFocus: (nodeId: string) => void
  onOpen: (mode: StudyMode, focus: string) => void
}

export function StudyWorkspace({ language, languages, mode, focus, provider, subject, onFocus, onOpen }: Props) {
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
  const [activeQuestion, setActiveQuestion] = useState<string>('')
  const node = path?.nodes.find((n) => n.id === (focus ?? path.current_id))
  const collection = !focus && subject ? subject : undefined
  const unsupportedUnitFocus = !!focus?.startsWith('explain:') && (language !== 'javascript' || !focus.startsWith(`explain:${language}:`))
  const resolvedFocus = collection ? `subject:${collection}` : node?.id ?? focus
  const shared = { language, focusId: resolvedFocus, focusTitle: collection?.replaceAll('-', ' ') ?? node?.title, provider, onAllowance: setAllowance }

  const handleFocus = (nodeId: string) => {
    const currentY = typeof window !== 'undefined' ? window.scrollY : 0
    onFocus(nodeId)
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: currentY, behavior: 'instant' as ScrollBehavior })
      })
    }
  }

  return <div className="track-layout">
    {path ? <PathPanel path={path} focusId={node?.id ?? null} onFocus={handleFocus} />
      : <aside className="island-shell rounded-2xl p-4" role="status">{error ? 'Your path could not be loaded.' : 'Loading your path…'}</aside>}
    <section>
      {error && <div className="error-banner mb-3" role="alert"><p>{error}</p>
        <button type="button" className="mini-btn" disabled={loading} onClick={load}>Retry loading path</button>
      </div>}
      {allowance && <p className="cost-note mb-3" role="status">
        {allowance.free_left > 0 ? `${allowance.free_left} of ${allowance.daily_free} free Study Room messages left today` : 'Free messages used for today'}, then {allowance.cost_after_free} peppercorn each. Quizzes and What next are free.
      </p>}
      {unsupportedUnitFocus && <p className="error-banner" role="alert">This tiered Explain topic is not available in your active language. Choose a topic from your language path.</p>}
      {language === 'javascript' && !unsupportedUnitFocus && !collection && (mode === 'explain' || (mode === 'quiz' && focus?.startsWith('explain:'))) && <ExplainCourse language={language} focusId={focus} onFocus={handleFocus} onOpen={onOpen} assessmentOnly={mode === 'quiz'} />}
      {mode !== 'next' && !collection && node && <NodeCard key={node.id} node={node} language={language} levelLabel={path?.levels[node.level]} />}
      {mode === 'explain' && !collection && node && <ExplainPathway node={node} language={language} previous={path?.nodes[path.nodes.findIndex(n => n.id === node.id) - 1]} onOpen={onOpen} />}
      {mode === 'explain' && !collection && node && <TopicQuestionsSection key={`topic-questions-${node.id}`} node={node} language={language} onQuestionChange={setActiveQuestion} />}
      {path && !unsupportedUnitFocus && <>
      {mode === 'explain' && <ExplainMode {...shared} activeQuestion={node && !collection ? activeQuestion : undefined} />}
      {mode === 'debug' && <DebugMode key={resolvedFocus} {...shared} />}
      {mode === 'compare' && <CompareMode {...shared} languages={languages} />}
      {mode === 'quiz' && !collection && !focus?.startsWith('explain:') && <QuizMode language={language} focusId={focus} onComplete={load} />}
      {mode === 'quiz' && collection && <p className="island-shell rounded-xl p-4">Graded checks belong to path topics. Choose a topic in the sidebar to take its quiz.</p>}
      {mode === 'next' && <NextMode language={language} onOpen={onOpen} />}
      </>}
    </section>
  </div>
}
