// The P2 practice workspace: server drafts, autosave conflicts, test runs and
// diagnostics, checkpoints, reset, multi-file submission, focus mode, the
// configured reveal requirement and session summaries.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { PracticeWorkspace } from './practice'
import { practiceAction, startPractice } from '../lib/api'
import {
  createCheckpoint, fetchSessionSummary, openWorkspace, resetWorkspace, restoreCheckpoint,
  runWorkspaceTests, saveWorkspace, type WorkspaceState,
} from '../lib/workspaceApi'

vi.mock('../lib/api', () => ({
  fetchTrackItems: vi.fn().mockResolvedValue([]),
  fetchSolutionAccess: vi.fn().mockResolvedValue(false),
  revealSolution: vi.fn(),
  practiceAction: vi.fn(),
  startPractice: vi.fn(),
  fetchPractice: vi.fn(),
  getApiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))
vi.mock('../lib/workspaceApi', () => ({
  openWorkspace: vi.fn(), saveWorkspace: vi.fn(), resetWorkspace: vi.fn(), createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(), deleteCheckpoint: vi.fn(), runWorkspaceTests: vi.fn(), fetchSessionSummary: vi.fn(),
}))
vi.mock('../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ setBalance: vi.fn(), user: { id: 'u' } }) }))
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { ariaLabel: string } }) => (
    <textarea aria-label={options.ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('../components/ProblemStatement', () => ({ ProblemStatement: () => <p>Problem statement</p> }))
vi.mock('../components/MentorPanel', () => ({ MentorPanel: () => <p>Mentor</p> }))
vi.mock('../components/AnalysisPanel', () => ({ AnalysisPanel: () => <p>Evaluation feedback</p> }))
vi.mock('../components/EvidencePanel', () => ({ EvidencePanel: () => null }))

const SOLUTION = 'def total_cost(p, q):\n    return p * q\n'
const state = (overrides: Partial<WorkspaceState> = {}): WorkspaceState => ({
  problem_id: 'python-path-01-values',
  language: 'python',
  draft: { files: [{ name: 'solution.py', content: SOLUTION }], entry: 'solution.py', template: 'single', revision: 4, updated_at: null },
  templates: [
    { id: 'single', title: 'Single file', description: 'One solution file.' },
    { id: 'helpers', title: 'Solution and helpers', description: 'Split helpers out.' },
  ],
  multi_file: true,
  checkpoints: [{ id: 'c1', kind: 'manual', label: 'Working', entry: 'solution.py', created_at: '2026-10-20T10:00:00Z', file_names: ['solution.py'] }],
  progress: { test_runs: 2, evaluations: 1, attempts: 1, solved: false, hints: 1, highest_hint_tier: 2, reflections: 0, best_result: { passed: 4, total: 6 }, last_activity: null },
  reveal: { policy: 'after_pass', min_evaluations: 1, requirement: 'Pass every test in an evaluation to unlock the reference solution.', has_solution: true, available: false },
  limits: { max_files: 8, max_total_chars: 20000, runs_per_hour: 120 },
  ...overrides,
})

const reply = { session_id: 's1', awaiting: 'learner' as const, outcome: '', reply: '', analysis: null, evidence: null, hint_tier: 0, tier_label: '', step_back: null, peppercorns_remaining: 45 }

afterEach(() => { cleanup(); document.body.classList.remove('practice-focus') })
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.mocked(openWorkspace).mockResolvedValue(state())
  vi.mocked(saveWorkspace).mockResolvedValue({ revision: 5, updated_at: '2026-10-25T00:00:00Z' })
  vi.mocked(startPractice).mockResolvedValue(reply)
  vi.mocked(practiceAction).mockResolvedValue(reply)
})

const show = () => render(<PracticeWorkspace problemId="python-path-01-values" language="python" />)
const editor = (name = 'solution.py') => screen.findByRole('textbox', { name: `${name} editor` })
// The editor renders before the draft arrives; wait for the loaded draft.
const loaded = async () => { await screen.findByText('All changes saved'); return editor() }

