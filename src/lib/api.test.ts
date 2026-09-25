import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { getApiErrorMessage } from './api'

function axiosErrorWith(status: number, detail?: unknown, code?: string): AxiosError {
  const err = new AxiosError('failed', code)
  if (status) {
    err.response = {
      status,
      data: detail === undefined ? {} : { detail },
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    }
  }
  return err
}

describe('getApiErrorMessage', () => {
  it('surfaces the API detail string when present', () => {
    expect(getApiErrorMessage(axiosErrorWith(400, 'Bad input'))).toBe('Bad input')
  })

  it('gives a friendly message for 402 with no detail', () => {
    expect(getApiErrorMessage(axiosErrorWith(402))).toMatch(/peppercorns/i)
  })

  it('explains a network error', () => {
    expect(getApiErrorMessage(axiosErrorWith(0, undefined, 'ERR_NETWORK'))).toMatch(/backend/i)
  })

  it('falls back for unknown errors', () => {
    expect(getApiErrorMessage(new Error('boom'))).toMatch(/something went wrong/i)
  })
})
