import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshRecord, isDraftText, LearningSupportProvider, readRecord, storageKey, useLearningDraft, useLearningPauseGuard, useSupportTask, writeRecord } from './learningSupport'

function Editor({ id = 'arrays', save, busy = false }: { id?: string; save?: () => Promise<void>; busy?: boolean }) {
  const report = useSupportTask({ id, title: id, save, busy })
  const [text, setText] = useLearningDraft(`${id}:answer`, '', isDraftText)
  return <><input aria-label="Draft" value={text} onChange={e => setText(e.target.value)} />
    <button onClick={() => report('difficulty')}>Failed check</button>
    <button onClick={() => report('success')}>Passed check</button>
    <button onClick={() => report('attempt')}>Attempt</button>
    <button onClick={() => { report('difficulty'); report('difficulty'); report('difficulty'); report('success'); report('difficulty'); report('difficulty') }}>Burst checks</button></>
}
function App({ owner = 'alice', id = 'arrays', save, busy = false }: { owner?: string; id?: string; save?: () => Promise<void>; busy?: boolean }) {
  return <LearningSupportProvider key={owner} owner={owner} fallback={null}><Editor id={id} save={save} busy={busy} /></LearningSupportProvider>
}
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('learning support', () => {
  it('records actual attempts without claiming mastery and preserves earlier milestones after mistakes', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Review an example' }))
    fireEvent.click(screen.getByText('Failed check'))
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('2')
    expect(screen.getByText(/separate from graded mastery/)).toBeTruthy()
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByText('Failed check'))
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('2')
    expect(screen.getByText(/A few attempts have been difficult/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('trace its first unexpected step')
  })

  it('offers an optional new approach and saves the next step without forcing a break', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'I’m stuck' }))
    fireEvent.click(screen.getByRole('button', { name: /Break this task/ }))
    expect(readRecord('alice', 'arrays').nextStep).toContain('one input')
    expect((screen.getByRole('textbox', { name: 'Draft' }) as HTMLInputElement).disabled).toBe(false)
  })

  it('saves before pausing and restores drafts, milestones and pause status after remount', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const view = render(<App save={save} />)
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'my unfinished code' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review feedback' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
    await screen.findByRole('button', { name: 'Resume learning' })
    expect(save).toHaveBeenCalledTimes(1)
    view.unmount()
    render(<App />)
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('my unfinished code')
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Resume learning' }))
    expect(screen.getByRole('status').textContent).toContain('Welcome back')
  })

  it('does not claim work was saved after a network failure or conflict', async () => {
    render(<App save={vi.fn().mockRejectedValue(new Error('409'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Saving did not finish')
    expect(screen.queryByRole('button', { name: 'Resume learning' })).toBeNull()
    expect(readRecord('alice', 'arrays').paused).toBe(false)
  })

  it('disables pause while workspace execution is active', () => {
    render(<App busy />)
    expect((screen.getByRole('button', { name: 'Pause and save' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'I’m stuck' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('refuses pause during a quiz request without marking it saved', async () => {
    function BusyQuiz() { useLearningPauseGuard(true); return null }
    render(<LearningSupportProvider owner="alice" fallback={{ id: 'quiz', title: 'Quiz' }}><BusyQuiz /></LearningSupportProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Resume learning' })).toBeNull()
  })

  it('reports blocked storage and never claims a pause succeeded', async () => {
    render(<App />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    fireEvent.click(screen.getByRole('button', { name: 'Review feedback' }))
    expect(screen.getByRole('alert').textContent).toContain('storage is unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Saving did not finish'))
    expect(screen.queryByRole('button', { name: 'Resume learning' })).toBeNull()
  })

  it('isolates drafts and progress by account and topic under rapid switches', () => {
    const view = render(<App />)
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'private answer' } })
    fireEvent.click(screen.getByText('Attempt'))
    view.rerender(<App id="maps" />)
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0')
    view.rerender(<App owner="bob" />)
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('')
    view.rerender(<App />)
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('private answer')
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
  })

  it('a slow save cannot pause or announce success on a different topic', async () => {
    let finish!: () => void
    const save = () => new Promise<void>(resolve => { finish = resolve })
    const view = render(<App save={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
    view.rerender(<App id="maps" />)
    await act(async () => finish())
    expect(screen.queryByRole('button', { name: 'Resume learning' })).toBeNull()
    expect(readRecord('alice', 'maps').paused).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('works in StrictMode and caps progress at four despite repeated clicks', () => {
    render(<StrictMode><App /></StrictMode>)
    for (const name of ['Review an example', 'Make an attempt', 'Review feedback', 'Try a variation']) {
      for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
    }
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('4')
    fireEvent.click(screen.getByText('Failed check'))
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('4')
  })

  it('a passing check clears the repeated-difficulty offer without pretending the whole topic is complete', () => {
    render(<App />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Failed check'))
    fireEvent.click(screen.getByText('Passed check'))
    expect(screen.queryByText(/A few attempts/)).toBeNull()
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
  })

  it('does not erase a milestone recorded in another tab', () => {
    render(<App />)
    writeRecord('alice', 'arrays', { ...freshRecord(), milestones: [true, false, false, false] })
    fireEvent.click(screen.getByText('Failed check'))
    expect(readRecord('alice', 'arrays').milestones).toEqual([true, true, false, false])
  })

  it('keeps thousands of repeated actions bounded and monotonic', () => {
    render(<App />)
    for (let i = 0; i < 1000; i++) {
      fireEvent.click(screen.getByText(i % 7 === 0 ? 'Passed check' : 'Failed check'))
      if (i % 31 === 0) fireEvent.click(screen.getByRole('button', { name: /Review feedback/ }))
      const progress = readRecord('alice', 'arrays')
      expect(progress.milestones[1]).toBe(true)
      expect(progress.difficulties).toBeLessThanOrEqual(100)
      expect(progress.milestones.filter(Boolean).length).toBeLessThanOrEqual(4)
    }
  })

  it('processes batched results in order without dropping failures or replaying earlier events', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Burst checks'))
    expect(readRecord('alice', 'arrays').difficulties).toBe(2)
    fireEvent.click(screen.getByText('Failed check'))
    expect(readRecord('alice', 'arrays').difficulties).toBe(3)
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1')
  })
})

describe('corrupted and adversarial browser storage', () => {
  it.each(['undefined', '{', 'null', '42', '[]', '{}', '{"milestones":[true]}', '{"milestones":[1,1,1,1]}'])('ignores malformed record %s', raw => {
    localStorage.setItem(storageKey('u', 'x'), raw)
    expect(readRecord('u', 'x')).toEqual(freshRecord())
  })
  it('bounds counters and user notes from tampered storage', () => {
    writeRecord('u', 'x', { ...freshRecord(), difficulties: 999999, nextStep: 'x'.repeat(5000) })
    expect(readRecord('u', 'x').difficulties).toBe(100)
    expect(readRecord('u', 'x').nextStep).toHaveLength(500)
  })
})
