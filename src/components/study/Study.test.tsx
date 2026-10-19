// Study Room components: path, focus card, the five modes and the workspace.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathNode, QuizItem, QuizResult, StudyPath, StudyReply } from '../../lib/studyApi'

const auth = vi.hoisted(() => ({ setBalance: vi.fn() }))
const study = vi.hoisted(() => ({
  fetchStudyPath: vi.fn(), fetchNodeLesson: vi.fn(), fetchAllowance: vi.fn(), sendStudyMessage: vi.fn(),
  resolveDebug: vi.fn(), startQuiz: vi.fn(), answerQuiz: vi.fn(), fetchQuizSummary: vi.fn(),
  fetchNextStep: vi.fn(), fetchStudyNotes: vi.fn(), fetchInsights: vi.fn(), fetchNextHint: vi.fn(),
}))
vi.mock('../../lib/studyApi', () => study)
vi.mock('../../lib/auth', () => ({ useAuth: () => auth }))
vi.mock('../../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, className }: { children: React.ReactNode; to: string; search?: Record<string, string>; className?: string }) =>
    <a className={className} href={`${to}${search ? '?' + new URLSearchParams(search).toString() : ''}`}>{children}</a>,
}))

import { CompareMode, DebugMode, ExplainMode } from './ConversationModes'
import { NextMode } from './NextMode'
import { NodeCard } from './NodeCard'
import { PathPanel } from './PathPanel'
import { QuizFeedback, QuizItemView, QuizMode } from './QuizMode'
import { RichText, splitBlocks } from './RichText'
import { StudyWorkspace } from './StudyWorkspace'

const node = (over: Partial<PathNode> = {}): PathNode => ({
  id: 'python:stage-01', kind: 'stage', stage: 1, order: 1, slug: 'values', title: 'Values and arithmetic', level: 'L1',
  exercise_id: 'python-path-01-values', lesson_ids: ['python-path-01-values'],
  practice: [{ id: 'missing-number', title: 'Missing Number', difficulty: 'Easy', role: 'apply' },
    { id: 'sum-of-two-integers', title: 'Sum of Two Integers', difficulty: 'Medium', role: 'stretch' }],
  planned_problems: ['Valid Anagram (Easy)'], checks_available: 6, available: true, exercise_passed: false,
  check_score: null, checks_passed: false, complete: false, status: 'not-started', ...over,
})

const path = (over: Partial<StudyPath> = {}): StudyPath => ({
  language: 'python', label: 'Python', current_id: 'python:stage-01', completed: 1, total: 16, completed_stages: [],
  mastery_rule: 'Pass the graded exercise and score at least 2 of 3 on the checks.',
  readiness: { language: 'python', label: 'Python', spine_stages: 12, spine_total: 12, depth_lessons: 8, depth_total: 8, quiz_items: 103, runner: true, verdict: 'launch-ready' },
  levels: { L1: 'Core constructs', L3: 'Recursion, complexity and depth' },
  nodes: [node(), node({ id: 'python:stage-02', stage: 2, title: 'Conditions', status: 'complete' }),
    node({ id: 'python:module-typing', kind: 'module', stage: null, title: 'Type hints', level: 'L3', status: 'unavailable', exercise_id: null, practice: [], planned_problems: [] })],
  ...over,
})

const allowance = { daily_free: 5, used_today: 1, free_left: 4, cost_after_free: 1 }
const reply = (over: Partial<StudyReply> = {}): StudyReply => ({
  answer: 'Answer text', thread_id: 't1', mode: 'explain', note_id: null, peppercorns_charged: 0,
  peppercorns_remaining: 50, allowance, focus: { kind: 'node', id: 'python:stage-01', title: 'Values and arithmetic', auto: true }, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  study.fetchAllowance.mockResolvedValue(allowance)
  study.fetchStudyPath.mockResolvedValue(path())
})
afterEach(cleanup)

describe('RichText', () => {
  it('renders pipe tables as tables and the rest as markdown', () => {
    const text = 'Intro **bold**\n| Aspect | Python | Java |\n|---|---|---|\n| syntax | `d[k]` | m.get(k) |\nWatch out: nulls.'
    expect(splitBlocks(text).map((b) => b.kind)).toEqual(['text', 'table', 'text'])
    expect(splitBlocks('| a |\n| b |').map((b) => b.kind)).toEqual(['table'])
    render(<RichText text={text} />)
    expect(screen.getByRole('columnheader', { name: 'Python' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'm.get(k)' })).toBeTruthy()
    expect(screen.getByText('d[k]').tagName).toBe('CODE')
    expect(screen.getByText('bold')).toBeTruthy()
  })
})

