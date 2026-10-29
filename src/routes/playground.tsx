// Web playground: HTML, CSS, JavaScript and TypeScript with a live preview.
// The preview is a sandboxed, network-less iframe (see lib/preview.ts).
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { getApiErrorMessage } from '../lib/api'
import { hasToken } from '../lib/auth'
import {
  listPlayground, openPlayground, savePlayground, transpileTypeScript,
  type PlaygroundListing, type TsDiagnostic,
} from '../lib/playgroundApi'
import { PREVIEW_SANDBOX, autoRefreshable, buildPreview, loadReactRuntime, needsCompile, needsReact } from '../lib/preview'
import type { WorkspaceFile } from '../lib/workspaceApi'
import { FileTabs } from '../components/workspace/FileTabs'
import { useAutosave, type Saver } from '../components/workspace/useAutosave'
import { useSupportTask } from '../lib/learningSupport'
import { ChallengeBrief, WebCurriculum } from '../components/WebCurriculum'
import { WEB_FUNDAMENTALS, webChallengeProjectSlug } from '../lib/webCurriculum'

export const Route = createFileRoute('/playground')({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: '/login' })
  },
  validateSearch: (search: Record<string, unknown>): { project?: string; template?: string; section?: string; challenge?: string } => ({
    project: typeof search.project === 'string' ? search.project : undefined,
    template: typeof search.template === 'string' ? search.template : undefined,
    section: typeof search.section === 'string' ? search.section : undefined,
    challenge: typeof search.challenge === 'string' ? search.challenge : undefined,
  }),
  component: PlaygroundPage,
})

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/
const MONACO: Record<string, string> = { html: 'html', css: 'css', js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', md: 'markdown', txt: 'plaintext' }

function PlaygroundPage() {
  const { project, template, section, challenge } = Route.useSearch()
  const challengeStarter = WEB_FUNDAMENTALS.find((item) => item.id === section)?.battery
    .find((item) => item.id === challenge)?.starterFiles
  return (
    <main className="page-wrap px-4 py-8">
      <div className="practice-chrome">
        <Link to="/learn">← Learning home</Link>
        <h1 className="display-title my-4 text-3xl font-bold">Web playground</h1>
      </div>
      {project ? <PlaygroundEditor key={project} slug={project} template={template} section={section} challenge={challenge} starterFiles={challengeStarter} /> : <ProjectList />}
    </main>
  )
}

function ProjectList() {
  const navigate = useNavigate()
  const [listing, setListing] = useState<PlaygroundListing | null>(null)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('html-css-js')
  const [error, setError] = useState<string | null>(null)
  const curriculumProjects = new Map(WEB_FUNDAMENTALS.flatMap((section) => section.battery.map((challenge) => [
    webChallengeProjectSlug(section.id, challenge.id),
    { search: { section: section.id, challenge: challenge.id }, title: challenge.title },
  ] as const)))
  useEffect(() => {
    listPlayground().then(setListing).catch((e) => setError(getApiErrorMessage(e)))
  }, [])
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-')
    if (!SLUG.test(slug)) { setError('Use lowercase letters, digits and dashes (up to 40).'); return }
    if (listing?.projects.some((p) => p.slug === slug)) { setError('A project with that name already exists.'); return }
    void navigate({ to: '/playground', search: { project: slug, template } })
  }
  return <div className="space-y-5">
    <WebCurriculum />
    <section className="island-shell rounded-2xl p-5" aria-labelledby="pg-projects">
      <h2 id="pg-projects" className="ws-heading">Your projects</h2>
      {error && <p className="ws-error" role="alert">{error}</p>}
      {listing && listing.projects.length === 0 && <p className="ws-hint">No projects yet.</p>}
      <ul className="ws-list">
        {listing?.projects.map((p) => (
          <li key={p.slug}>
            <Link to="/playground" search={{ project: p.slug, ...curriculumProjects.get(p.slug)?.search }}>
              {curriculumProjects.get(p.slug)?.title ?? p.slug}
            </Link>
            <span className="ws-hint">{listing.templates.find((t) => t.id === p.template)?.title}</span>
          </li>
        ))}
      </ul>
      <form className="ws-row mt-4" onSubmit={create}>
        <label className="ws-grow">
          <span className="sr-only">Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="new-project-name" />
        </label>
        <label>
          <span className="sr-only">Template</span>
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            {(listing?.templates ?? [{ id: 'html-css-js', title: 'HTML, CSS and JavaScript' }]).map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary-btn">Create project</button>
      </form>
    </section>
  </div>
}

interface ConsoleLine { level: 'log' | 'info' | 'warn' | 'error'; text: string }

function PlaygroundEditor({ slug, template: requested, section, challenge, starterFiles }: {
  slug: string
  template?: string
  section?: string
  challenge?: string
  starterFiles?: WorkspaceFile[]
}) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [active, setActive] = useState('index.html')
  const [template, setTemplate] = useState(requested ?? 'html-css-js')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [srcDoc, setSrcDoc] = useState('')
  const [frameKey, setFrameKey] = useState(0)
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [diagnostics, setDiagnostics] = useState<TsDiagnostic[]>([])
  const [running, setRunning] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const compiled = useRef<Record<string, string>>({})
  const runtime = useRef('')
  const token = useRef('')
  const frame = useRef<HTMLIFrameElement | null>(null)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saver = useCallback<Saver>((body) => savePlayground(slug, {
    files: body.files, template: body.template, revision: body.revision, force: body.force,
  }), [slug])
  const autosave = useAutosave(`playground:${slug}`, 'web', ready, 1000, saver)
  useSupportTask({ id: `playground:${slug}`, title: `UI practice · ${slug}`, busy: !ready || running,
    save: async () => { autosave.schedule({ files, entry: 'index.html', template }); await autosave.flushChecked() } })

  const render = useCallback((current: WorkspaceFile[]) => {
    token.current = crypto.randomUUID()
    setConsoleLines([])
    setSrcDoc(buildPreview(current, compiled.current, token.current, runtime.current))
    setFrameKey((k) => k + 1)
  }, [])

  const run = useCallback(async (current: WorkspaceFile[]) => {
    setRunning(true)
    setError(null)
    try {
      runtime.current = needsReact(current) ? await loadReactRuntime() : ''
      if (needsCompile(current)) {
        const result = await transpileTypeScript(current)
        compiled.current = result.outputs
        setDiagnostics(result.diagnostics)
      } else {
        compiled.current = {}
        setDiagnostics([])
      }
      render(current)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setRunning(false)
    }
  }, [render])

  useEffect(() => {
    let alive = true
    openPlayground(slug, requested).then((project) => {
      if (!alive) return
      const initialFiles = project.revision === null && starterFiles?.length
        ? starterFiles.map((file) => ({ ...file }))
        : project.files
      setFiles(initialFiles)
      setTemplate(project.template)
      setActive('index.html')
      autosave.adopt(project.revision, project.updated_at)
      setReady(true)
      void run(initialFiles)
    }).catch((e) => { if (alive) setError(getApiErrorMessage(e)) })
    return () => { alive = false }
  }, [slug, requested, starterFiles])

  // Console output from the preview, accepted only from this iframe and render.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; token?: string; level?: ConsoleLine['level']; text?: string }
      if (event.source !== frame.current?.contentWindow || data?.source !== 'dsa-preview' || data.token !== token.current) return
      const level = (['log', 'info', 'warn', 'error'] as const).includes(data.level as ConsoleLine['level']) ? data.level! : 'log'
      setConsoleLines((lines) => [...lines.slice(-199), { level, text: String(data.text ?? '') }])
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const update = (next: WorkspaceFile[], changed?: string) => {
    setFiles(next)
    autosave.schedule({ files: next, entry: 'index.html', template })
    if (changed && autoRefresh && autoRefreshable(changed)) {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => render(next), 600)
    }
  }
  const resetToStarter = () => {
    if (!starterFiles?.length || !window.confirm('Replace this challenge project with its starter files?')) return
    const next = starterFiles.map((file) => ({ ...file }))
    setActive('index.html')
    update(next)
    void run(next)
  }
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])

  const latest = useRef({ files, run })
  latest.current = { files, run }
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void latest.current.run(latest.current.files))
  }
  const jump = (file: string | null, line: number | null) => {
    if (!file || !line) return
    setActive(file)
    requestAnimationFrame(() => {
      editorRef.current?.revealLineInCenter(line)
      editorRef.current?.setPosition({ lineNumber: line, column: 1 })
      editorRef.current?.focus()
    })
  }

  const current = files.find((f) => f.name === active) ?? files[0]
  if (!current) {
    return error ? <p className="ws-error" role="alert">{error}</p> : <p>Loading project…</p>
  }
  return (
    <div className="pg-grid" onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !(e.target as HTMLElement).closest('.monaco-editor')) {
        e.preventDefault()
        void run(files)
      }
    }}>
      <section className="island-shell rounded-2xl p-5" aria-label="Project files">
        <ChallengeBrief sectionId={section} challengeId={challenge} onResetStarter={resetToStarter} />
        <div className="ws-toolbar">
          <strong>{slug}</strong>
          <Link to="/playground" className="lang-tab">All projects</Link>
          <span className={`ws-save is-${autosave.status}`} role="status">
            {autosave.status === 'saved' ? 'All changes saved' : autosave.status === 'saving' ? 'Saving…'
              : autosave.status === 'unsaved' ? 'Unsaved changes' : autosave.status === 'conflict' ? 'Saved elsewhere'
                : autosave.status === 'error' ? 'Autosave failed' : 'Not saved yet'}
          </span>
        </div>
        {autosave.status === 'conflict' && (
          <div className="error-banner my-2" role="alert">
            This project was saved from another tab or device.{' '}
            <button type="button" className="lang-tab" onClick={() => void autosave.keepMine()}>Keep my version</button>
          </div>
        )}
        <FileTabs files={files} active={current.name} entry="index.html" language="web" multiFile maxFiles={12}
          onSelect={setActive}
          onAdd={(name) => { update([...files, { name, content: '' }]); setActive(name) }}
          onRemove={(name) => { update(files.filter((f) => f.name !== name)); if (active === name) setActive('index.html') }} />
        <div className="editor-frame my-3" id="ws-editor-panel" role="tabpanel" aria-labelledby={`ws-tab-${current.name}`}>
          <Editor height="460px" path={`playground/${slug}/${current.name}`}
            language={MONACO[current.name.split('.').pop() ?? ''] ?? 'plaintext'}
            value={current.content}
            onChange={(v) => update(files.map((f) => (f.name === current.name ? { ...f, content: v ?? '' } : f)), current.name)}
            onMount={onMount} theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14, ariaLabel: `${current.name} editor` }} />
        </div>
        <div className="ws-row">
          <button type="button" className="primary-btn" disabled={running} onClick={() => void run(files)}
            aria-keyshortcuts="Control+Enter Meta+Enter">
            {running ? 'Running…' : 'Run preview'}
          </button>
          <label className="ws-row">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Refresh on HTML and CSS edits
          </label>
        </div>
        <p className="ws-hint">Scripts run when you press Run preview (Ctrl/⌘+Enter). The preview has no network access, so external libraries and images do not load.</p>
        {error && <p className="ws-error" role="alert">{error}</p>}
        {diagnostics.length > 0 && (
          <div className="ws-diagnostic" aria-label="Compiler problems">
            <h3 className="ws-heading">Compiler problems</h3>
            <ul className="ws-list">
              {diagnostics.map((d, i) => (
                <li key={i}>
                  <span className="ws-grow">{d.file ? `${d.file}:${d.line}` : ''} {d.code} {d.message}</span>
                  {d.file && d.line && (
                    <button type="button" className="lang-tab" onClick={() => jump(d.file, d.line)}>Go to line {d.line}</button>
                  )}
                </li>
              ))}
            </ul>
            <p className="ws-hint">The preview still runs; type errors are reported, not enforced.</p>
          </div>
        )}
      </section>
      <section className="island-shell rounded-2xl p-5" aria-label="Preview">
        <h2 className="ws-heading">Preview</h2>
        <iframe key={frameKey} ref={frame} title="Preview of your page" className="pg-frame"
          sandbox={PREVIEW_SANDBOX} srcDoc={srcDoc} referrerPolicy="no-referrer" />
        <div className="pg-console">
          <div className="ws-toolbar">
            <h3 className="ws-heading m-0">Console</h3>
            <button type="button" className="lang-tab" onClick={() => setConsoleLines([])}>Clear</button>
          </div>
          <ol role="log" aria-live="polite" aria-label="Console output" className="pg-log">
            {consoleLines.length === 0 && <li className="ws-hint">Nothing logged yet.</li>}
            {consoleLines.map((line, i) => <li key={i} className={`pg-${line.level}`}>{line.text}</li>)}
          </ol>
        </div>
      </section>
    </div>
  )
}
