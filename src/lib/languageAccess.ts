import { useQuery } from '@tanstack/react-query'
import { fetchLanguageAccess } from './api'
import { useAuth } from './auth'

export const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript', java: 'Java', typescript: 'TypeScript', python: 'Python',
  cpp: 'C++', c: 'C', rust: 'Rust', ruby: 'Ruby', go: 'Go', html: 'HTML', css: 'CSS', scss: 'Sass / SCSS',
}

export function useLanguageAccess() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['language-access', user?.id], queryFn: fetchLanguageAccess,
    enabled: !!user, refetchOnWindowFocus: true })
}
