import { redirect } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { fetchMe } from './api'
import { hasToken } from './auth'
import type { User } from '../types'

export function canAccessTeaching(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'instructor'
}

/** Check the current server role before mounting staff pages, including direct URLs. */
export async function requireTeachingAccess() {
  if (!hasToken()) throw redirect({ to: '/login' })
  let user: User
  try {
    user = await fetchMe()
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw redirect({ to: '/login' })
    }
    throw error
  }
  if (!canAccessTeaching(user)) throw redirect({ to: '/learn' })
}
