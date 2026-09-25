// Dropdown of available problems, loaded from the backend /problems catalog,
// grouped by difficulty. Falls back to a text input if the catalog can't load.
import { useEffect, useState } from 'react'
import { fetchProblems } from '../lib/api'
import type { ProblemMeta } from '../types'

interface Props {
  value: string
  onChange: (problemId: string) => void
}

export function ProblemPicker({ value, onChange }: Props) {
  const [problems, setProblems] = useState<ProblemMeta[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetchProblems()
      .then((list) => {
        setProblems(list)
        // Default to the first problem if none selected yet
        if (list.length && !value) onChange(list[0].id)
      })
      .catch(() => setFailed(true))
  }, [onChange, value])

  if (failed) {
    // Graceful degradation: let the user type an ID if the API is unreachable
    return (
      <label className="selector grow">
        <span className="selector-label">Problem ID</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. two-sum"
        />
      </label>
    )
  }

  const byDifficulty = problems.reduce<Record<string, ProblemMeta[]>>((acc, p) => {
    ;(acc[p.difficulty] ??= []).push(p)
    return acc
  }, {})

  return (
    <label className="selector grow">
      <span className="selector-label">Problem</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(byDifficulty).map(([difficulty, list]) => (
          <optgroup key={difficulty} label={difficulty}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
