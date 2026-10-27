import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WEB_FUNDAMENTALS } from '../lib/webCurriculum'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search }: { children: React.ReactNode; search?: unknown }) => <a data-search={JSON.stringify(search)}>{children}</a>,
}))

import { ChallengeBrief, WebCurriculum } from './WebCurriculum'

afterEach(cleanup)

it('defines an ordered, substantial common web fundamentals spine with a battery in every section', () => {
  expect(WEB_FUNDAMENTALS).toHaveLength(13)
  expect(WEB_FUNDAMENTALS[0].title).toBe('How the browser builds a page')
  expect(WEB_FUNDAMENTALS.at(-1)?.title).toBe('Web fundamentals capstone')
  for (const section of WEB_FUNDAMENTALS) {
    expect(section.lessons.length, `${section.id} lesson topics`).toBeGreaterThanOrEqual(3)
    expect(section.battery.length, `${section.id} challenges`).toBeGreaterThanOrEqual(2)
    expect(new Set(section.battery.map((challenge) => challenge.kind)).size, `${section.id} challenge variety`).toBeGreaterThan(1)
  }
})

it('renders lesson batteries, same-section challenge links, and the current assessment limitation honestly', () => {
  const { container } = render(<WebCurriculum />)
  for (const details of container.querySelectorAll('details')) details.open = true
  expect(screen.getByRole('heading', { name: 'Web Fundamentals' })).toBeTruthy()
  expect(screen.getByText(/do not yet unlock later sections/)).toBeTruthy()
  expect(screen.getByText('Functions:')).toBeTruthy()
  expect(container.querySelectorAll('a').length).toBe(
    WEB_FUNDAMENTALS.reduce((total, section) => total + section.battery.length, 0),
  )
  expect(container.querySelector('a[data-search*="js-fundamentals-0"]')).toBeTruthy()
  expect(screen.getByText(/Client-side component UI:/)).toBeTruthy()
})

it('loads a known challenge brief in the editor and ignores malformed challenge identifiers', () => {
  const { rerender } = render(<ChallengeBrief sectionId="js-fundamentals" challengeId="js-fundamentals-0" />)
  expect(screen.getByRole('heading', { name: 'Function fluency set' })).toBeTruthy()
  expect(screen.getByText(/validation, formatting, and deriving display data/)).toBeTruthy()
  rerender(<ChallengeBrief sectionId="js-fundamentals" challengeId="js-fundamentals-99" />)
  expect(screen.queryByRole('region', { name: 'Challenge instructions' })).toBeNull()
})
