// Section for topic-specific questions situated between the module info (NodeCard)
// and the chat window (Explain/Debug/Compare modes).
// The middle card contains ONLY the questions. The student provides input in the chat window below.
import { useEffect, useState } from 'react'
import { HelpCircle, RefreshCw } from 'lucide-react'
import type { PathNode } from '../../lib/studyApi'

interface Props {
  node: PathNode
  language: string
  onQuestionChange?: (questionPrompt: string) => void
  onRequestMore?: () => void
}

export interface TopicQuestion {
  id: string
  prompt: string
  codeSnippet?: string
  hint?: string
}

export function generateTopicQuestions(node: PathNode, language: string): TopicQuestion[] {
  const lang = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Programming'
  const title = node.title
  const slug = node.slug || ''

  // Only show examples authored for the selected language.
  const arithmeticExamples: Record<string, string> = {
    python: '# Example\na = 7\nb = 2\nprint(a / b)\nprint(a // b)',
    javascript: '// JavaScript uses Number division\nlet a = 7;\nlet b = 2;\nconsole.log(a / b);\nconsole.log(Math.trunc(a / b));',
    java: '// Compare integer and floating-point division\nint a = 7;\nint b = 2;\nSystem.out.println(a / b);\nSystem.out.println((double) a / b);',
    typescript: 'const a: number = 7;\nconst b: number = 2;\nconsole.log(a / b);\nconsole.log(Math.trunc(a / b));',
    c: '#include <stdio.h>\nint main(void) {\n    int a = 7, b = 2;\n    printf("%d %g\\n", a / b, (double) a / b);\n    return 0;\n}',
    cpp: '#include <iostream>\nint main() {\n    int a = 7, b = 2;\n    std::cout << a / b << " " << static_cast<double>(a) / b << "\\n";\n}',
    rust: 'fn main() {\n    let a: i32 = 7;\n    let b: i32 = 2;\n    println!("{} {}", a / b, a as f64 / b as f64);\n}',
    go: 'package main\nimport "fmt"\nfunc main() {\n    a, b := 7, 2\n    fmt.Println(a / b, float64(a) / float64(b))\n}',
    csharp: 'int a = 7, b = 2;\nSystem.Console.WriteLine(a / b);\nSystem.Console.WriteLine((double) a / b);',
    ruby: 'a = 7\nb = 2\nputs a / b\nputs a.to_f / b',

  }
  const questions: TopicQuestion[] = []

  if (slug.includes('value') || slug.includes('arithmetic') || title.toLowerCase().includes('value')) {
    questions.push({
      id: `${node.id}-q1`,
      prompt: `In ${lang}, what are the primary primitive data types used for numeric calculations, and how do integer vs. floating-point division behave?`,
      codeSnippet: arithmeticExamples[language.toLowerCase()],
      hint: 'Explain the output of dividing two numbers and whether integers truncate or produce floats.',
    })
    questions.push({
      id: `${node.id}-q2`,
      prompt: `Explain how operator precedence works in ${lang} when combining arithmetic operations, and how parentheses alter evaluation order.`,
      hint: 'Recall PEMDAS / BODMAS rules in programming languages.',
    })
    questions.push({
      id: `${node.id}-q3`,
      prompt: `How are numeric overflows or floating-point precision issues handled in ${lang}? Give an example.`,
      hint: 'Consider decimal rounding or large integer representation.',
    })
  } else if (slug.includes('condition') || title.toLowerCase().includes('condition')) {
    questions.push({
      id: `${node.id}-q1`,
      prompt: `How do conditional statements (if, elif/else if, else) evaluate truthiness and manage branching in ${lang}?`,
      hint: 'Discuss boolean expressions, truthy/falsy values, and short-circuit evaluation.',
    })
    questions.push({
      id: `${node.id}-q2`,
      prompt: `Write or explain how a ternary or conditional expression works in ${lang} compared to standard if/else blocks.`,
      hint: 'Think about concise inline expressions that return a value.',
    })
  } else if (slug.includes('loop') || title.toLowerCase().includes('loop')) {
    questions.push({
      id: `${node.id}-q1`,
      prompt: `Compare bounded iteration (for loops) vs. unbounded iteration (while loops) in ${lang}. When should you choose one over the other?`,
      hint: 'Think about whether the number of iterations is known in advance.',
    })
    questions.push({
      id: `${node.id}-q2`,
      prompt: `Explain how 'break' and 'continue' affect loop execution in ${lang}.`,
      hint: 'Consider terminating loop execution early vs. skipping to the next iteration.',
    })
  } else {
    // General questions for other topics
    questions.push({
      id: `${node.id}-q1`,
      prompt: `In ${lang}, what are the fundamental concepts behind "${title}" and how do you idiomatically write or declare them in code?`,
      hint: `Think about typical syntax, types, and primary use cases in ${lang}.`,
    })
    questions.push({
      id: `${node.id}-q2`,
      prompt: `What common bugs, performance pitfalls, or edge cases should a developer watch out for when implementing "${title}" in ${lang}?`,
      hint: `Consider boundary conditions, null/none safety, scope, or off-by-one errors.`,
    })
    questions.push({
      id: `${node.id}-q3`,
      prompt: `Provide a real-world scenario where "${title}" is used to solve an algorithmic or engineering problem in ${lang}.`,
      hint: `Describe the inputs, expected transformation, and output.`,
    })
  }

  return questions
}

export function TopicQuestionsSection({ node, language, onQuestionChange, onRequestMore }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Reset question index when switching nodes
  useEffect(() => {
    setCurrentIndex(0)
  }, [node.id, language])

  const questions = generateTopicQuestions(node, language)
  const currentQuestion = questions[currentIndex] || questions[0]

  // Broadcast current question prompt to chat window
  useEffect(() => {
    if (currentQuestion) {
      onQuestionChange?.(currentQuestion.prompt)
    }
  }, [currentQuestion, onQuestionChange])

  const handleNextQuestion = () => {
    const nextIdx = (currentIndex + 1) % questions.length
    setCurrentIndex(nextIdx)
    onRequestMore?.()
  }

  return (
    <section
      className="island-shell mb-4 rounded-2xl p-5 border border-[var(--line)] bg-[var(--surface-strong)] transition-all"
      aria-label="Concept reflection"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--lagoon)]/15 text-[var(--lagoon-deep)]">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--kicker)]">
              Think it through
            </span>
            <h3 className="m-0 text-sm font-bold text-[var(--sea-ink)]">
              Topic Questions: {node.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      {/* Active Question Prompt */}
      <div>
        <p className="mb-2 font-semibold text-sm text-[var(--sea-ink)] leading-relaxed">
          {currentQuestion.prompt}
        </p>

        {currentQuestion.codeSnippet && (
          <pre className="quiz-code my-2 p-3 text-xs font-mono rounded-xl bg-black/5 dark:bg-black/30 border border-[var(--line)] overflow-x-auto">
            <code>{currentQuestion.codeSnippet}</code>
          </pre>
        )}

        {currentQuestion.hint && (
          <p className="mb-3 text-xs text-[var(--sea-ink-soft)] italic">
            Hint: {currentQuestion.hint}
          </p>
        )}

        <p className="text-xs text-[var(--sea-ink-soft)]">Use these prompts to discuss the concept. They are not graded checks.</p>
        <button type="button" onClick={handleNextQuestion} className="mini-btn mt-2 inline-flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />Next reflection question
        </button>
      </div>
    </section>
  )
}
