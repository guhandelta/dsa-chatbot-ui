import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listPlayground, openPlayground, savePlayground, transpileTypeScript } from '../lib/playgroundApi'
import { webChallengeProjectSlug } from '../lib/webCurriculum'

const state = vi.hoisted(() => ({ search: {} as Record<string, string>, navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => state.search }),
  redirect: (value: unknown) => value,
  useNavigate: () => state.navigate,
  Link: ({ children, search }: { children: React.ReactNode; search?: Record<string, unknown> }) => <a data-search={JSON.stringify(search)}>{children}</a>,
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

afterEach(() => { cleanup(); vi.restoreAllMocks() })
beforeEach(() => {
  vi.clearAllMocks()
  state.search = {}
  vi.mocked(listPlayground).mockResolvedValue({ projects: [{ slug: 'demo', template: 'html-css-ts', updated_at: null }],
    templates: [{ id: 'html-css-js', title: 'HTML, CSS and JavaScript' }, { id: 'html-css-ts', title: 'HTML, CSS and TypeScript' }],
    limits: { max_files: 12, max_total_chars: 60000, max_projects: 100 } })
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
  const project = webChallengeProjectSlug('js-fundamentals', 'js-fundamentals-function-fluency-set')
  state.search = { project, template: 'html-css-js', section: 'js-fundamentals', challenge: 'js-fundamentals-function-fluency-set' }
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Function fluency set' })).toBeTruthy()
  expect(screen.getByText(/validation, formatting, and deriving display data/)).toBeTruthy()
  expect(screen.getByText(/not yet automatically evaluated/)).toBeTruthy()
  expect(openPlayground).toHaveBeenCalledWith(project, 'html-css-js')
})

it('seeds a new browser challenge from its curriculum starter files', async () => {
  const project = webChallengeProjectSlug('browser', 'browser-trace-a-page-load')
  state.search = { project, template: 'html-css-js', section: 'browser', challenge: 'browser-trace-a-page-load' }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Trace a page load' })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('Page load trace')
  expect(html.value).toContain('href="styles.css"')
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it('seeds a new HTML semantics challenge with its authored multi-file project', async () => {
  const project = webChallengeProjectSlug('html-semantics', 'html-semantics-repair-a-document-outline')
  state.search = { project, template: 'html-css-js', section: 'html-semantics', challenge: 'html-semantics-repair-a-document-outline' }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Repair a document outline' })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<h4 id="coastal-route">')
  expect(html.value).toContain('<div class="field-note">')
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain('.field-note')
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it('seeds the accessible profile form challenge with its HTML, CSS, and JavaScript files', async () => {
  const challenge = 'forms-accessible-profile-form'
  const project = webChallengeProjectSlug('forms', challenge)
  state.search = { project, template: 'html-css-js', section: 'forms', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Accessible profile form' })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<fieldset>')
  expect(html.value).toContain('autocomplete="email" required')
  expect(html.value).toContain('aria-describedby="about-help"')
  expect(await screen.findByRole('tab', { name: 'script.js' })).toBeTruthy()
})

it('seeds the clipped-card CSS challenge with the overflowing layout to inspect', async () => {
  const challenge = 'css-foundations-fix-a-clipped-card'
  const project = webChallengeProjectSlug('css-foundations', challenge)
  state.search = { project, template: 'html-css-js', section: 'css-foundations', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Fix a clipped card' })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain('overflow: hidden')
  expect(css.value).toContain('box-sizing: content-box')
})

it('seeds the responsive navigation challenge as an editable multi-file project', async () => {
  const challenge = 'layout-responsive-responsive-navigation'
  const project = webChallengeProjectSlug('layout-responsive', challenge)
  state.search = { project, template: 'html-css-js', section: 'layout-responsive', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Responsive navigation' })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<nav aria-label="Main navigation">')
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain('.nav-list')
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it('seeds the grid-under-pressure challenge with its intentional overflow bug', async () => {
  const challenge = 'layout-responsive-grid-under-pressure'
  const project = webChallengeProjectSlug('layout-responsive', challenge)
  state.search = { project, template: 'html-css-js', section: 'layout-responsive', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Grid under pressure' })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain('grid-template-columns: repeat(3, 1fr)')
  expect(css.value).toContain('min-width: 18rem')
  expect(css.value).toContain('white-space: nowrap')
})

it('seeds the viewport review challenge with observations and real responsive breakpoints', async () => {
  const challenge = 'layout-responsive-viewport-variation-set'
  const project = webChallengeProjectSlug('layout-responsive', challenge)
  state.search = { project, template: 'html-css-js', section: 'layout-responsive', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: 'Viewport variation set' })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('Viewport observations')
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain('min-width: 42rem')
  expect(css.value).toContain('min-width: 68rem')
  expect(css.value).toContain('prefers-reduced-motion: reduce')
})

it.each([
  ['styling-systems-refactor-repeated-styles', 'Refactor repeated styles', '.guide-card--featured'],
  ['styling-systems-compare-styling-approaches', 'Compare styling approaches', '.workshop-grid'],
  ['styling-systems-specificity-cleanup', 'Specificity cleanup', '#app main p.notice'],
])('seeds the %s styling-systems workspace', async (challenge, title, expectedContent) => {
  const project = webChallengeProjectSlug('styling-systems', challenge)
  state.search = { project, template: 'html-css-js', section: 'styling-systems', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<main>')
  fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }))
  const css = await screen.findByRole('textbox', { name: 'styles.css editor' }) as HTMLTextAreaElement
  expect(css.value).toContain(expectedContent)
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it.each([
  ['js-fundamentals-function-fluency-set', 'Function fluency set', 'function normalizeName(value)'],
  ['js-fundamentals-repair-a-state-bug', 'Repair a state bug', 'const completedCount = items.filter'],
  ['js-fundamentals-explain-the-closure', 'Explain the closure', 'function createCounter(label)'],
])('seeds the %s JavaScript fundamentals workspace', async (challenge, title, expectedScript) => {
  const project = webChallengeProjectSlug('js-fundamentals', challenge)
  state.search = { project, template: 'html-css-js', section: 'js-fundamentals', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<main>')
  fireEvent.click(screen.getByRole('tab', { name: 'script.js' }))
  const script = await screen.findByRole('textbox', { name: 'script.js editor' }) as HTMLTextAreaElement
  expect(script.value).toContain(expectedScript)
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it.each([
  ['dom-events-search-and-filter-list', 'Search and filter list', 'const matches = workshops'],
  ['dom-events-event-propagation-lab', 'Event propagation lab', 'queue.addEventListener'],
  ['dom-events-keyboard-interaction-check', 'Keyboard interaction check', 'function activateTab(index'],
])('seeds the %s DOM and events workspace', async (challenge, title, expectedScript) => {
  const project = webChallengeProjectSlug('dom-events', challenge)
  state.search = { project, template: 'html-css-js', section: 'dom-events', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<main>')
  fireEvent.click(screen.getByRole('tab', { name: 'script.js' }))
  const script = await screen.findByRole('textbox', { name: 'script.js editor' }) as HTMLTextAreaElement
  expect(script.value).toContain(expectedScript)
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it.each([
  ['async-apis-data-loading-states', 'Data loading states', 'async function loadUpdates(outcome)'],
  ['async-apis-race-condition-repair', 'Race-condition repair', 'older request can finish later'],
  ['async-apis-api-choice-check', 'API choice check', "new FormData(form)"],
])('seeds the %s asynchronous browser APIs workspace', async (challenge, title, expectedScript) => {
  const project = webChallengeProjectSlug('async-apis', challenge)
  state.search = { project, template: 'html-css-js', section: 'async-apis', challenge }
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: null, updated_at: null, files })
  render(<Page />)
  expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('<main>')
  fireEvent.click(screen.getByRole('tab', { name: 'script.js' }))
  const script = await screen.findByRole('textbox', { name: 'script.js editor' }) as HTMLTextAreaElement
  expect(script.value).toContain(expectedScript)
  expect(screen.getByRole('button', { name: 'Reset to starter project' })).toBeTruthy()
})

it('confirms and autosaves a challenge reset to its starter files', async () => {
  const challenge = 'browser-trace-a-page-load'
  const project = webChallengeProjectSlug('browser', challenge)
  state.search = { project, template: 'html-css-js', section: 'browser', challenge }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(openPlayground).mockResolvedValue({ slug: project, template: 'html-css-js', entry: 'index.html', revision: 2, updated_at: null,
    files: files.map((file) => file.name === 'index.html' ? { ...file, content: '<html>my edited work</html>' } : file) })
  render(<Page />)
  const html = await screen.findByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement
  expect(html.value).toContain('my edited work')
  const reset = await screen.findByRole('button', { name: 'Reset to starter project' })
  confirm.mockReturnValueOnce(false)
  fireEvent.click(reset)
  expect(html.value).toContain('my edited work')
  expect(savePlayground).not.toHaveBeenCalled()
  fireEvent.click(reset)
  expect(confirm).toHaveBeenCalledWith('Replace this challenge project with its starter files?')
  await waitFor(() => expect((screen.getByRole('textbox', { name: 'index.html editor' }) as HTMLTextAreaElement).value).toContain('Page load trace'))
  await waitFor(() => expect(savePlayground).toHaveBeenCalledWith(project, expect.objectContaining({
    revision: 2, template: 'html-css-js', files: expect.arrayContaining([expect.objectContaining({ name: 'index.html', content: expect.stringContaining('Page load trace') })]),
  })), { timeout: 2500 })
})

it('restores the matching challenge brief when opening its saved project from the project list', async () => {
  const challenge = 'js-fundamentals-function-fluency-set'
  const project = webChallengeProjectSlug('js-fundamentals', challenge)
  vi.mocked(listPlayground).mockResolvedValue({ projects: [{ slug: project, template: 'html-css-js', updated_at: null }],
    templates: [{ id: 'html-css-js', title: 'HTML, CSS and JavaScript' }],
    limits: { max_files: 12, max_total_chars: 60000, max_projects: 100 } })
  render(<Page />)
  await waitFor(() => expect(document.querySelectorAll(`a[data-search*="${project}"]`).length).toBeGreaterThan(1))
  const matchingLinks = document.querySelectorAll(`a[data-search*="${project}"]`)
  const link = matchingLinks.item(matchingLinks.length - 1)
  expect(link?.textContent).toContain('Function fluency set')
  expect(JSON.parse(link?.getAttribute('data-search') ?? '{}')).toEqual({
    project, section: 'js-fundamentals', challenge,
  })
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
