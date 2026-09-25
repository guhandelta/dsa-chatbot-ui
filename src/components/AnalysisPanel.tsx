// Displays structured feedback after a user submits their solution.
import type { AnalysisResult } from '../types'

interface Props { result: AnalysisResult }

export function AnalysisPanel({ result }: Props) {
  return (
    <div className="analysis-panel">
      <p className="overall">{result.overall_feedback}</p>

      {/* Each section maps to a field in AnalysisResult */}
      <Section title="🐛 Mistakes" items={result.mistakes} color="red" />
      <Section title="⚡ Enhancements" items={result.enhancements} color="blue" />
      <Section title="⚠️ Watch-outs & Edge Cases" items={result.watchouts} color="orange" />
      <Section title="🎯 Interview Tips" items={result.interview_tips} color="green" />
    </div>
  )
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <div className={`section section-${color}`}>
      <h3>{title}</h3>
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  )
}
