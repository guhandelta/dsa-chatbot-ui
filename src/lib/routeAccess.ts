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
  return requireRoleAccess(canAccessTeaching)
}

export async function requireAdminAccess() {
  return requireRoleAccess(user => user.role === 'admin')
}

async function requireRoleAccess(allowed: (user: User) => boolean) {
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
  if (!allowed(user)) throw redirect({ to: '/learn' })
}
