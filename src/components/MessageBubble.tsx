// Renders one chat message. Assistant messages are markdown (code blocks,
// lists, etc.); user messages render as plain text.
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types'

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`msg-row ${isUser ? 'msg-row-user' : 'msg-row-bot'}`}>
      <div className={`msg-bubble ${isUser ? 'msg-user' : 'msg-bot'}`}>
        {isUser ? (
          <p className="m-0 whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown components={{ img: () => <span>[Embedded image omitted]</span> }}>{message.content}</ReactMarkdown>
          </div>
        )}
        {!isUser && message.retrieval?.strategy === 'agentic' && (
          <p className="mt-3 text-xs">
            Experimental retrieval: {message.retrieval.searches} searches · {message.retrieval.model_calls} model calls · {(message.retrieval.elapsed_ms / 1000).toFixed(1)} seconds.
            {message.retrieval.fallback && ' A retrieval or answer safeguard was applied.'}
          </p>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <details className="mt-3 text-sm">
            <summary>Reference excerpts</summary>
            {message.sources.map((source, index) => (
              <div key={`${source.document_id}-${index}`} className="mt-2">
                <p className="font-semibold">{source.filename}</p>
                <blockquote className="whitespace-pre-wrap">{source.excerpt}</blockquote>
              </div>
            ))}
            <p>Retrieved reference material; these excerpts do not verify generated claims.</p>
          </details>
        )}
      </div>
    </div>
  )
}
