import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
const state = vi.hoisted(() => ({ data: { languages: ['java'] }, isError: false, isPending: false }))
vi.mock('../lib/languageAccess', () => ({
  LANGUAGE_LABELS: { java: 'Java', javascript: 'JavaScript' },
  useLanguageAccess: () => state,
}))
import { LanguageSelector } from './LanguageSelector'
afterEach(cleanup)
beforeEach(() => { state.data = { languages: ['java'] }; state.isError = false; state.isPending = false })
it('shows only permitted languages and corrects a stale selection', () => {
  const change = vi.fn()
  render(<LanguageSelector value="javascript" onChange={change} />)
  expect(screen.queryByRole('option', { name: 'JavaScript' })).toBeNull()
  expect(screen.getByRole('option', { name: 'Java' })).toBeTruthy()
  expect(change).toHaveBeenCalledWith('java')
})
it('does not offer cached language data after a failed access refresh', () => {
  state.isError = true
  render(<LanguageSelector value="java" onChange={vi.fn()} />)
  expect(screen.queryByRole('option', { name: 'Java' })).toBeNull()
  expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true)
})
it('provides a disabled empty state without inventing a default language', () => {
  state.data.languages = []
  const change = vi.fn()
  render(<LanguageSelector value="javascript" onChange={change} />)
  expect(screen.getByText('No available languages')).toBeTruthy()
  expect(change).not.toHaveBeenCalled()
})
it('allows selection among multiple entitled languages', () => {
  state.data.languages = ['java', 'javascript']
  const change = vi.fn()
  render(<LanguageSelector value="java" onChange={change} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'javascript' } })
  expect(change).toHaveBeenCalledWith('javascript')
})
