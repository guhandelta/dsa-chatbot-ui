import { useEffect } from 'react'
import { LANGUAGE_LABELS, useLanguageAccess } from '../lib/languageAccess'

interface Props {
  value: string
  onChange: (lang: string) => void
  supported?: string[]
}

export function LanguageSelector({ value, onChange, supported }: Props) {
  const access = useLanguageAccess()
  const languages = access.isError ? [] : (access.data?.languages ?? []).filter(l => !supported || supported.includes(l))
  const selected = languages.includes(value) ? value : languages[0] ?? ''
  useEffect(() => {
    if (selected && selected !== value) onChange(selected)
  }, [selected, value, onChange])
  return (
    <label className="selector">
      <span className="selector-label">Language</span>
      <select value={selected} disabled={access.isPending || !languages.length || access.isError}
        onChange={(e) => onChange(e.target.value)}>
        {!languages.length && <option value="">{access.isPending ? 'Loading languages…' : 'No available languages'}</option>}
        {languages.map(language => <option key={language} value={language}>{LANGUAGE_LABELS[language] ?? language}</option>)}
      </select>
      {access.isError && <span role="alert">Language access could not be loaded.</span>}
    </label>
  )
}
