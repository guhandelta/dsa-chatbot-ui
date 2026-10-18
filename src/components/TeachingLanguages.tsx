import { useEffect, useState } from 'react'
import { fetchAdminLanguages, fetchTeachingAccess, saveTeachingLanguages, getApiErrorMessage } from '../lib/api'
import { LANGUAGE_LABELS } from '../lib/languageAccess'

export function TeachingLanguages({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const [choices, setChoices] = useState<string[]>([])
  const [assigned, setAssigned] = useState<string[]>([])
  const [effective, setEffective] = useState<string[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([fetchAdminLanguages(), fetchTeachingAccess(userId)]).then(([languages, access]) => {
      if (active) { setChoices(languages); setAssigned(access.assigned_languages); setEffective(access.languages) }
    }).catch(e => { if (active) setError(getApiErrorMessage(e)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [userId])
  async function save() {
    setBusy(true); setError(''); setSaved(false)
    try { const access = await saveTeachingLanguages(userId, assigned); setEffective(access.languages); setSaved(true); onSaved?.() }
    catch(e) { setError(getApiErrorMessage(e)) }
    finally { setBusy(false) }
  }
  return <fieldset disabled={busy} className="mt-3 rounded-lg border p-3">
    <legend className="font-semibold">Teaching languages</legend>
    <div className="flex flex-wrap gap-3">{choices.map(language => <label key={language}>
      <input type="checkbox" checked={assigned.includes(language)} onChange={e => { setSaved(false); setAssigned(e.target.checked ? [...assigned, language] : assigned.filter(l => l !== language)) }} />{' '}{LANGUAGE_LABELS[language] ?? language}
    </label>)}</div>
    <p className="my-2 text-sm">Current access: {effective.map(l => LANGUAGE_LABELS[l] ?? l).join(', ') || 'None'}. Saved uploads can also provide language access.</p>
    <button type="button" className="mini-btn" onClick={save}>Save teaching languages</button>
    {saved && <p role="status">Teaching languages saved.</p>}
    {error && <p role="alert">{error}</p>}
  </fieldset>
}
