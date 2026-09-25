// Dropdown to choose the programming language for tutoring + the editor.
const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
]

interface Props {
  value: string
  onChange: (lang: string) => void
}

export function LanguageSelector({ value, onChange }: Props) {
  return (
    <label className="selector">
      <span className="selector-label">Language</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
