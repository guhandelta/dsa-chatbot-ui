// Test output and compiler/runtime diagnostics for a free test run or the
// test stage of an evaluation. Hidden test inputs never reach the client, so
// cases are identified by number only.
import type { Diagnostic, TestRun } from '../../lib/workspaceApi'

const PHASE: Record<Diagnostic['phase'], string> = {
  compile: 'Compiler error',
  run: 'Runtime error',
  timeout: 'Time limit exceeded',
}

interface Props {
  result: TestRun
  source: 'run' | 'evaluation'
  onJump?: (file: string, line: number) => void
}

export function TestOutput({ result, source, onJump }: Props) {
  const { status, passed, total, cases, detail, diagnostic } = result
  const heading = source === 'run' ? 'Test run' : 'Evaluation tests'
  const verdict =
    status === 'passed' ? `All ${total} tests passed`
      : status === 'unverified' ? 'Not verified'
        : diagnostic ? PHASE[diagnostic.phase]
          : `${passed} of ${total} tests passed`
  return (
    <section className="island-shell mt-4 rounded-2xl p-5" aria-label={heading}>
      <h2 className="ws-heading">{heading}</h2>
      <p className={status === 'passed' ? 'ev-pass' : status === 'unverified' ? 'ev-neutral' : 'ev-fail'} role="status">
        {verdict}
      </p>
      {cases.length > 0 && (
        <ol className="ws-cases" aria-label="Test cases">
          {cases.map((c) => (
            <li key={c.index} className={c.passed ? 'ev-pass' : 'ev-fail'}>
              <span aria-hidden="true">{c.passed ? '✓' : '✗'}</span> Test {c.index}
              <span className="sr-only">{c.passed ? ' passed' : ' failed'}</span>
            </li>
          ))}
        </ol>
      )}
      {cases.length > 0 && status === 'failed' && (
        <p className="ev-note">Test inputs stay hidden. Use your own examples, or ask the mentor which case to think about.</p>
      )}
      {detail && <p className="ev-note">{detail}</p>}
      {diagnostic && (
        <div className="ws-diagnostic">
          {diagnostic.file && diagnostic.line && (
            <p className="m-0">
              {diagnostic.file}, line {diagnostic.line}{' '}
              {onJump && (
                <button type="button" className="lang-tab" onClick={() => onJump(diagnostic.file!, diagnostic.line!)}>
                  Go to line {diagnostic.line}
                </button>
              )}
            </p>
          )}
          <pre className="ws-pre" tabIndex={0} aria-label={`${PHASE[diagnostic.phase]} output`}>{diagnostic.message}</pre>
        </div>
      )}
    </section>
  )
}
