import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { fetchProgressOverview, type ProgressOverview, type ProgressSection } from '../../lib/studyApi'

function ProgressRing({ section }: { section: ProgressSection }) {
  const total = section.total ?? 0
  const done = total ? (section.completed ?? 0) / total * 100 : 0
  const started = total ? section.in_progress / total * 100 : 0
  return <svg viewBox="0 0 120 120" width="120" height="120" role="img"
    aria-label={`${section.title}: ${section.completed} of ${total} ${section.metric.toLowerCase()}, ${section.in_progress} unfinished`}>
    <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="10" />
    <g transform="rotate(-90 60 60)" fill="none" strokeWidth="10">
      <circle cx="60" cy="60" r="48" pathLength="100" stroke="#e7ac59" strokeDasharray={`${Math.min(100, done + started)} 100`} />
      <circle cx="60" cy="60" r="48" pathLength="100" stroke="#39b9a6" strokeDasharray={`${Math.min(100, done)} 100`} />
    </g>
    <text x="60" y="65" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="bold">{Math.min(100, Math.round(done))}%</text>
  </svg>
}

export function ProgressCharts({ language }: { language: string }) {
  const [data, setData] = useState<ProgressOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setData(null); setError(null)
    fetchProgressOverview(language).then(value => { if (active) setData(value) })
      .catch(err => { if (active) setError(getApiErrorMessage(err)) })
    return () => { active = false }
  }, [language, retry])
  return <section className="island-shell rounded-2xl p-4" aria-label="Progress by section">
    <h2 className="m-0 text-lg font-bold">Your progress in {language === 'cpp' ? 'C++' : language === 'csharp' ? 'C#' : language}</h2>
    <p className="my-2 text-sm">Each section measures different work. Green: completed · Amber: started but unfinished · Unfilled: remaining. Debugging measures self-review activity.</p>
    {error && <div role="alert"><p>{error}</p><button className="mini-btn" onClick={() => setRetry(n => n + 1)}>Retry progress charts</button></div>}
    {!error && !data && <p role="status">Loading progress charts…</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {data?.sections.map(section => <article key={section.id} className="rounded-xl border border-[var(--line)] p-4">
        <h3 className="m-0 font-bold">{section.title}</h3>
        {section.status === 'coming-soon' && <p className="tier-chip my-2">Coming soon</p>}
        {section.status === 'content-incomplete' && <p className="tier-chip my-2">Curriculum still being built</p>}
        {section.total !== null && section.total > 0 && <div className="flex items-center gap-3">
          <ProgressRing section={section} />
          <p className="text-sm"><strong>{section.completed} / {section.total}</strong><br />{section.metric}<br />{section.in_progress} started but unfinished</p>
        </div>}
        <p className="mb-0 text-xs">{section.detail}</p>
      </article>)}
    </div>
  </section>
}