it('loads the saved draft, progress, checkpoints and the configured reveal requirement', async () => {
  show()
  expect(((await loaded()) as HTMLTextAreaElement).value).toBe(SOLUTION)
  expect(screen.getByText('All changes saved')).toBeTruthy()
  expect(screen.getByText('4/6 tests')).toBeTruthy()
  expect(screen.getByText('Working')).toBeTruthy()
  expect(screen.getByText(/Pass every test in an evaluation to unlock/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Reveal solution' })).toBeNull()
})

it('autosaves edits against the loaded revision and resolves a conflict on request', async () => {
  show()
  fireEvent.change(await loaded(), { target: { value: 'def total_cost(p, q):\n    return 0\n' } })
  expect(screen.getByText('Unsaved changes')).toBeTruthy()
  await waitFor(() => expect(saveWorkspace).toHaveBeenCalledTimes(1), { timeout: 3000 })
  expect(saveWorkspace).toHaveBeenCalledWith('python-path-01-values', expect.objectContaining({ revision: 4, force: false, entry: 'solution.py' }))
  await screen.findByText('All changes saved')

  const conflict = new AxiosError('conflict', '409', undefined, undefined,
    { status: 409, data: {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } })
  vi.mocked(saveWorkspace).mockRejectedValueOnce(conflict)
  fireEvent.change(await editor(), { target: { value: 'mine' } })
  const banner = await screen.findByText(/saved from another tab/, {}, { timeout: 3000 })
  await act(async () => { fireEvent.click(within(banner).getByRole('button', { name: 'Keep my version' })) })
  expect(saveWorkspace).toHaveBeenLastCalledWith('python-path-01-values', expect.objectContaining({ force: true, files: [{ name: 'solution.py', content: 'mine' }] }))
})

it('runs the tests for free and shows numbered cases and a located diagnostic', async () => {
  vi.mocked(runWorkspaceTests).mockResolvedValue({
    status: 'failed', passed: 0, total: 6, cases: [], detail: '',
    diagnostic: { phase: 'run', message: "NameError: name 'nope' is not defined", file: 'solution.py', line: 2 },
  })
  show()
  await loaded()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run tests' })) })
  expect(runWorkspaceTests).toHaveBeenCalledWith('python-path-01-values', { language: 'python', files: [{ name: 'solution.py', content: SOLUTION }], entry: 'solution.py' })
  expect(screen.getByText('Runtime error')).toBeTruthy()
  expect(screen.getByText(/NameError/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Go to line 2' })).toBeTruthy()
  expect(practiceAction).not.toHaveBeenCalled()

  vi.mocked(runWorkspaceTests).mockResolvedValue({
    status: 'failed', passed: 1, total: 2, detail: '', diagnostic: null,
    cases: [{ index: 1, passed: true }, { index: 2, passed: false }],
  })
  await act(async () => { fireEvent.keyDown(screen.getByRole('button', { name: 'Run tests' }), { key: 'Enter', ctrlKey: true }) })
  expect(runWorkspaceTests).toHaveBeenCalledTimes(2)
  expect(screen.getByText('1 of 2 tests passed')).toBeTruthy()
  expect(screen.getByText(/Test inputs stay hidden/)).toBeTruthy()
})

it('adds a helper file and submits the whole workspace for evaluation', async () => {
  show()
  await loaded()
  fireEvent.click(screen.getByRole('button', { name: '+ File' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'New file name' }), { target: { value: '../x.py' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByRole('alert').textContent).toMatch(/letters, digits/)
  fireEvent.change(screen.getByRole('textbox', { name: 'New file name' }), { target: { value: 'helpers.py' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  fireEvent.change(await editor('helpers.py'), { target: { value: 'def twice(x):\n    return 2 * x\n' } })

  const tabs = screen.getAllByRole('tab')
  expect(tabs.map((t) => t.textContent)).toEqual(['solution.py entry', 'helpers.py'])
  fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' })
  expect(screen.getByRole('tab', { name: /solution.py/ }).getAttribute('aria-selected')).toBe('true')

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit for evaluation' })) })
  expect(practiceAction).toHaveBeenCalledWith('s1', 'submit', SOLUTION, '', undefined, {
    entry: 'solution.py',
    files: [{ name: 'solution.py', content: SOLUTION }, { name: 'helpers.py', content: 'def twice(x):\n    return 2 * x\n' }],
  })
})

it('saves, restores and resets through checkpoints', async () => {
  vi.mocked(createCheckpoint).mockResolvedValue({ id: 'c2', kind: 'manual', label: 'Idea', entry: 'solution.py', created_at: '2026-10-25T00:00:00Z', file_names: ['solution.py'] })
  vi.mocked(restoreCheckpoint).mockResolvedValue({ files: [{ name: 'solution.py', content: 'restored' }], entry: 'solution.py', template: 'single', revision: 9, updated_at: null })
  vi.mocked(resetWorkspace).mockResolvedValue({ files: [{ name: 'helpers.py', content: '# h' }, { name: 'solution.py', content: 'starter' }], entry: 'solution.py', template: 'helpers', revision: 10, updated_at: null })
  show()
  await loaded()
  fireEvent.change(screen.getByRole('textbox', { name: 'Checkpoint name' }), { target: { value: 'Idea' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save checkpoint' })) })
  expect(createCheckpoint).toHaveBeenCalledWith('python-path-01-values', expect.objectContaining({ label: 'Idea' }))
  expect(screen.getByText('Idea')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Restore Working' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' })) })
  expect(restoreCheckpoint).toHaveBeenCalledWith('python-path-01-values', 'c1')
  expect(((await editor()) as HTMLTextAreaElement).value).toBe('restored')

  fireEvent.click(screen.getByRole('button', { name: 'Reset or change template…' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Project template' }), { target: { value: 'helpers' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset workspace' })) })
  expect(resetWorkspace).toHaveBeenCalledWith('python-path-01-values', 'python', 'helpers')
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['helpers.py', 'solution.py entry'])
})

it('toggles a keyboard-accessible focus mode', async () => {
  show()
  await loaded()
  const toggle = screen.getByRole('button', { name: 'Focus mode' })
  fireEvent.click(toggle)
  expect(document.body.classList.contains('practice-focus')).toBe(true)
  expect(screen.getByRole('button', { name: 'Exit focus mode' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText('Problem statement', { selector: 'summary' }).closest('details')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(document.body.classList.contains('practice-focus')).toBe(false)
  fireEvent.keyDown(window, { key: 'f', code: 'KeyF', ctrlKey: true, altKey: true })
  expect(document.body.classList.contains('practice-focus')).toBe(true)
})

it('shows a session summary when the learner ends a session and can practise again', async () => {
  vi.mocked(fetchSessionSummary).mockResolvedValue({
    session_id: 's1', problem_id: 'python-path-01-values', language: 'python', status: 'completed',
    started_at: '2026-10-25T00:00:00Z', last_activity: null, elapsed_minutes: 12.4, test_runs: 3,
    evaluations: [{ status: 'failed', passed: 4, total: 6, at: '2026-10-25T00:10:00Z' }],
    solved: false, hint_tiers: [1, 2], reflection: null, error_categories: ['off_by_one'],
  })
  vi.mocked(practiceAction).mockResolvedValueOnce(reply).mockResolvedValueOnce({ ...reply, awaiting: null })
  show()
  await loaded()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit for evaluation' })) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'End session' })) })
  expect(practiceAction).toHaveBeenLastCalledWith('s1', 'quit')
  expect(await screen.findByText('Session summary')).toBeTruthy()
  expect(screen.getByText('12 min')).toBeTruthy()
  expect(screen.getByText('tier 1, tier 2')).toBeTruthy()
  expect(screen.getByText('off by one')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Practice again' }))
  expect(screen.queryByText('Session summary')).toBeNull()
})

it('says when no reference solution exists', async () => {
  vi.mocked(openWorkspace).mockResolvedValue(state({ reveal: { ...state().reveal, has_solution: false } }))
  show()
  expect(await screen.findByText(/no reference solution for this problem/)).toBeTruthy()
})
