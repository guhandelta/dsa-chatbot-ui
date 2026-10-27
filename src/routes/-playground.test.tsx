import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listPlayground, openPlayground, savePlayground, transpileTypeScript } from '../lib/playgroundApi'

const state = vi.hoisted(() => ({ search: {} as Record<string, string>, navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => state.search }),
  redirect: (value: unknown) => value,
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('../lib/auth', () => ({ hasToken: () => true }))
vi.mock('../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
vi.mock('../lib/playgroundApi', () => ({ listPlayground: vi.fn(), openPlayground: vi.fn(), savePlayground: vi.fn(), transpileTypeScript: vi.fn() }))
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { ariaLabel: string } }) => (
    <textarea aria-label={options.ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

import { Route } from './playground'
const Page = (Route as unknown as { component: () => React.ReactElement }).component

const files = [
  { name: 'index.html', content: '<html><head></head><body><button id="b">b</button><script src="script.ts"></script></body></html>' },
  { name: 'styles.css', content: 'body{}' },
  { name: 'script.ts', content: 'let n: number = "x"' },
]

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  state.search = {}
  vi.mocked(listPlayground).mockResolvedValue({ projects: [{ slug: 'demo', template: 'html-css-ts', updated_at: null }],
    templates: [{ id: 'html-css-js', title: 'HTML, CSS and JavaScript' }, { id: 'html-css-ts', title: 'HTML, CSS and TypeScript' }],
    limits: { max_files: 12, max_total_chars: 60000, max_projects: 30 } })
  vi.mocked(openPlayground).mockResolvedValue({ slug: 'demo', template: 'html-css-ts', entry: 'index.html', revision: 2, updated_at: null, files })
  vi.mocked(transpileTypeScript).mockResolvedValue({ outputs: { 'script.ts': 'let n = "x";' },
    diagnostics: [{ file: 'script.ts', line: 1, column: 5, code: 'TS2322', message: "Type 'string' is not assignable to type 'number'." }] })
  vi.mocked(savePlayground).mockResolvedValue({ revision: 3, updated_at: '' })
})

it('lists projects and validates a new project name before opening it', async () => {
  render(<Page />)
  expect(await screen.findByText('demo')).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Bad Name!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
  expect(screen.getByRole('alert').textContent).toMatch(/lowercase/)
  fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), { target: { value: 'My Page' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Template' }), { target: { value: 'html-css-ts' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
  expect(state.navigate).toHaveBeenCalledWith({ to: '/playground', search: { project: 'my-page', template: 'html-css-ts' } })
})

it('compiles TypeScript, renders a sandboxed preview and reports type errors', async () => {
  state.search = { project: 'demo' }
  render(<Page />)
  await waitFor(() => expect(transpileTypeScript).toHaveBeenCalledWith(files))
  const frame = await screen.findByTitle('Preview of your page') as HTMLIFrameElement
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.getAttribute('srcdoc')).toContain('let n = "x";')
  expect(frame.getAttribute('srcdoc')).toContain('Content-Security-Policy')
  expect(await screen.findByText(/TS2322/)).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Preview' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Go to line 1' })).toBeTruthy()
})

it('shows the selected curriculum challenge beside the code editor', async () => {
  state.search = { project: 'web-js-fundamentals', section: 'js-fundamentals', challenge: 'js-fundamentals-0' }
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Function fluency set' })).toBeTruthy()
  expect(screen.getByText(/validation, formatting, and deriving display data/)).toBeTruthy()
  expect(screen.getByText(/not yet automatically evaluated/)).toBeTruthy()
})

it('autosaves edits and refreshes the preview for markup without re-running scripts', async () => {
  state.search = { project: 'demo' }
  render(<Page />)
  await waitFor(() => expect(transpileTypeScript).toHaveBeenCalledTimes(1))
  fireEvent.change(await screen.findByRole('textbox', { name: 'index.html editor' }), { target: { value: '<p>changed</p>' } })
  await waitFor(() => expect((screen.getByTitle('Preview of your page') as HTMLIFrameElement).getAttribute('srcdoc')).toContain('<p>changed</p>'), { timeout: 2000 })
  await waitFor(() => expect(savePlayground).toHaveBeenCalledWith('demo', expect.objectContaining({ revision: 2, template: 'html-css-ts' })), { timeout: 3000 })
  expect(transpileTypeScript).toHaveBeenCalledTimes(1)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run preview' })) })
  expect(transpileTypeScript).toHaveBeenCalledTimes(2)
})

it('shows console output only from its own preview frame and render', async () => {
  state.search = { project: 'demo' }
  render(<Page />)
  const frame = await screen.findByTitle('Preview of your page') as HTMLIFrameElement
  const token = /var token = "([^"]+)"/.exec(frame.getAttribute('srcdoc') ?? '')![1]
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'dsa-preview', token, level: 'log', text: 'forged' }, source: window }))
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'dsa-preview', token: 'wrong', level: 'log', text: 'stale' }, source: frame.contentWindow }))
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'dsa-preview', token, level: 'warn', text: 'clicks 1' }, source: frame.contentWindow }))
  })
  expect(screen.getByText('clicks 1').className).toBe('pg-warn')
  expect(screen.queryByText('forged')).toBeNull()
  expect(screen.queryByText('stale')).toBeNull()
})
