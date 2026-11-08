import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchTracks: vi.fn(), fetchReferenceSubjects: vi.fn(), setPreferredLanguage: vi.fn(), setUser: vi.fn() }))
vi.mock('../lib/api', () => ({ ...mocks, getApiErrorMessage: (e: Error) => e.message }))
vi.mock('../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: { role: 'admin' }, setUser: mocks.setUser }) }))
vi.mock('../components/CourseOutline', () => ({ CourseOutline: ({ language }: { language: string }) => <p>Course for {language}</p> }))
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (value: unknown) => value, redirect: (value: unknown) => value,
  Link: ({ to, search, children }: { to: string; search?: Record<string, string>; children: React.ReactNode }) => <a href={to + (search ? '?' + new URLSearchParams(search) : '')}>{children}</a>,
}))
import { LearnHub } from './learn'

const tracks = (language: string) => ({ preferred_language: language, languages: ['java', 'python', 'css'], tracks: [{ track: 'language', label: 'Language foundations', blurb: 'Learn', count: 2 }] })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchTracks.mockResolvedValue(tracks('python'))
  mocks.fetchReferenceSubjects.mockResolvedValue([
    { id: 'python', language: 'python', records: 500, retrievable_records: 400 },
    { id: 'python-django', language: 'python', records: 321, retrievable_records: 321 },
    { id: 'embedded-python', language: 'python', records: 1200, retrievable_records: 829 },
    { id: 'css', language: 'css', records: 800, retrievable_records: 800 },
    { id: 'empty', language: 'python', records: 2, retrievable_records: 0 },
  ])
})
afterEach(cleanup)

it('shows courses and readable framework and embedded collections without authoring controls, even to admins', async () => {
  render(<LearnHub />)
  expect(await screen.findByText('Course for python')).toBeTruthy()
  expect(screen.getByText('python django')).toBeTruthy()
  expect(screen.getByText('embedded python')).toBeTruthy()
  expect(screen.getByText('400 readable references · 500 source records')).toBeTruthy()
  expect(screen.getByText('2 authored items')).toBeTruthy()
  expect(screen.getAllByText('Study this collection')[1].getAttribute('href')).toBe('/chat?mode=chat&language=python&subject=python-django')
  expect(screen.queryByText('empty')).toBeNull()
  expect(screen.queryByText('Train Knowledge Base')).toBeNull()
  expect(screen.queryByText(/Upload|Paste Raw Text/)).toBeNull()
  expect(screen.queryByText('800 readable references · 800 source records')).toBeNull()
})

it('shows Design Patterns as reference lessons without a practice link', async () => {
  mocks.fetchTracks.mockResolvedValue({ ...tracks('python'), tracks: [
    { track: 'design-patterns', label: 'Design Patterns', blurb: 'Pattern choices', count: 13 },
  ] })
  render(<LearnHub />)
  expect(await screen.findByText('Design Patterns')).toBeTruthy()
  expect(screen.getByText(/Graded practice and mastery tracking are in development/)).toBeTruthy()
  expect(screen.getByText('Explore lessons')).toBeTruthy()
  expect(screen.queryByText('Practice')).toBeNull()
})

it('switches both the course and collections with the saved learning language', async () => {
  mocks.setPreferredLanguage.mockResolvedValue({ preferred_language: 'css' })
  mocks.fetchTracks.mockResolvedValueOnce(tracks('python')).mockResolvedValue(tracks('css'))
  render(<LearnHub />)
  await screen.findByText('Course for python')
  fireEvent.click(screen.getByRole('button', { name: 'CSS' }))
  expect(await screen.findByText('Course for css')).toBeTruthy()
  expect(mocks.setPreferredLanguage).toHaveBeenCalledWith('css')
  expect(mocks.setUser).toHaveBeenCalledWith({ preferred_language: 'css' })
  expect(screen.queryByText('python django')).toBeNull()
  expect(screen.getByText('800 readable references · 800 source records')).toBeTruthy()
})

it('keeps courses available when the optional reference list fails', async () => {
  mocks.fetchReferenceSubjects.mockRejectedValue(new Error('temporarily unavailable'))
  render(<LearnHub />)
  expect(await screen.findByText('Course for python')).toBeTruthy()
  expect(screen.getByText(/Reference collections could not be loaded/)).toBeTruthy()
})

it('shows a failed language change without replacing the selected course', async () => {
  mocks.setPreferredLanguage.mockRejectedValue(new Error('subscription required'))
  render(<LearnHub />)
  await screen.findByText('Course for python')
  fireEvent.click(screen.getByRole('button', { name: 'Java' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'subscription required')
  expect(screen.getByText('Course for python')).toBeTruthy()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Java' }) as HTMLButtonElement).disabled).toBe(false))
})
