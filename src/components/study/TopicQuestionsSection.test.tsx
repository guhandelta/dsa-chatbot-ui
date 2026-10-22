import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { generateTopicQuestions, TopicQuestionsSection } from './TopicQuestionsSection'
import type { PathNode } from '../../lib/studyApi'

const mockNode: PathNode = {
  id: 'python:stage-01',
  kind: 'stage',
  stage: 1,
  order: 1,
  slug: 'values',
  title: 'Values and arithmetic',
  level: 'L1',
  exercise_id: 'python-01',
  lesson_ids: ['lesson-01'],
  practice: [],
  planned_problems: [],
  checks_available: 3,
  available: true,
  exercise_passed: false,
  check_score: null,
  checks_passed: false,
  complete: false,
  status: 'not-started',
}

describe('TopicQuestionsSection', () => {
  afterEach(cleanup)

  it('renders question prompt for current topic and notifies parent', () => {
    const onQuestionChange = vi.fn()
    render(<TopicQuestionsSection node={mockNode} language="python" onQuestionChange={onQuestionChange} />)

    expect(screen.getByText('Think it through')).toBeTruthy()
    expect(screen.getByText('Topic Questions: Values and arithmetic')).toBeTruthy()
    expect(screen.getByText(/In Python, what are the primary primitive data types/i)).toBeTruthy()
    expect(screen.queryByText(/Give your answer in the chat window below/i)).toBeNull()
    expect(onQuestionChange).toHaveBeenCalledWith(expect.stringContaining('In Python, what are the primary primitive data types'))
  })

  it('rotates reflection questions without claiming graded completion', () => {
    const onRequestMore = vi.fn()
    render(<TopicQuestionsSection node={mockNode} language="python" onRequestMore={onRequestMore} />)

    expect(screen.queryByText('Challenge Completed')).toBeNull()
    expect(screen.queryByText(/Next section unlocked/i)).toBeNull()
    expect(screen.getByText(/not graded checks/i)).toBeTruthy()

    const moreBtn = screen.getByRole('button', { name: /Next reflection question/i })
    fireEvent.click(moreBtn)
    expect(onRequestMore).toHaveBeenCalled()
    expect(screen.getByText(/Explain how operator precedence works in Python/i)).toBeTruthy()
  })
})


describe('language-specific arithmetic examples', () => {
  it('uses Java declarations and division in the Java pathway', () => {
    const question = generateTopicQuestions(mockNode, 'java')[0]
    expect(question.prompt).toContain('In Java,')
    expect(question.codeSnippet).toContain('int a = 7;')
    expect(question.codeSnippet).toContain('System.out.println((double) a / b);')
    expect(question.codeSnippet).not.toContain('let ')
  })

  it('keeps JavaScript examples in the JavaScript pathway', () => {
    expect(generateTopicQuestions(mockNode, 'javascript')[0].codeSnippet).toContain('console.log(a / b)')
  })

  it('does not fall back to JavaScript for another language', () => {
    expect(generateTopicQuestions(mockNode, 'unknown')[0].codeSnippet).toBeUndefined()
  })
})


it.each([
  ['python', 'print(a // b)'], ['javascript', 'console.log'], ['java', 'System.out'],
  ['typescript', 'const a: number'], ['c', '#include <stdio.h>'], ['cpp', 'std::cout'],
  ['rust', 'fn main()'], ['go', 'func main()'], ['csharp', 'System.Console'], ['ruby', 'puts a / b'],
])('provides an arithmetic example in %s', (language, syntax) => {
  expect(generateTopicQuestions(mockNode, language)[0].codeSnippet).toContain(syntax)
})
