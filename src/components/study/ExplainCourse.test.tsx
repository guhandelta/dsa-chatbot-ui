import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ExplainCourse } from './ExplainCourse'
import { fetchExplainPathway, type ExplainCourseData } from '../../lib/studyApi'

vi.mock('../../lib/studyApi', () => ({ fetchExplainPathway: vi.fn() }))
vi.mock('../../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, search }: { children: React.ReactNode; search: Record<string, string> }) => <a href={'/practice?' + new URLSearchParams(search)}>{children}</a> }))
const data: ExplainCourseData = {
  language: 'javascript', status: 'javascript-pilot',
  tiers: [{ id: 1, title: 'Basic data structures', description: 'Structure to applied problems to DSA.' },
    { id: 2, title: 'Combined data structures', description: 'Combine structures.' }, { id: 3, title: 'Easy to medium DSA', description: 'Easy before medium.' }],
  foundations: [{ id: 'javascript:stage-04', title: 'Functions', complete: false }],
  units: [{ id: 'explain:javascript:arrays', slug: 'arrays', tier: 1, title: 'Arrays', prerequisite_ids: [],
    objective: 'Traverse and copy collections.', mental_model: 'Arrays preserve order.',
    structure: { code: 'const values = [1, 2];', expected_output: '[1,2]' }, applied_task: 'Keep original positions.',
    pitfall: 'Assignment aliases the collection.', dsa_bridge: 'Maintain a running invariant.', assessment_node_id: 'javascript:stage-06',
    assessment: { node_id: 'javascript:stage-06', title: 'Arrays and lists', checks_available: 4, checks_passed: false, exercise_id: 'javascript-path-06-arrays', exercise_passed: false, coverage_ready: true },
    practice: [{ id: 'contains-duplicate', title: 'Contains Duplicate', difficulty: 'Easy', solved: false }] },
  { id: 'explain:javascript:arrays-strings', slug: 'arrays-strings', tier: 2, title: 'Arrays with Strings', prerequisite_ids: ['explain:javascript:arrays'],
    objective: 'Transform collections of text.', mental_model: 'Separate collection and text contracts.',
    structure: { code: 'const words = ["hi"];', expected_output: '["hi"]' }, applied_task: 'Normalize a list of words.',
    pitfall: 'Decide what counts as a duplicate.', dsa_bridge: 'Build grouping signatures.', assessment_node_id: null, assessment: null, practice: [] }],
}
beforeEach(() => { vi.mocked(fetchExplainPathway).mockResolvedValue(data) })
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('shows three tiers and opens the selected topic with all learning phases', async () => {
  const onFocus = vi.fn(), onOpen = vi.fn()
  const view = render(<ExplainCourse language="javascript" onFocus={onFocus} onOpen={onOpen} />)
  await screen.findByText('Tier 3: Easy to medium DSA')
  fireEvent.click(screen.getByRole('button', { name: 'Arrays' }))
  expect(onFocus).toHaveBeenCalledWith('explain:javascript:arrays')
  view.rerender(<ExplainCourse language="javascript" focusId="explain:javascript:arrays" onFocus={onFocus} onOpen={onOpen} />)
  expect(screen.getByLabelText('Structure and operations')).toBeTruthy()
  expect(screen.getByLabelText('Applied problem')).toBeTruthy()
  expect(screen.getByLabelText('DSA connection')).toBeTruthy()
  expect(screen.getByText('const values = [1, 2];')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Contains Duplicate/ }).getAttribute('href')).toContain('language=javascript')
  fireEvent.click(screen.getByText('Take linked topic checks'))
  expect(onOpen).toHaveBeenCalledWith('quiz', 'javascript:stage-06')
  fireEvent.click(screen.getByText('Debug this topic'))
  expect(onOpen).toHaveBeenCalledWith('debug', 'explain:javascript:arrays')
})

it('labels ungraded combined topics honestly and retains their prerequisites', async () => {
  const onFocus = vi.fn()
  render(<ExplainCourse language="javascript" focusId="explain:javascript:arrays-strings" onFocus={onFocus} onOpen={vi.fn()} />)
  await screen.findByText(/Dedicated topic assessment: Coming soon/)
  expect(screen.queryByText('Take linked topic checks')).toBeNull()
  expect(screen.getByText(/do not certify the whole unit or tier/)).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: 'Arrays' })[1])
  expect(onFocus).toHaveBeenCalledWith('explain:javascript:arrays')
})

it('does not start an unrelated quiz for a combined topic', async () => {
  render(<ExplainCourse language="javascript" focusId="explain:javascript:arrays-strings" onFocus={vi.fn()} onOpen={vi.fn()} assessmentOnly />)
  await screen.findByText(/Dedicated topic assessment: Coming soon/)
  expect(screen.queryByText('Take linked topic checks')).toBeNull()
  expect(screen.queryByLabelText('Applied problem')).toBeNull()
})

it('ignores stale requests and supports retrying a load error', async () => {
  let resolve!: (value: ExplainCourseData) => void
  vi.mocked(fetchExplainPathway).mockReturnValueOnce(new Promise(yes => { resolve = yes }))
  const first = render(<ExplainCourse language="javascript" onFocus={vi.fn()} onOpen={vi.fn()} />)
  first.unmount()
  await act(async () => resolve(data))
  vi.mocked(fetchExplainPathway).mockRejectedValueOnce(new Error('Course unavailable'))
  render(<ExplainCourse language="javascript" onFocus={vi.fn()} onOpen={vi.fn()} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByText('Retry Explain pathway'))
  await screen.findByText('Tier 1: Basic data structures')
})

it('opens a practice activity with a stable exact focus and keeps it ungraded', async () => {
  const value = { ...data, units: data.units.map(unit => ({ ...unit })) }
  value.units[0].activities = [{ id: 'arrays-11', family_id: 'javascript:arrays:transfer', title: 'Transfer independently',
    prompt: 'Find the second-largest distinct reading without sorting.', step: 'transfer', kind: 'implement', route: 'core',
    checklist: ['Try before requesting hints.', 'Explain a duplicate case.'], assessment: 'ungraded', source: 'authored' }]
  vi.mocked(fetchExplainPathway).mockResolvedValue(value)
  const onFocus = vi.fn(), onOpen = vi.fn()
  const view = render(<ExplainCourse language="javascript" focusId="explain:javascript:arrays" onFocus={onFocus} onOpen={onOpen} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Transfer independently' }))
  expect(onFocus).toHaveBeenCalledWith('explain:javascript:arrays/arrays-11')
  view.rerender(<ExplainCourse language="javascript" focusId="explain:javascript:arrays/arrays-11" onFocus={onFocus} onOpen={onOpen} />)
  expect(screen.getByLabelText('Selected practice activity').textContent).toContain('second-largest distinct')
  expect(screen.getByText(/does not mark it complete or award mastery/)).toBeTruthy()
  fireEvent.click(screen.getByText('Take linked topic checks'))
  expect(onOpen).toHaveBeenCalledWith('quiz', 'javascript:stage-06')
})

it('does not substitute another activity for an invalid activity deep link', async () => {
  render(<ExplainCourse language="javascript" focusId="explain:javascript:arrays/maps-11" onFocus={vi.fn()} onOpen={vi.fn()} />)
  await screen.findByText(/activity is unavailable for the selected topic/)
  expect(screen.queryByLabelText('Selected practice activity')).toBeNull()
})
