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
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
