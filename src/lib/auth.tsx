// Auth state for the whole app: current user, peppercorn balance,
// and login/register/logout actions. Token lives in localStorage;
// the user object is re-fetched from /auth/me on page load.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { TOKEN_KEY, fetchMe, loginUser, registerUser } from './api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  setBalance: (peppercorns: number) => void
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  // Restore the session on first load
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setInitializing(false)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setInitializing(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginUser(email, password)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const res = await registerUser(email, password)
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const setBalance = useCallback((peppercorns: number) => {
    setUser((prev) => (prev ? { ...prev, peppercorns } : prev))
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, initializing, login, register, logout, setBalance, setUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Route guard for beforeLoad — true when a token exists. */
export function hasToken(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}