describe('PathPanel', () => {
  it('lists stages and modules with status and lets the learner focus a node', () => {
    const onFocus = vi.fn()
    render(<PathPanel path={path()} focusId="python:stage-01" onFocus={onFocus} />)
    expect(screen.getByText('1/16 nodes mastered')).toBeTruthy()
    expect(screen.getByText(/Full path with graded exercises/)).toBeTruthy()
    expect(screen.getByText(/1\. Values and arithmetic \(you are here\)/)).toBeTruthy()
    expect(screen.getByText('Python depth modules')).toBeTruthy()
    fireEvent.click(screen.getByText(/Type hints/))
    expect(onFocus).toHaveBeenCalledWith('python:module-typing')
  })

  it('describes every readiness verdict and omits an empty module list', () => {
    for (const [verdict, text] of [['quiz-led', /Quiz-led/], ['next-wave', /still being written/], ['needs-authoring', /Lessons only/]] as const) {
      const { unmount } = render(<PathPanel path={path({ readiness: { ...path().readiness, verdict }, nodes: [node()] })} focusId={null} onFocus={vi.fn()} />)
      expect(screen.getByText(text)).toBeTruthy()
      expect(screen.queryByText(/depth modules/)).toBeNull()
      unmount()
    }
  })
})

describe('NodeCard', () => {
  it('shows learn-then-practise steps and toggles the lesson', async () => {
    study.fetchNodeLesson.mockResolvedValueOnce({ markdown: '## Learn\nValues combine.' })
    render(<NodeCard node={node()} language="python" levelLabel="Core constructs" />)
    expect(screen.getByText('Stage 1 · L1 · Core constructs')).toBeTruthy()
    expect(screen.getByText(/Graded exercise: not passed yet. Checks: not taken \(6 questions/)).toBeTruthy()
    expect(screen.getByText('2. Practise: graded exercise').getAttribute('href')).toBe('/practice?problem=python-path-01-values&language=python')
    expect(screen.getByText('Sum of Two Integers · Medium · stretch')).toBeTruthy()
    expect(screen.getByText('Valid Anagram (Easy) · coming soon')).toBeTruthy()
    fireEvent.click(screen.getByText('1. Learn: read the lesson'))
    expect(await screen.findByText('Values combine.')).toBeTruthy()
    fireEvent.click(screen.getByText('Hide lesson'))
    expect(screen.queryByText('Values combine.')).toBeNull()
  })

  it('handles empty lessons, failures, modules and passed work', async () => {
    study.fetchNodeLesson.mockResolvedValueOnce({ markdown: '' }).mockRejectedValueOnce(new Error('Lesson unavailable'))
    const { unmount } = render(<NodeCard node={node({ exercise_passed: true, check_score: 0.67 })} language="python" />)
    expect(screen.getByText(/passed. Checks: 67%/)).toBeTruthy()
    fireEvent.click(screen.getByText('1. Learn: read the lesson'))
    expect(await screen.findByText('This lesson has no text yet.')).toBeTruthy()
    fireEvent.click(screen.getByText('Hide lesson'))
    fireEvent.click(screen.getByText('1. Learn: read the lesson'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    unmount()
    render(<NodeCard node={node({ kind: 'module', stage: null, exercise_id: null, checks_available: 0, practice: [], planned_problems: [], lesson_ids: [] })} language="python" />)
    expect(screen.getByText(/Depth module · L1/)).toBeTruthy()
    expect(screen.getByText('No checks for this node yet.')).toBeTruthy()
    expect((screen.getByText('1. Learn: read the lesson') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Problems at this level')).toBeNull()
  })
})

const shared = { language: 'python', provider: 'auto' as const, onAllowance: vi.fn() }

describe('Explain mode', () => {
  it('asks, shows the takeaway card and keeps the allowance in sync', async () => {
    study.sendStudyMessage.mockResolvedValueOnce(reply({ takeaway: { concept: 'Use get', example: 'd.get(k, 0)', pitfall: 'KeyError' } }))
      .mockResolvedValueOnce(reply({ peppercorns_charged: 1, focus: { kind: 'node', id: 'x', title: 'X', auto: false } }))
      .mockRejectedValueOnce(new Error('Not enough peppercorns'))
    render(<ExplainMode {...shared} />)
    expect(screen.getByText(/takeaway card saved to your notes/)).toBeTruthy()
    const input = screen.getByLabelText('Your question')
    fireEvent.change(input, { target: { value: 'Why KeyError?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Takeaway saved to your notes')).toBeTruthy()
    expect(screen.getByText('d.get(k, 0)')).toBeTruthy()
    expect(screen.getByText(/Focused on Values and arithmetic/)).toBeTruthy()
    expect(screen.getByText('Free · 4 free left today.')).toBeTruthy()
    expect(auth.setBalance).toHaveBeenCalledWith(50)
    expect(shared.onAllowance).toHaveBeenCalledWith(allowance)
    expect(study.sendStudyMessage).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'explain', message: 'Why KeyError?', threadId: undefined }))
    fireEvent.change(input, { target: { value: 'More?' } })
    fireEvent.click(screen.getByText('Ask'))
    expect(await screen.findByText('Cost 1 peppercorn.')).toBeTruthy()
    expect(study.sendStudyMessage).toHaveBeenLastCalledWith(expect.objectContaining({ threadId: 't1' }))
    fireEvent.change(input, { target: { value: 'Again' } })
    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.click(screen.getByText('Ask'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Again')
  })

  it('ignores empty questions', () => {
    render(<ExplainMode {...shared} />)
    fireEvent.keyDown(screen.getByLabelText('Your question'), { key: 'Enter' })
    expect(study.sendStudyMessage).not.toHaveBeenCalled()
  })
})

describe('Debug mode', () => {
  it('needs code, error and reasoning, climbs tiers and logs the misconception', async () => {
    study.sendStudyMessage.mockResolvedValueOnce(reply({ mode: 'debug', answer: 'What does range(n) give?', hint_tier: 1, tier_label: 'Orient' }))
      .mockResolvedValueOnce(reply({ mode: 'debug', answer: 'Which line differs?', hint_tier: 2, tier_label: 'Probe the gap', peppercorns_charged: 2 }))
    study.resolveDebug.mockRejectedValueOnce(new Error('Debug conversation not found')).mockResolvedValueOnce({ id: 'n1' })
    render(<DebugMode {...shared} />)
    const go = screen.getByText('Debug with me') as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Your code'), { target: { value: 'for i in range(n): total += i' } })
    fireEvent.change(screen.getByLabelText('The actual error or wrong output'), { target: { value: 'got 3, expected 6' } })
    fireEvent.change(screen.getByLabelText('What do you think is happening?'), { target: { value: 'loop bounds' } })
    fireEvent.click(go)
    expect(await screen.findByText('What does range(n) give?')).toBeTruthy()
    expect(screen.getByText('Coach · hint 1/4 · Orient')).toBeTruthy()
    expect(study.sendStudyMessage).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'debug', code: 'for i in range(n): total += i', error: 'got 3, expected 6' }))
    fireEvent.change(screen.getByLabelText('What do you think now?'), { target: { value: 'it stops early' } })
    fireEvent.click(screen.getByText('I need another question'))
    expect(await screen.findByText('Coach · hint 2/4 · Probe the gap')).toBeTruthy()
    expect(screen.getByText('Cost 2 peppercorns.')).toBeTruthy()
    const fix = screen.getByLabelText('Fixed it? Say what was wrong in your own words')
    fireEvent.click(screen.getByText('I fixed it'))
    expect(study.resolveDebug).not.toHaveBeenCalled()
    fireEvent.change(fix, { target: { value: 'range stops before n' } })
    fireEvent.click(screen.getByText('I fixed it'))
    expect(await screen.findByText('Debug conversation not found')).toBeTruthy()
    fireEvent.change(fix, { target: { value: 'range stops before n' } })
    fireEvent.click(screen.getByText('I fixed it'))
    expect(await screen.findByText(/Misconception logged in your notes: “range stops before n”/)).toBeTruthy()
    expect(study.resolveDebug).toHaveBeenLastCalledWith('t1', 'range stops before n')
  })

  it('keeps the reasoning when the request fails', async () => {
    study.sendStudyMessage.mockRejectedValueOnce(new Error('Paste your code'))
    render(<DebugMode {...shared} />)
    fireEvent.change(screen.getByLabelText('Your code'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('The actual error or wrong output'), { target: { value: 'y' } })
    fireEvent.change(screen.getByLabelText('What do you think is happening?'), { target: { value: 'z' } })
    fireEvent.click(screen.getByText('Debug with me'))
    expect(await screen.findByText('Paste your code')).toBeTruthy()
    expect((screen.getByLabelText('What do you think is happening?') as HTMLTextAreaElement).value).toBe('z')
  })
})

describe('Compare mode', () => {
  it('explains that a second language is needed', () => {
    render(<CompareMode {...shared} languages={['python']} />)
    expect(screen.getByText(/needs a second language/)).toBeTruthy()
  })

  it('compares with the chosen language and renders the table', async () => {
    study.sendStudyMessage.mockResolvedValueOnce(reply({ mode: 'compare', answer: '| Aspect | python | java |\n|---|---|---|\n| equality | == | equals |', focus: { kind: 'node', id: 'a', title: 'A', auto: false } }))
      .mockRejectedValueOnce(new Error('Choose a second language'))
    render(<CompareMode {...shared} languages={['python', 'java', 'rust']} />)
    fireEvent.change(screen.getByLabelText(/Compare Python with/), { target: { value: 'rust' } })
    fireEvent.change(screen.getByLabelText(/Compare Python with/), { target: { value: 'java' } })
    const input = screen.getByLabelText('What to compare')
    fireEvent.change(input, { target: { value: 'equality' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('cell', { name: 'equals' })).toBeTruthy()
    expect(study.sendStudyMessage).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'compare', compareLanguage: 'java' }))
    expect(screen.getByText(/Saved to your notes/)).toBeTruthy()
    fireEvent.change(input, { target: { value: 'again' } })
    fireEvent.keyDown(input, { key: 'x' })
    fireEvent.click(screen.getByText('Compare'))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('falls back to a valid second language when the list changes', () => {
    const { rerender } = render(<CompareMode {...shared} languages={['python', 'java']} />)
    rerender(<CompareMode {...shared} languages={['python', 'rust']} />)
    expect((screen.getByLabelText(/Compare Python with/) as HTMLSelectElement).value).toBe('rust')
  })
})

const quizItems: QuizItem[] = [
  { id: 'q1', type: 'mcq', prompt: 'Pick one', concept: 'c1', source: 'authored', level: 'L1', choices: ['A', 'B'] },
  { id: 'q2', type: 'mcq_code', prompt: 'What prints?', concept: 'c2', source: 'authored', level: null, code: 'print(1)', choices: ['1', '2'] },
  { id: 'q3', type: 'short_answer', prompt: 'Type it', concept: 'c3', source: 'knowledge-base', level: 'L2', code: 'print(2)' },
  { id: 'q4', type: 'explain', prompt: 'Explain', concept: 'c4', source: 'authored', level: 'L1' },
  { id: 'q5', type: 'fix_bug', prompt: 'Fix it', concept: 'c5', source: 'authored', level: 'L1', code: 'def f(): return 1', language: 'python', function: 'f', test_count: 6 },
  { id: 'q6', type: 'write_snippet', prompt: 'Write it', concept: 'c6', source: 'authored', level: 'L1', starter: 'def g():\n    pass', language: 'python', function: 'g', test_count: 6 },
]
const graded = (over: Partial<QuizResult> = {}): QuizResult => ({
  item_id: 'q1', correct: true, score: 1, grading: 'choice', feedback: 'Correct.', expected: 'A', explanation: 'Because.',
  answered: 1, total: 6, complete: false, rewards: [], ...over,
})

describe('Quiz mode', () => {
  it('runs a mixed-format quiz to its summary', async () => {
    study.startQuiz.mockResolvedValue({ quiz_id: 'quiz1', node_id: 'python:stage-01', node_title: 'Values', total: 6, items: quizItems })
    study.answerQuiz
      .mockResolvedValueOnce(graded())
      .mockResolvedValueOnce(graded({ item_id: 'q2', correct: false, score: 0, feedback: 'Not quite.' }))
      .mockResolvedValueOnce(graded({ item_id: 'q3', grading: 'exact' }))
      .mockResolvedValueOnce(graded({ item_id: 'q4', correct: false, score: 0.5, grading: 'keywords', misconception: 'defaults are per call' }))
      .mockResolvedValueOnce(graded({ item_id: 'q5', correct: false, score: 0, grading: 'tests', tests: { status: 'failed', passed: 2, total: 6, first_failure: { case: 3, args: [7, 2], expected: 3, got: 3.5, detail: '' } } }))
      .mockResolvedValueOnce(graded({ item_id: 'q6', grading: 'tests', complete: true, rewards: [{ key: 'stage:python:1', amount: 10, reason: 'earn:stage', balance: 60 }, { key: 'streak:x', amount: 5, reason: 'earn:streak', balance: 65 }] }))
    const onComplete = vi.fn()
    render(<QuizMode language="python" focusId="python:stage-01" onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText('Questions'), { target: { value: '5' } })
    fireEvent.click(screen.getByText('Start quiz'))
    expect(await screen.findByText('Values · question 1 of 6')).toBeTruthy()
    expect(study.startQuiz).toHaveBeenCalledWith('python', 'python:stage-01', 5)
    const next = () => fireEvent.click(screen.getByText('Next question'))
    fireEvent.click(screen.getByLabelText('B'))
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Correct')).toBeTruthy()
    expect(study.answerQuiz).toHaveBeenLastCalledWith('quiz1', 'q1', 1)
    next()
    expect(screen.getByText('print(1)')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('1'))
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Not yet')).toBeTruthy()
    next()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '2' } })
    fireEvent.click(screen.getByText('Check answer'))
    await screen.findByText('Model answer')
    next()
    fireEvent.change(screen.getByLabelText('Your explanation'), { target: { value: 'My words' } })
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Partly right (50%)')).toBeTruthy()
    expect(screen.getByText('What your answer suggests: defaults are per call')).toBeTruthy()
    expect(screen.getByText(/treat this score as approximate/)).toBeTruthy()
    next()
    expect((screen.getByLabelText('Your code') as HTMLTextAreaElement).value).toBe('def f(): return 1')
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Test 3: input [7,2] expected 3, got 3.5')).toBeTruthy()
    expect(screen.getByText('Reference solution')).toBeTruthy()
    next()
    expect((screen.getByLabelText('Your code') as HTMLTextAreaElement).value).toBe('def g():\n    pass')
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByLabelText('Quiz summary')).toBeTruthy()
    expect(screen.getByText(/Score: 58% \(3 of 6 correct\)/)).toBeTruthy()
    expect(screen.getByText('Score at least 2 of 3 to master this node.')).toBeTruthy()
    expect(screen.getByText('Concepts to review: c2, c4, c5')).toBeTruthy()
    expect(screen.getByText('+10 peppercorns: stage completed')).toBeTruthy()
    expect(screen.getByText('+5 peppercorns: streak')).toBeTruthy()
    expect(auth.setBalance).toHaveBeenLastCalledWith(65)
    expect(onComplete).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Another quiz'))
    await waitFor(() => expect(study.startQuiz).toHaveBeenCalledTimes(2))
  })

  it('reports start and answer errors and a mastered quiz', async () => {
    study.startQuiz.mockRejectedValueOnce(new Error('No quiz items yet'))
      .mockResolvedValueOnce({ quiz_id: 'quiz2', node_id: 'n', node_title: 'N', total: 1, items: [quizItems[0]] })
    study.answerQuiz.mockRejectedValueOnce(new Error('Choose one of the listed options.'))
      .mockResolvedValueOnce(graded({ complete: true, total: 1 }))
    render(<QuizMode language="python" />)
    fireEvent.click(screen.getByText('Start quiz'))
    expect(await screen.findByText('No quiz items yet')).toBeTruthy()
    fireEvent.click(screen.getByText('Start quiz'))
    await screen.findByText('N · question 1 of 1')
    fireEvent.click(screen.getByLabelText('A'))
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Choose one of the listed options.')).toBeTruthy()
    fireEvent.click(screen.getByText('Check answer'))
    expect(await screen.findByText('Checks mastered for this node.')).toBeTruthy()
  })

  it('does not submit an empty response', () => {
    const onAnswer = vi.fn()
    render(<QuizItemView item={quizItems[2]} busy={false} onAnswer={onAnswer} />)
    fireEvent.submit(screen.getByText('Check answer').closest('form')!)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('shows model-graded feedback without the approximation note', () => {
    render(<QuizFeedback result={graded({ grading: 'rubric-model', explanation: '' })} />)
    expect(screen.queryByText(/approximate/)).toBeNull()
  })
})

describe('What next', () => {
  it('recommends an in-page step and shows weak spots and notes', async () => {
    study.fetchNextStep.mockResolvedValue({ kind: 'quiz', id: 'python:stage-02', title: 'Review quiz: Conditions', reason: 'You missed booleans.', node_id: 'python:stage-02', link: { to: '/chat', search: { mode: 'quiz', focus: 'python:stage-02' } } })
    study.fetchInsights.mockResolvedValue({
      weak_concepts: [{ concept: 'boundaries', misses: 2, correct: 0, misconception: 'thinks < is inclusive' }, { concept: 'x', misses: 1, correct: 0, misconception: '' }],
      responses: [{ item_id: 'i', prompt: 'Which operators?', response: 'Use <', correct: false, score: 0, feedback: 'Inclusive needs <=', misconception: '', created_at: 't' },
        { item_id: 'j', prompt: 'Why?', response: 'Because', correct: true, score: 1, feedback: '', misconception: '', created_at: 't2' }],
    })
    study.fetchStudyNotes.mockResolvedValue([
      { id: '1', language: 'python', node_id: null, mode: 'explain', title: 'Use get', body: { concept: 'Use get', example: 'd.get(k, 0)', pitfall: 'KeyError' }, created_at: '' },
      { id: '2', language: 'python', node_id: null, mode: 'debug', title: 'Misconception logged', body: { my_fix: 'range(1, n + 1)' }, created_at: '' },
      { id: '3', language: 'python', node_id: null, mode: 'compare', title: 'py vs js', body: { first: 'python', second: 'javascript', question: 'maps', comparison: '| a |\nWatch out: undefined is not an error.' }, created_at: '' },
      { id: '4', language: 'python', node_id: null, mode: 'compare', title: 'older', body: { first: 'python', second: 'javascript', question: 'q' }, created_at: '' },
    ])
    const onOpen = vi.fn()
    render(<NextMode language="python" onOpen={onOpen} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('Review quiz: Conditions')).toBeTruthy()
    fireEvent.click(screen.getByText('Start'))
    expect(onOpen).toHaveBeenCalledWith('quiz', 'python:stage-02')
    expect(screen.getByText(/missed 2 times. Your answers suggest: thinks < is inclusive/)).toBeTruthy()
    expect(screen.getByText(/missed 1 time$/)).toBeTruthy()
    expect(screen.getByText('Inclusive needs <=')).toBeTruthy()
    expect(screen.getByText('Solid.')).toBeTruthy()
    expect(screen.getByText(/Example: d.get\(k, 0\) · Pitfall: KeyError/)).toBeTruthy()
    expect(screen.getByText(/My fix: range\(1, n \+ 1\)/)).toBeTruthy()
    expect(screen.getByText(/Watch out: undefined is not an error/)).toBeTruthy()
    expect(screen.getByText(/Side-by-side comparison saved/)).toBeTruthy()
  })

  it('links practice steps out of the Study Room and handles empty and failed loads', async () => {
    study.fetchNextStep.mockResolvedValueOnce({ kind: 'exercise', id: 'python-path-01-values', title: 'Exercise', reason: 'Pass it.', node_id: 'n', link: { to: '/practice', search: { problem: 'python-path-01-values' } } })
      .mockResolvedValueOnce({ kind: 'done', id: null, title: 'Path complete', reason: 'Done.', node_id: null, link: null })
      .mockRejectedValueOnce(new Error('Next step unavailable'))
    study.fetchInsights.mockResolvedValue({ weak_concepts: [], responses: [] })
    study.fetchStudyNotes.mockResolvedValue([])
    const first = render(<NextMode language="python" onOpen={vi.fn()} />)
    expect((await screen.findByText('Open in practice')).getAttribute('href')).toBe('/practice?problem=python-path-01-values&language=python')
    expect(screen.getByText(/Takeaway cards, logged misconceptions/)).toBeTruthy()
    expect(screen.queryByLabelText('How you are thinking')).toBeNull()
    first.unmount()
    const second = render(<NextMode language="python" onOpen={vi.fn()} />)
    expect(await screen.findByText('Path complete')).toBeTruthy()
    expect(screen.queryByText('Start')).toBeNull()
    second.unmount()
    render(<NextMode language="python" onOpen={vi.fn()} />)
    expect(await screen.findByText('Next step unavailable')).toBeTruthy()
  })

  it('ignores results that arrive after unmounting', async () => {
    let resolve: (v: unknown) => void = () => {}
    let reject: (e: Error) => void = () => {}
    study.fetchNextStep.mockReturnValueOnce(new Promise((r) => { resolve = r })).mockReturnValueOnce(new Promise((_, r) => { reject = r }))
    study.fetchInsights.mockResolvedValue({ weak_concepts: [], responses: [] })
    study.fetchStudyNotes.mockResolvedValue([])
    render(<NextMode language="python" onOpen={vi.fn()} />).unmount()
    render(<NextMode language="python" onOpen={vi.fn()} />).unmount()
    await act(async () => { resolve({ kind: 'done', link: null }); reject(new Error('late')) })
  })
})

describe('StudyWorkspace', () => {
  const props = { language: 'python', languages: ['python', 'java'], provider: 'auto' as const, onFocus: vi.fn(), onOpen: vi.fn() }

  it('shows the path, the focused node and the allowance for each mode', async () => {
    const { rerender } = render(<StudyWorkspace {...props} mode="explain" />)
    expect(screen.getByText('Loading your path…')).toBeTruthy()
    expect(await screen.findByText('4 of 5 free Study Room messages left today', { exact: false })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Values and arithmetic' })).toBeTruthy()
    expect(screen.getByLabelText('Your question')).toBeTruthy()
    rerender(<StudyWorkspace {...props} mode="debug" focus="python:stage-02" />)
    expect(screen.getByRole('heading', { name: 'Conditions' })).toBeTruthy()
    expect(screen.getByLabelText('Your code')).toBeTruthy()
    rerender(<StudyWorkspace {...props} mode="compare" />)
    expect(screen.getByLabelText(/Compare Python with/)).toBeTruthy()
    rerender(<StudyWorkspace {...props} mode="quiz" />)
    expect(screen.getByText('Start quiz')).toBeTruthy()
    study.fetchNextStep.mockResolvedValue({ kind: 'done', id: null, title: 'Path complete', reason: '', node_id: null, link: null })
    study.fetchInsights.mockResolvedValue({ weak_concepts: [], responses: [] })
    study.fetchStudyNotes.mockResolvedValue([])
    rerender(<StudyWorkspace {...props} mode="next" />)
    expect(await screen.findByText('Path complete')).toBeTruthy()
  })

  it('reports a failed path load and an exhausted free pool', async () => {
    study.fetchStudyPath.mockRejectedValueOnce(new Error('Subscription required'))
    study.fetchAllowance.mockResolvedValueOnce({ daily_free: 5, used_today: 5, free_left: 0, cost_after_free: 1 })
    render(<StudyWorkspace {...props} mode="explain" />)
    expect(await screen.findByText('Subscription required')).toBeTruthy()
    expect(screen.getByText('Your path could not be loaded.')).toBeTruthy()
    expect(await screen.findByText(/Free messages used for today/)).toBeTruthy()
  })

  it('hides the allowance when it cannot be loaded and ignores late path results', async () => {
    let resolve: (v: StudyPath) => void = () => {}
    let reject: (e: Error) => void = () => {}
    study.fetchStudyPath.mockReturnValueOnce(new Promise((r) => { resolve = r })).mockReturnValueOnce(new Promise((_, r) => { reject = r }))
    study.fetchAllowance.mockRejectedValue(new Error('down'))
    render(<StudyWorkspace {...props} mode="explain" />).unmount()
    render(<StudyWorkspace {...props} mode="explain" />).unmount()
    await act(async () => { resolve(path()); reject(new Error('late')) })
    render(<StudyWorkspace {...props} mode="explain" />)
    await waitFor(() => expect(study.fetchAllowance).toHaveBeenCalledTimes(3))
    expect(screen.queryByText(/free Study Room messages/)).toBeNull()
  })
})
