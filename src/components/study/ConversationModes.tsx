// Explain, Debug with me and Compare languages: Study Room modes that talk to
// the coach. Each one keeps its own thread and reports the free allowance.
import { useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { LANGUAGE_LABELS } from '../../lib/languageAccess'
import { resolveDebug, sendStudyMessage, type Allowance, type MessageMode, type StudyReply } from '../../lib/studyApi'
import type { ChatProvider } from '../../types'
import { RichText } from './RichText'
import { DebugChallenges } from './DebugChallenges'
import type { DebugChallenge } from '../../lib/studyApi'

interface Turn { id: string; question: string; reply: StudyReply }

interface Shared {
  language: string
  focusId?: string
  focusTitle?: string
  provider: ChatProvider
  onAllowance: (allowance: Allowance) => void
}

function useStudyThread(mode: MessageMode, { language, focusId, provider, onAllowance }: Shared, context?: string) {
  const { setBalance } = useAuth()
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadId = turns.at(-1)?.reply.thread_id
  const session = useRef(0)
  useEffect(() => {
    session.current += 1
    setTurns([]); setError(null); setLoading(false)
    return () => { session.current += 1 }
  }, [language, focusId, mode, context])
  const send = async (message: string, extra: { code?: string; error?: string; compareLanguage?: string; focusId?: string } = {}) => {
    const requestSession = session.current
    setLoading(true); setError(null)
    let sent = false
    try {
      const reply = await sendStudyMessage({ language, mode, message, threadId, focusId: focusId ?? turns[0]?.reply.focus.id ?? undefined, provider, ...extra })
      if (requestSession !== session.current) return false
      setTurns((prev) => [...prev, { id: crypto.randomUUID(), question: message, reply }])
      setBalance(reply.peppercorns_remaining)
      onAllowance(reply.allowance)
      sent = true
    } catch (err) {
      if (requestSession !== session.current) return false
      setError(getApiErrorMessage(err))
    }
    if (requestSession === session.current) setLoading(false)
    return sent
  }
  const reset = () => {
    session.current += 1
    setTurns([]); setError(null); setLoading(false)
  }
  return { turns, loading, error, send, threadId, reset }
}

const charge = (reply: StudyReply) => reply.peppercorns_charged
  ? `Cost ${reply.peppercorns_charged} peppercorn${reply.peppercorns_charged === 1 ? '' : 's'}.`
  : `Free · ${reply.allowance.free_left} free left today.`

function FocusNote({ reply }: { reply: StudyReply }) {
  return reply.focus.auto
    ? <p className="m-0 mb-1 text-xs text-[var(--sea-ink-soft)]">Focused on {reply.focus.title}, your next unfinished step.</p>
    : null
}

export interface ExplainProps extends Shared {
  activeQuestion?: string
}

export function ExplainMode(props: ExplainProps) {
  const thread = useStudyThread('explain', props)
  const [input, setInput] = useState('')
  useEffect(() => { setInput('') }, [props.language, props.focusId])
  const submit = async () => {
    const text = input.trim()
    if (!text || thread.loading) return
    // The shown reflection question is not otherwise visible to the coach, so
    // an answer to it must carry the question with it.
    const framed = props.activeQuestion ? `Topic question under discussion: ${props.activeQuestion}\n\nMy message: ${text}` : text
    if (await thread.send(framed.length <= 4000 ? framed : text)) setInput('')
  }
  return <div className="chat-container island-shell">
    <div className="border-b border-[var(--line)] p-4">
      <h2 className="m-0 font-bold">Understand {props.focusTitle ?? 'the current concept'}</h2>
      <p className="mt-2 text-sm">Learn the idea, walk through a small correct example, and ask why it works. Each answer saves a takeaway and a common pitfall to your notes. Reflection here does not award a pass; Quiz me and graded exercises provide assessment checkpoints.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="mini-btn" onClick={() => setInput(`Explain ${props.focusTitle ?? 'this concept'} step by step with a small worked example.`)}>Walk through an example</button>
        <button type="button" className="mini-btn" onClick={() => setInput(`What is the mental model behind ${props.focusTitle ?? 'this concept'}, and when should I use it?`)}>Explain the mental model</button>
      </div>
    </div>
    <div className="messages" aria-live="polite">
      {thread.turns.length === 0 && <p className="py-6 text-center text-sm text-[var(--sea-ink-soft)]">
        {props.activeQuestion
          ? 'Type your answer to the topic question above in the input below, or ask any doubts about this concept.'
          : 'Ask about the concept you are learning. Every answer ends with a takeaway card saved to your notes.'}
      </p>}
      {thread.turns.map((turn) => <div key={turn.id} className="mentor-turn">
        <div className="mentor-you"><span className="mentor-label">You</span><p>{turn.question}</p></div>
        <div className="mentor-reply"><span className="mentor-label">Coach</span><FocusNote reply={turn.reply} /><RichText text={turn.reply.answer} />
          {turn.reply.takeaway && <div className="recall-card" aria-label="Takeaway card">
            <span className="recall-label">Takeaway saved to your notes</span>
            <p><strong>Concept:</strong> {turn.reply.takeaway.concept}</p>
            <p><strong>Example:</strong> <code>{turn.reply.takeaway.example}</code></p>
            <p><strong>Pitfall:</strong> {turn.reply.takeaway.pitfall}</p>
          </div>}
          <p className="cost-note">{charge(turn.reply)}</p>
        </div>
      </div>)}
      {thread.loading && <div className="typing-indicator">Thinking…</div>}
    </div>
    {thread.error && <div className="error-banner" role="alert">{thread.error}</div>}
    <div className="input-bar">
      <input aria-label="Your question" value={input} onChange={(e) => setInput(e.target.value)} disabled={thread.loading}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
        placeholder={props.activeQuestion ? "Answer the question above, or ask any doubts..." : "e.g. Why did this value change after the function call?"} />
      <button type="button" onClick={() => void submit()} disabled={thread.loading || !input.trim()}>
        {props.activeQuestion ? 'Send Answer / Ask' : 'Ask'}
      </button>
    </div>
  </div>
}

export function DebugMode(props: Shared) {
  const [challengeId, setChallengeId] = useState<string | undefined>()
  const thread = useStudyThread('debug', props, challengeId)
  const [code, setCode] = useState('')
  const [failure, setFailure] = useState('')
  const [thinking, setThinking] = useState('')
  const [fix, setFix] = useState('')
  const [logged, setLogged] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const resolutionSession = useRef(0)
  useEffect(() => {
    setLogged(null); setResolveError(null); setFix(''); setCode(''); setFailure(''); setThinking(''); setChallengeId(undefined)
    resolutionSession.current += 1
    return () => { resolutionSession.current += 1 }
  }, [props.language, props.focusId])
  const selectChallenge = (challenge: DebugChallenge | null) => {
    thread.reset()
    setChallengeId(challenge?.attempt_id)
    setCode(challenge?.code ?? ''); setFailure(challenge?.failure ?? '')
    setThinking(''); setFix(''); setLogged(null); setResolveError(null)
    resolutionSession.current += 1
  }
  const latest = thread.turns.at(-1)?.reply
  const ready = code.trim() && failure.trim() && thinking.trim()
  // The button is disabled until code, error and reasoning are filled in.
  const submit = async () => {
    if (await thread.send(thinking.trim(), { code, error: failure, ...(challengeId ? { focusId: 'debug:' + challengeId } : {}) })) setThinking('')
  }
  const resolve = async () => {
    // Only shown after the first reply (so the thread exists) and enabled once a fix is typed.
    const requestSession = resolutionSession.current
    setResolveError(null)
    try {
      await resolveDebug(thread.threadId!, fix.trim())
      if (requestSession !== resolutionSession.current) return
      setLogged(fix.trim()); setFix('')
    } catch (err) {
      if (requestSession === resolutionSession.current) setResolveError(getApiErrorMessage(err))
    }
  }
  return <section className="island-shell rounded-2xl p-4">
    <DebugChallenges language={props.language} focusId={props.focusId} onSelect={selectChallenge} />
    <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">Paste your code and the actual error. I will ask questions, one at a time, using the same hint ladder as the mentor. I will not write the fix for you.</p>
    <label className="selector block"><span className="selector-label">Your code</span>
      <textarea className="train-textarea font-mono" rows={8} value={code} onChange={(e) => setCode(e.target.value)} /></label>
    <label className="selector mt-2 block"><span className="selector-label">The actual error or wrong output</span>
      <textarea className="train-textarea font-mono" rows={3} value={failure} onChange={(e) => setFailure(e.target.value)} /></label>
    {thread.turns.length > 0 && <div className="mentor-thread my-3">
      {thread.turns.map((turn) => <div key={turn.id} className="mentor-turn">
        <div className="mentor-you"><span className="mentor-label">You</span><p>{turn.question}</p></div>
        <div className="mentor-reply"><span className="mentor-label">Coach · hint {turn.reply.hint_tier}/4 · {turn.reply.tier_label}</span>
          <FocusNote reply={turn.reply} /><p>{turn.reply.answer}</p><p className="cost-note">{charge(turn.reply)}</p></div>
      </div>)}
    </div>}
    <label className="selector mt-2 block"><span className="selector-label">{latest ? 'What do you think now?' : 'What do you think is happening?'}</span>
      <textarea className="train-textarea" rows={2} value={thinking} onChange={(e) => setThinking(e.target.value)} /></label>
    {thread.error && <div className="error-banner mt-2" role="alert">{thread.error}</div>}
    <button type="button" className="primary-btn mt-2" onClick={() => void submit()} disabled={!ready || thread.loading}>
      {thread.loading ? 'Thinking with you…' : latest ? 'I need another question' : 'Debug with me'}</button>
    {latest && <div className="step-back mt-4">
      <label className="selector block"><span className="selector-label">Fixed it? Say what was wrong in your own words</span>
        <textarea className="train-textarea" rows={2} value={fix} onChange={(e) => setFix(e.target.value)} /></label>
      <button type="button" className="mini-btn mt-2" onClick={() => void resolve()} disabled={!fix.trim()}>I fixed it</button>
      {resolveError && <div className="error-banner mt-2" role="alert">{resolveError}</div>}
      {logged && <p className="mt-2 text-sm" role="status">Misconception logged in your notes: “{logged}”</p>}
    </div>}
  </section>
}

export function CompareMode(props: Shared & { languages: string[] }) {
  const others = ['javascript', 'typescript'].includes(props.language) ? props.languages.filter((l) => ['javascript', 'typescript'].includes(l) && l !== props.language) : []
  const [selected, setSecond] = useState(others[0] ?? '')
  const second = others.includes(selected) ? selected : others[0] ?? ''
  const thread = useStudyThread('compare', props, second)
  const [question, setQuestion] = useState('')
  useEffect(() => { setQuestion('') }, [props.language, props.focusId, second])
  const submit = async () => {
    // The input is disabled while a comparison is running.
    if (!question.trim() || thread.loading) return
    if (await thread.send(question.trim(), { compareLanguage: second })) setQuestion('')
  }
  if (!others.length) return <section className="island-shell rounded-2xl p-4">
    <p className="m-0">This optional transfer guide is available only for JavaScript and TypeScript, with access to both languages. Use Explain for your selected language.</p>
  </section>
  return <section className="island-shell rounded-2xl p-4">
    <h2 className="m-0 font-bold">JavaScript vs TypeScript</h2>
    <p className="my-2 text-sm">Compare {props.focusTitle ?? 'the current topic'} through the same example: runtime behavior, static types, narrowing, and migration mistakes. This optional reference does not introduce a new exercise or change your progress.</p>
    <button type="button" className="mini-btn mb-3" disabled={thread.loading} onClick={() => setQuestion(`Compare ${props.focusTitle ?? 'the current concept'} in both languages using the same small example and highlight the main transfer trap.`)}>Compare the current topic</button>
    <div className="controls mb-3">
      <label className="selector"><span className="selector-label">Compare {LANGUAGE_LABELS[props.language] ?? props.language} with</span>
        <select value={second} onChange={(e) => setSecond(e.target.value)}>
          {others.map((l) => <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>)}
        </select></label>
    </div>
    {thread.turns.map((turn) => <article key={turn.id} className="mb-4">
      <p className="m-0 font-semibold">{turn.question}</p>
      <FocusNote reply={turn.reply} />
      <RichText text={turn.reply.answer} />
      <p className="cost-note">Saved to your notes. {charge(turn.reply)}</p>
    </article>)}
    {thread.error && <div className="error-banner mb-2" role="alert">{thread.error}</div>}
    <div className="input-bar">
      <input aria-label="What to compare" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={thread.loading}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} placeholder="e.g. How do maps handle a missing key?" />
      <button type="button" onClick={() => void submit()} disabled={thread.loading || !question.trim()}>{thread.loading ? 'Comparing…' : 'Compare'}</button>
    </div>
  </section>
}
