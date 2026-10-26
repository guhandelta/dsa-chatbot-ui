// File tabs for a practice workspace. Arrow keys move between tabs (the WAI
// tabs pattern); new files are limited to the extensions the language's
// runner accepts, and notes files (.md/.txt) are never executed.
import { useRef, useState } from 'react'
import type { WorkspaceFile } from '../../lib/workspaceApi'

const SOURCE_EXT: Record<string, string[]> = {
  python: ['.py'], javascript: ['.js'], typescript: ['.ts'], java: ['.java'], c: ['.c', '.h'],
  cpp: ['.cpp', '.hpp', '.h'], rust: ['.rs'], ruby: ['.rb'], go: ['.go'], csharp: ['.cs'],
  web: ['.html', '.css', '.js', '.ts'],
}
const NOTE_EXT = ['.md', '.txt']
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/

export const isNotes = (name: string) => NOTE_EXT.some((ext) => name.endsWith(ext))

export function allowedExtensions(language: string, multiFile: boolean): string[] {
  return multiFile ? [...(SOURCE_EXT[language] ?? []), ...NOTE_EXT] : NOTE_EXT
}

export function validateNewFile(name: string, files: WorkspaceFile[], language: string, multiFile: boolean, maxFiles: number): string | null {
  if (files.length >= maxFiles) return `A workspace holds at most ${maxFiles} files.`
  if (!NAME.test(name) || name.includes('..')) return 'Use letters, digits, dots, dashes or underscores.'
  if (files.some((f) => f.name === name)) return 'A file with that name already exists.'
  const allowed = allowedExtensions(language, multiFile)
  if (!allowed.some((ext) => name.endsWith(ext))) return `Allowed extensions: ${allowed.join(', ')}.`
  return null
}

interface Props {
  files: WorkspaceFile[]
  active: string
  entry: string
  language: string
  multiFile: boolean
  maxFiles: number
  disabled?: boolean
  onSelect: (name: string) => void
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}

export function FileTabs({ files, active, entry, language, multiFile, maxFiles, disabled, onSelect, onAdd, onRemove }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const move = (index: number) => {
    const next = (index + files.length) % files.length
    onSelect(files[next].name)
    tabs.current[next]?.focus()
  }
  const add = () => {
    const trimmed = name.trim()
    const problem = validateNewFile(trimmed, files, language, multiFile, maxFiles)
    if (problem) { setError(problem); return }
    onAdd(trimmed)
    setName(''); setError(null); setAdding(false)
  }

  return (
    <div className="ws-files">
      <div role="tablist" aria-label="Workspace files" className="ws-tablist">
        {files.map((file, index) => (
          <span key={file.name} className={`ws-tab${file.name === active ? ' is-active' : ''}`}>
            <button
              type="button"
              role="tab"
              id={`ws-tab-${file.name}`}
              aria-selected={file.name === active}
              aria-controls="ws-editor-panel"
              tabIndex={file.name === active ? 0 : -1}
              ref={(el) => { tabs.current[index] = el }}
              onClick={() => onSelect(file.name)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); move(index + 1) }
                if (e.key === 'ArrowLeft') { e.preventDefault(); move(index - 1) }
                if (e.key === 'Home') { e.preventDefault(); move(0) }
                if (e.key === 'End') { e.preventDefault(); move(files.length - 1) }
              }}
            >
              {file.name}
              {file.name === entry && <span className="ws-badge"> entry</span>}
              {isNotes(file.name) && <span className="ws-badge"> notes</span>}
            </button>
            {file.name !== entry && (
              <button type="button" className="ws-tab-close" disabled={disabled}
                aria-label={`Remove ${file.name}`} onClick={() => onRemove(file.name)}>×</button>
            )}
          </span>
        ))}
      </div>
      {adding ? (
        <form className="ws-add" onSubmit={(e) => { e.preventDefault(); add() }}>
          <label>
            <span className="sr-only">New file name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder={multiFile ? `e.g. helpers${SOURCE_EXT[language]?.[0] ?? '.md'}` : 'e.g. NOTES.md'}
              aria-invalid={Boolean(error)} aria-describedby={error ? 'ws-add-error' : undefined}
              onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setError(null) } }} />
          </label>
          <button type="submit" className="lang-tab">Add</button>
          <button type="button" className="lang-tab" onClick={() => { setAdding(false); setError(null) }}>Cancel</button>
          {error && <p id="ws-add-error" role="alert" className="ws-error">{error}</p>}
        </form>
      ) : (
        <button type="button" className="lang-tab" disabled={disabled || files.length >= maxFiles}
          onClick={() => setAdding(true)}>+ File</button>
      )}
      {!multiFile && <p className="ws-hint">This language runs one source file; add notes as .md or .txt.</p>}
    </div>
  )
}
