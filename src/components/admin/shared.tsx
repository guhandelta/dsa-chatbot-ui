import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react'
import { isAxiosError } from 'axios'
import { getApiErrorMessage } from '../../lib/api'
import type { Page } from '../../lib/adminApi'

export const number = (value: number) => value.toLocaleString()
export const date = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded'
export const label = (value: string) => value.replaceAll('_', ' ').replaceAll(':', ' · ')

export function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`ad-panel ${className}`}><div className="ad-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>
}

export function Pill({ value }: { value: string }) {
  const tone = ['active', 'completed', 'published', 'reachable', 'ok'].includes(value) ? 'good' : ['failed', 'rejected', 'suspended', 'error'].includes(value) ? 'bad' : ['pending', 'running', 'needs_review'].includes(value) ? 'warning' : 'neutral'
  return <span className={`ad-pill ${tone}`}>{label(value)}</span>
}

export function QueryNotice({ query }: { query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown } }) {
  if (query.isPending) return <p className="ad-loading" role="status"><LoaderCircle size={17} className="ad-spin" />Loading…</p>
  const missingRoute = isAxiosError(query.error) && query.error.response?.status === 404 && query.error.response?.data?.detail === 'Not Found'
  if (query.isError) return <div className="ad-error" role="alert"><AlertCircle size={18} /><span>{missingRoute ? 'This admin feature is unavailable on the running API. Load the updated API and retry.' : getApiErrorMessage(query.error)}</span><button type="button" className="ad-button" onClick={() => void query.refetch()}>Retry</button></div>
  return null
}

export function Empty({ children = 'No records to show.' }: { children?: ReactNode }) { return <div className="ad-empty">{children}</div> }

export function Pager({ page, setOffset }: { page: Pick<Page<unknown>, 'total' | 'offset' | 'limit'>; setOffset: (offset: number) => void }) {
  return <div className="ad-pager"><span>{page.total ? `${number(page.offset + 1)}–${number(Math.min(page.offset + page.limit, page.total))} of ${number(page.total)}` : '0 results'}</span><div><button type="button" aria-label="Previous page" className="ad-button ad-icon-button" disabled={page.offset === 0} onClick={() => setOffset(Math.max(0, page.offset - page.limit))}><ArrowLeft size={16} /></button><button type="button" aria-label="Next page" className="ad-button ad-icon-button" disabled={page.offset + page.limit >= page.total} onClick={() => setOffset(page.offset + page.limit)}><ArrowRight size={16} /></button></div></div>
}

export function useAdminAction<T = void>(action: (variables: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: action, onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }) })
}

export function ActionMessage({ error, success }: { error?: unknown; success?: string | false }) {
  if (error) return <p className="ad-error" role="alert">{getApiErrorMessage(error)}</p>
  return success ? <p className="ad-success" role="status">{success}</p> : null
}

export function JsonDetail({ data, title = 'View details' }: { data: unknown; title?: string }) {
  return <details className="ad-details"><summary>{title}</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="ad-table-wrap"><table className="ad-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}
