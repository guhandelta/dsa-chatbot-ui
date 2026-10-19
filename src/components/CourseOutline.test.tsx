import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchCourse: vi.fn(), fetchCourseReading: vi.fn() }))
vi.mock('../lib/courseApi', () => mocks)
vi.mock('../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
import { CourseOutline } from './CourseOutline'

const course = (title = 'Python course') => ({ language: 'python', title, status: 'draft', description: 'Learn Python step by step.', prerequisites: ['No programming required.'],
  modules: [{ id: 'basics', title: 'Values and expressions', objectives: ['Explain an expression.'], practice_brief: 'Write a unit converter.', prerequisites: [], sources: [{ id: 'reading1', title: 'First expressions', kind: 'reference' }] },
    { id: 'next', title: 'Functions', objectives: ['Define a function.'], practice_brief: 'Extract the converter into a function.', prerequisites: ['basics'], sources: [] }],
  capstone: { title: 'Converter toolkit', brief: 'Combine the exercises.', deliverables: ['Source and a test log.'], assessment_status: 'missing' }, limitations: ['Graded capstone rubric needs authoring.'] })
beforeEach(() => { vi.clearAllMocks(); mocks.fetchCourse.mockResolvedValue(course()) })
afterEach(cleanup)

it('opens source-linked readings and distinguishes self-guided practice from graded work', async () => {
  mocks.fetchCourseReading.mockResolvedValue({ title: 'First expressions', document: '## Expressions\nAdd values with `+`.' })
  render(<CourseOutline language="python" />)
  expect(await screen.findByText('Python course')).toBeTruthy()
  expect(screen.getByText(/Practice briefs are self-guided/)).toBeTruthy()
  expect(screen.getByText('Write a unit converter.')).toBeTruthy()
  expect(screen.getByText('A suitable reading still needs to be authored or mapped for this module.')).toBeTruthy()
  fireEvent.click(screen.getByText('Read: First expressions'))
  expect(await screen.findByRole('heading', { name: 'Expressions' })).toBeTruthy()
  expect(mocks.fetchCourseReading).toHaveBeenCalledWith('python', 'basics', 'reading1')
  expect(screen.getByText('Graded capstone rubric needs authoring.')).toBeTruthy()
  fireEvent.click(screen.getByText('Close reading'))
  expect(screen.queryByLabelText('Course reading')).toBeNull()
})

it('does not show a reading response after switching language', async () => {
  let finish!: (value: unknown) => void
  mocks.fetchCourseReading.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const { rerender } = render(<CourseOutline language="python" />)
  await screen.findByText('Python course')
  fireEvent.click(screen.getByText('Read: First expressions'))
  mocks.fetchCourse.mockResolvedValue(course('Rust course'))
  rerender(<CourseOutline language="rust" />)
  await screen.findByText('Rust course')
  await act(async () => finish({ title: 'Old Python reading', document: 'Old content' }))
  expect(screen.queryByText('Old Python reading')).toBeNull()
  expect(screen.queryByLabelText('Course reading')).toBeNull()
})

it('reports course and reading failures without presenting unavailable content', async () => {
  mocks.fetchCourse.mockRejectedValueOnce(new Error('No course available'))
  const first = render(<CourseOutline language="unknown" />)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Course could not be loaded: No course available')
  first.unmount()
  mocks.fetchCourseReading.mockRejectedValue(new Error('Reading retired'))
  render(<CourseOutline language="python" />)
  await screen.findByText('Python course')
  fireEvent.click(screen.getByText('Read: First expressions'))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Reading retired')
  expect(screen.queryByLabelText('Course reading')).toBeNull()
})
