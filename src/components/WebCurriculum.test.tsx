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

it('provides offline styling-systems workspaces for tokens, framework comparison, and specificity repair', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'styling-systems')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css'])
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(html, challenge.id).toContain('<link rel="stylesheet" href="styles.css">')
  }

  const workspaces = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    Object.fromEntries((challenge.starterFiles ?? []).map((file) => [file.name, file.content])),
  ]))
  expect(workspaces['styling-systems-refactor-repeated-styles']['styles.css'].match(/#176b50/g)?.length).toBeGreaterThanOrEqual(2)
  expect(workspaces['styling-systems-refactor-repeated-styles']['styles.css'].match(/#20352d/g)?.length).toBeGreaterThanOrEqual(2)
  expect(workspaces['styling-systems-refactor-repeated-styles']['index.html']).toContain('guide-card--featured')
  expect(workspaces['styling-systems-compare-styling-approaches']['index.html']).toContain('Comparison notes')
  expect(workspaces['styling-systems-compare-styling-approaches']['styles.css']).toContain('@media (min-width: 40rem)')
  expect(workspaces['styling-systems-specificity-cleanup']['styles.css']).toContain('!important')
  expect(workspaces['styling-systems-specificity-cleanup']['styles.css']).toContain('#app main p.notice')
})

it('provides offline JavaScript workspaces for pure functions, state debugging, and closures', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'js-fundamentals')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css', 'script.js'])
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    const script = challenge.starterFiles?.find((file) => file.name === 'script.js')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(html, challenge.id).toContain('<script src="script.js"></script>')
    expect(() => new Function(script), `${challenge.id} JavaScript syntax`).not.toThrow()
  }

  const scripts = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    challenge.starterFiles?.find((file) => file.name === 'script.js')?.content ?? '',
  ]))
  expect(scripts['js-fundamentals-function-fluency-set']).toContain('function normalizeName(value)')
  expect(scripts['js-fundamentals-function-fluency-set']).toContain('Complete the helper functions')
  expect(scripts['js-fundamentals-repair-a-state-bug']).toContain('const completedCount = items.filter')
  expect(scripts['js-fundamentals-repair-a-state-bug']).toContain('item.done = checkbox.checked')
  expect(scripts['js-fundamentals-explain-the-closure']).toContain('function createCounter(label)')
  expect(scripts['js-fundamentals-explain-the-closure']).toContain('const recordTrees = createCounter')
})

it('provides accessible DOM and event workspaces for filtering, delegation, and keyboard tabs', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'dom-events')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css', 'script.js'])
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    const script = challenge.starterFiles?.find((file) => file.name === 'script.js')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(html, challenge.id).toContain('<script src="script.js"></script>')
    expect(() => new Function(script), `${challenge.id} JavaScript syntax`).not.toThrow()
  }

  const workspaces = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    Object.fromEntries((challenge.starterFiles ?? []).map((file) => [file.name, file.content])),
  ]))
  expect(workspaces['dom-events-search-and-filter-list']['index.html']).toContain('role="status"')
  expect(workspaces['dom-events-search-and-filter-list']['script.js']).toContain('const matches = workshops')
  expect(workspaces['dom-events-event-propagation-lab']['script.js']).toContain('attachRemoveHandler(button)')
  expect(workspaces['dom-events-event-propagation-lab']['script.js']).toContain('event.target.closest')
  expect(workspaces['dom-events-keyboard-interaction-check']['index.html']).toContain('role="tablist"')
  expect(workspaces['dom-events-keyboard-interaction-check']['script.js']).toContain('tab.tabIndex = selected ? 0 : -1')
})

it('provides offline async and browser API workspaces with explicit states and race conditions', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'async-apis')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css', 'script.js'])
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    const script = challenge.starterFiles?.find((file) => file.name === 'script.js')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(html, challenge.id).toContain('<script src="script.js"></script>')
    expect(() => new Function(script), `${challenge.id} JavaScript syntax`).not.toThrow()
  }

  const workspaces = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    Object.fromEntries((challenge.starterFiles ?? []).map((file) => [file.name, file.content])),
  ]))
  expect(workspaces['async-apis-data-loading-states']['index.html']).toContain('role="alert"')
  expect(workspaces['async-apis-data-loading-states']['script.js']).toContain("if (outcome === 'error') reject")
  expect(workspaces['async-apis-race-condition-repair']['script.js']).toContain('normalized.includes(\'array\') ? 700 : 120')
  expect(workspaces['async-apis-race-condition-repair']['script.js']).toContain('older request can finish later')
  expect(workspaces['async-apis-api-choice-check']['index.html']).toContain('ResizeObserver')
  expect(workspaces['async-apis-api-choice-check']['index.html']).toContain('MutationObserver')
  expect(workspaces['async-apis-api-choice-check']['index.html']).toContain('IntersectionObserver')
  expect(workspaces['async-apis-api-choice-check']['index.html']).toContain('name="reasoning"')
  expect(workspaces['async-apis-api-choice-check']['index.html']).toContain('Check my reasoning')
})

it('provides accessibility audit, live feedback, and semantic repair workspaces', () => {
  const section = WEB_FUNDAMENTALS.find((item) => item.id === 'accessibility')
  expect(section?.battery).toHaveLength(3)
  for (const challenge of section?.battery ?? []) {
    expect(challenge.starterFiles?.map((file) => file.name), challenge.id).toEqual(['index.html', 'styles.css', 'script.js'])
    const html = challenge.starterFiles?.find((file) => file.name === 'index.html')?.content ?? ''
    const script = challenge.starterFiles?.find((file) => file.name === 'script.js')?.content ?? ''
    expect(html, challenge.id).toContain('<main>')
    expect(html, challenge.id).toContain('<script src="script.js"></script>')
    expect(() => new Function(script), `${challenge.id} JavaScript syntax`).not.toThrow()
  }

  const workspaces = Object.fromEntries((section?.battery ?? []).map((challenge) => [
    challenge.id,
    Object.fromEntries((challenge.starterFiles ?? []).map((file) => [file.name, file.content])),
  ]))
  expect(workspaces['accessibility-keyboard-only-audit']['index.html']).toContain('tabindex="-1"')
  expect(workspaces['accessibility-keyboard-only-audit']['styles.css']).toContain(':focus-visible { outline: none; }')
  expect(workspaces['accessibility-accessible-status-messages']['index.html']).toContain('role="status" aria-live="polite"')
  expect(workspaces['accessibility-accessible-status-messages']['index.html']).toContain('role="alert"')
  expect(workspaces['accessibility-semantic-repair-lab']['index.html']).toContain('<div class="action" data-action="save">')
  expect(workspaces['accessibility-semantic-repair-lab']['index.html']).toContain('href="#" data-action="details"')
  expect(workspaces['accessibility-semantic-repair-lab']['script.js']).toContain('Save action simulated for this exercise.')
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
