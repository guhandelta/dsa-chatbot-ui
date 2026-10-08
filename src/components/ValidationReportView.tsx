// Renders the training pipeline's verification report so an instructor can see
// exactly what was executed, what was corrected, and why something didn't publish.
import type { TrainResult } from '../types'

const STATUS_CLASS: Record<string, string> = {
  passed: 'vr-pass',
  failed: 'vr-fail',
  unverified: 'vr-unverified',
  error: 'vr-fail',
}

const LANG_LABEL: Record<string, string> = {
  python: 'Python', javascript: 'JavaScript', java: 'Java',
  cpp: 'C++', c: 'C', rust: 'Rust',
}

export function ValidationReportView({ result }: { result: TrainResult }) {
  const published = result.status === 'published'
  const { validation } = result

  return (
    <section className="island-shell mt-5 rounded-2xl p-5">
      <div className={`vr-banner ${published ? 'vr-pass' : 'vr-fail'}`}>
        {published
          ? `Published — “${result.title}” is now in the knowledge base and searchable.`
          : `Not published — “${result.title}” failed verification and was saved as a draft.`}
      </div>

      <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
        Verification by language
      </h3>
      <ul className="vr-list">
        {validation.results.map((r) => (
          <li key={r.language} className={STATUS_CLASS[r.status]}>
            <span className="vr-lang">{LANG_LABEL[r.language] ?? r.language}</span>
            <span className="vr-status">{r.status}</span>
            <span className="vr-cases">
              {r.tier === 1 ? `${r.passed_cases}/${r.total_cases} tests` : 'compile check'}
            </span>
            {r.detail && <span className="vr-detail">{r.detail}</span>}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
        <strong>Cross-language agreement:</strong> {validation.agreement_detail}
      </p>

      {result.generated_languages.length > 0 && (
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          <strong>Written for you:</strong>{' '}
          {result.generated_languages.map((l) => LANG_LABEL[l] ?? l).join(', ')}
        </p>
      )}

      {result.unverified_languages.length > 0 && (
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          <strong>Unverified:</strong>{' '}
          {result.unverified_languages.map((l) => LANG_LABEL[l] ?? l).join(', ')} — no
          toolchain installed, so these were reviewed but not executed.
        </p>
      )}

      {result.issues_found.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            Issues found in your submission
          </h3>
          <ul className="vr-bullets">
            {result.issues_found.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </>
      )}

      {Object.keys(result.corrections).length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            Corrections applied
          </h3>
          {Object.entries(result.corrections).map(([lang, fixes]) => (
            <div key={lang} className="mb-2">
              <strong className="text-sm">{LANG_LABEL[lang] ?? lang}</strong>
              <ul className="vr-bullets">
                {fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--lagoon-deep)]">
          View generated knowledge-base entry
        </summary>
        <pre className="vr-markdown">{result.markdown}</pre>
      </details>
    </section>
  )
}
