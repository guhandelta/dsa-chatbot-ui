// Dropdown to choose which LLM provider answers requests.
import type { Provider } from '../types'

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
]

interface Props {
  value: Provider
  onChange: (p: Provider) => void
}

export function ProviderSelector({ value, onChange }: Props) {
  return (
    <label className="selector">
      <span className="selector-label">Model</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Provider)}>
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  )
}
