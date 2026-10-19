// Markdown with pipe tables. The Compare mode answers with a side-by-side
// table; react-markdown alone renders tables as plain text without the GFM
// plugin, so table blocks are rendered here and everything else as markdown.
import ReactMarkdown from 'react-markdown'

type Block = { kind: 'table'; rows: string[][] } | { kind: 'text'; text: string }

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())

export function splitBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let buffer: string[] = []
  let table: string[][] | null = null
  const flushText = () => {
    if (buffer.join('\n').trim()) blocks.push({ kind: 'text', text: buffer.join('\n') })
    buffer = []
  }
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('|')) {
      flushText()
      table ??= []
      if (!/^\s*\|?\s*:?-{2,}/.test(line)) table.push(cells(line))
    } else {
      if (table) blocks.push({ kind: 'table', rows: table })
      table = null
      buffer.push(line)
    }
  }
  if (table) blocks.push({ kind: 'table', rows: table })
  flushText()
  return blocks
}

// Table cells carry inline markdown such as `code`; render it without a <p>.
const Cell = ({ text }: { text: string }) => <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{text}</ReactMarkdown>

export function RichText({ text }: { text: string }) {
  return <div className="prose prose-sm max-w-none dark:prose-invert">
    {splitBlocks(text).map((block, index) => block.kind === 'text'
      ? <ReactMarkdown key={index}>{block.text}</ReactMarkdown>
      : <div key={index} className="study-table-wrap"><table className="study-table">
        <thead><tr>{block.rows[0].map((cell, i) => <th key={i}><Cell text={cell} /></th>)}</tr></thead>
        <tbody>{block.rows.slice(1).map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}><Cell text={cell} /></td>)}</tr>)}</tbody>
      </table></div>)}
  </div>
}
