// Shows WHY the review reached its verdict. Feedback should be auditable,
// not taken on faith — a claim backed by a failing input is a fact, and the
// learner should be able to see the input.
import type { Evidence } from '../types'

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const { curated, fuzz, complexity } = evidence
  const nothing = !curated && !fuzz?.ran && !complexity?.ran

  if (nothing) {
    return (
      <section className="island-shell mt-4 rounded-2xl p-4">
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          No automated verification was available for this problem, so the
          feedback below is a reading of your code rather than a test result.
        </p>
      </section>
    )
  }

  return (
    <section className="island-shell mt-4 rounded-2xl p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
        How this was verified
      </h3>

      {curated?.results?.map((r) =>
        r.tier === 1 ? (
          <div key={r.language} className="ev-row">
            <span className="ev-name">Curated tests</span>
            <span className={r.status === 'passed' ? 'ev-pass' : 'ev-fail'}>
              {r.passed_cases}/{r.total_cases} passed
            </span>
          </div>
        ) : r.language && r.status === 'unverified' ? (
          <div key={r.language} className="ev-row">
            <span className="ev-name">Curated tests</span>
            <span className="ev-neutral">Not run: {r.detail}</span>
          </div>
        ) : null,
      )}

      {fuzz?.ran && (
        <>
          <div className="ev-row">
            <span className="ev-name">Differential fuzzing</span>
            <span className={fuzz.counterexamples.length ? 'ev-fail' : 'ev-pass'}>
              {fuzz.passed}/{fuzz.total} random inputs matched the reference
            </span>
          </div>
          {fuzz.counterexamples.length > 0 && (
            <ul className="counterexamples">
              {fuzz.counterexamples.map((c, i) => (
                <li key={i}>
                  <code>{c.description}</code>
                </li>
              ))}
            </ul>
          )}
          {fuzz.counterexamples.length === 0 && (
            <p className="ev-note">
              Your logic matched a verified reference solution on every generated
              input. Any comments below are about style or efficiency, not
              correctness.
            </p>
          )}
        </>
      )}

      {complexity?.ran && (
        <div className="ev-row">
          <span className="ev-name">Measured growth</span>
          <span className="ev-neutral">{complexity.estimate}</span>
        </div>
      )}
      {complexity?.ran && (
        <p className="ev-note">
          Timed at input sizes {complexity.sizes.join(', ')}. Wall-clock
          measurement — indicative, not a proof of complexity.
        </p>
      )}
    </section>
  )
}
