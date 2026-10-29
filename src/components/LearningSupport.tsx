import { useLocation } from '@tanstack/react-router'
import { useAuth } from '../lib/auth'
import { LearningSupportProvider, storageKey } from '../lib/learningSupport'
import type { ReactNode } from 'react'

export function LearningSupport({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user } = useAuth()
  const learning = /^\/(chat|practice|track|playground|learn)(\/|$)/.test(location.pathname)
  const fallback = learning ? { id: location.href, title: 'Your learning session' } : null
  let paused: { href: string; title: string } | null = null
  try {
    const saved = user ? JSON.parse(localStorage.getItem(storageKey(user.id, 'last-pause')) ?? 'null') : null
    if (saved && typeof saved.href === 'string' && typeof saved.title === 'string'
      && /^\/(chat|practice|track|playground|learn)(\/|\?|$)/.test(saved.href) && !saved.href.includes('\\')) paused = saved
  } catch { /* Storage can be unavailable. */ }
  return user && learning ? <LearningSupportProvider key={user.id} owner={user.id} fallback={fallback}>
    {paused && paused.href !== location.href && <p className="page-wrap px-4 text-sm"><a href={paused.href}>Continue saved task: {paused.title}</a></p>}
    {children}
  </LearningSupportProvider> : <>{children}</>
}
