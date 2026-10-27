import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { WEB_FUNDAMENTALS, webChallengeProjectSlug } from '../lib/webCurriculum'

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
    expect(section.id).toMatch(/^[a-z0-9-]+$/)
    expect(section.title.trim()).not.toBe('')
    expect(section.lessons.length, `${section.id} lesson topics`).toBeGreaterThanOrEqual(3)
    expect(section.battery.length, `${section.id} challenges`).toBeGreaterThanOrEqual(2)
    expect(new Set(section.battery.map((challenge) => challenge.id)).size, `${section.id} unique challenge IDs`).toBe(section.battery.length)
    for (const challenge of section.battery) {
      expect(challenge.id).toMatch(/^[a-z0-9-]+$/)
      expect(challenge.title.trim()).not.toBe('')
      expect(challenge.task.trim()).not.toBe('')
      expect(['learn', 'build', 'debug', 'review']).toContain(challenge.kind)
      if (challenge.starterFiles) {
        const names = challenge.starterFiles.map((file) => file.name)
        expect(names).toContain('index.html')
        expect(new Set(names).size).toBe(names.length)
        expect(challenge.starterFiles.every((file) => file.content.trim().length > 0)).toBe(true)
      }
    }
    expect(new Set(section.battery.map((challenge) => challenge.kind)).size, `${section.id} challenge variety`).toBeGreaterThan(1)
  }
  expect(new Set(WEB_FUNDAMENTALS.map((section) => section.id)).size).toBe(WEB_FUNDAMENTALS.length)
  const challengeProjects = WEB_FUNDAMENTALS.flatMap((section) => section.battery.map((challenge) =>
    webChallengeProjectSlug(section.id, challenge.id),
  ))
  expect(new Set(challengeProjects).size).toBe(challengeProjects.length)
  expect(challengeProjects.every((slug) => slug.length <= 40 && /^[a-z0-9][a-z0-9-]*$/.test(slug))).toBe(true)
})

it('provides complete offline starter workspaces for each browser-native forms exercise', () => {
  const forms = WEB_FUNDAMENTALS.find((section) => section.id === 'forms')
  expect(forms?.battery).toHaveLength(3)
  for (const challenge of forms?.battery ?? []) {
    const names = challenge.starterFiles?.map((file) => file.name) ?? []
    expect(names, challenge.id).toEqual(expect.arrayContaining(['index.html', 'styles.css', 'script.js']))
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    expect(html).toContain('<form')
    expect(html).toContain('<label')
  }
})

it('provides a CSS file and page scaffold for each CSS foundations challenge', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'css-foundations')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    const css = challenge.starterFiles?.find((file) => file.name === 'styles.css')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(css, challenge.id).toContain('font-family')
  }
  const repair = section?.battery.find((challenge) => challenge.id === 'css-foundations-fix-a-clipped-card')
  expect(repair?.starterFiles?.find((file) => file.name === 'styles.css')?.content).toContain('overflow: hidden')
  expect(repair?.starterFiles?.find((file) => file.name === 'styles.css')?.content).toContain('box-sizing: content-box')
})

it('provides a complete responsive-layout workspace for every core challenge', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'layout-responsive')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css'])
  }

  const workspaces = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    Object.fromEntries((challenge.starterFiles ?? []).map((file) => [file.name, file.content])),
  ]))
  expect(workspaces['layout-responsive-responsive-navigation']['index.html']).toContain('<nav aria-label="Main navigation">')
  expect(workspaces['layout-responsive-responsive-navigation']['styles.css']).toContain('display: flex')
  expect(workspaces['layout-responsive-grid-under-pressure']['styles.css']).toContain('grid-template-columns: repeat(3, 1fr)')
  expect(workspaces['layout-responsive-grid-under-pressure']['styles.css']).toContain('white-space: nowrap')
  expect(workspaces['layout-responsive-viewport-variation-set']['index.html']).toContain('Viewport observations')
  expect(workspaces['layout-responsive-viewport-variation-set']['styles.css']).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
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
  expect(container.querySelector('a[data-search*="js-fundamentals-function-fluency-set"]')).toBeTruthy()
  const firstChallenge = WEB_FUNDAMENTALS[0].battery[0]
  const firstLink = container.querySelector(`a[data-search*="${firstChallenge.id}"]`)
  expect(firstLink?.getAttribute('data-search')).toContain(webChallengeProjectSlug(WEB_FUNDAMENTALS[0].id, firstChallenge.id))
  expect(screen.getByText(/Client-side component UI:/)).toBeTruthy()
})

it('loads a known challenge brief in the editor and ignores malformed challenge identifiers', () => {
  const { rerender } = render(<ChallengeBrief sectionId="js-fundamentals" challengeId="js-fundamentals-function-fluency-set" />)
  expect(screen.getByRole('heading', { name: 'Function fluency set' })).toBeTruthy()
  expect(screen.getByText(/validation, formatting, and deriving display data/)).toBeTruthy()
  rerender(<ChallengeBrief sectionId="js-fundamentals" challengeId="does-not-exist" />)
  expect(screen.queryByRole('region', { name: 'Challenge instructions' })).toBeNull()
})
