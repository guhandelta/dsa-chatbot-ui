import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MessageBubble } from './MessageBubble'

afterEach(cleanup)
it('renders source excerpts as text without interpreting uploaded HTML', () => {
  const { container } = render(<MessageBubble message={{ id: '1', role: 'assistant', content: 'A guiding question?', timestamp: new Date(),
    sources: [{ document_id: 'doc', filename: 'Java arrays.pdf', revision: 'abc', excerpt: '<img src=x onerror="alert(1)"> reference text' }] }} />)
  expect(screen.getByText('Reference excerpts')).toBeTruthy()
  expect(screen.getByText('Java arrays.pdf')).toBeTruthy()
  expect(screen.getByText(/<img src=x/)).toBeTruthy()
  expect(container.querySelector('img')).toBeNull()
})
it('does not add references to a message without retrieved sources', () => {
  render(<MessageBubble message={{ id: '1', role: 'assistant', content: 'Question?', timestamp: new Date() }} />)
  expect(screen.queryByText('Reference excerpts')).toBeNull()
})

it('does not load images supplied by model-generated markdown', () => {
  const { container } = render(<MessageBubble message={{ id:'image',role:'assistant',timestamp:new Date(),
    content:'![private text](https://attacker.example/private)' }} />)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('[Embedded image omitted]')).toBeTruthy()
})
