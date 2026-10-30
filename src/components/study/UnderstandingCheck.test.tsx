import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QuizItemView } from './QuizMode'
import { LearningSupportProvider } from '../../lib/learningSupport'
import type { QuizItem } from '../../lib/studyApi'

beforeEach(() => localStorage.clear())
afterEach(cleanup)
const item = (language: string, type: QuizItem['type'] = 'short_answer'): QuizItem => ({
  id: `${language}-${type}`, language, type, prompt: 'Explain this operation.',
  concept: 'values', source: 'authored', level: 'L1', code: 'code under investigation', starter: 'starter',
})

it.each(['python', 'javascript', 'java', 'typescript', 'c', 'cpp', 'rust', 'go', 'csharp', 'ruby', 'html', 'css'])(
  'requires the answer, reasoning and transfer in %s without an early grading request', language => {
    const onAnswer = vi.fn()
    render(<QuizItemView item={item(language)} busy={false} onAnswer={onAnswer} />)
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to understanding check' }))
    expect(onAnswer).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Check answer' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reasoning check'), { target: { value: 'A specific operation.' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Check answer' }).closest('form')!)
    expect(onAnswer).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Follow-up check'), { target: { value: 'A concrete variation.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(onAnswer).toHaveBeenCalledWith('42', { reasoning: 'A specific operation.', transfer: 'A concrete variation.' })
  },
)

it.each(['explain', 'fix_bug', 'write_snippet'] as const)('applies understanding checks to %s', type => {
  const onAnswer = vi.fn()
  render(<QuizItemView item={item('typescript', type)} busy={false} onAnswer={onAnswer} />)
  if (type === 'explain') fireEvent.change(screen.getByLabelText('Your explanation'), { target: { value: 'My explanation.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue to understanding check' }))
  expect(screen.getByLabelText('Reasoning check')).toBeTruthy()
  expect(onAnswer).not.toHaveBeenCalled()
})

it('preserves understanding drafts after reload and keeps accounts isolated', () => {
  const viewFor = (owner: string) => <LearningSupportProvider key={owner} owner={owner} fallback={{ id: 'topic', title: 'Topic' }}>
    <QuizItemView item={item('python')} busy={false} onAnswer={vi.fn()} draftScope="quiz-1" />
  </LearningSupportProvider>
  const view = render(viewFor('alice'))
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '42' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue to understanding check' }))
  fireEvent.change(screen.getByLabelText('Reasoning check'), { target: { value: 'Saved trace.' } })
  fireEvent.change(screen.getByLabelText('Follow-up check'), { target: { value: 'Saved case.' } })
  view.unmount()
  const restored = render(viewFor('alice'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to understanding check' }))
  expect((screen.getByLabelText('Reasoning check') as HTMLTextAreaElement).value).toBe('Saved trace.')
  expect((screen.getByLabelText('Follow-up check') as HTMLTextAreaElement).value).toBe('Saved case.')
  restored.rerender(viewFor('bob'))
  expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('')
})

it('does not submit during an in-flight check even if a form event is forced', () => {
  const onAnswer = vi.fn()
  render(<QuizItemView item={item('python')} busy onAnswer={onAnswer} />)
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '42' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Checking…' }).closest('form')!)
  expect(onAnswer).not.toHaveBeenCalled()
})
