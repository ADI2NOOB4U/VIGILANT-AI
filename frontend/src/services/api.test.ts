import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, baseUrl, DEFAULT_PRODUCTION_API_BASE_URL, resolveApiBaseUrl } from './api'

describe('API backend configuration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the production Render origin when no explicit value is provided in production builds', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe(DEFAULT_PRODUCTION_API_BASE_URL)
  })

  it('accepts HTTPS production origins and local HTTP localhost origins', () => {
    expect(resolveApiBaseUrl('https://vigilant-ai-api.onrender.com/', false)).toBe('https://vigilant-ai-api.onrender.com')
    expect(resolveApiBaseUrl('http://localhost:5000/', false)).toBe('http://localhost:5000')
    expect(resolveApiBaseUrl('http://127.0.0.1:5000/', true)).toBe('http://127.0.0.1:5000')
  })

  it('rejects unsupported protocols, credentials, and origin-attached path/query/fragment data', () => {
    expect(() => resolveApiBaseUrl('ftp://example.com', false)).toThrow(/exact backend origin|Unsupported API base URL protocol/i)
    expect(() => resolveApiBaseUrl('http://example.com/', true)).toThrow(/exact backend origin/i)
    expect(() => resolveApiBaseUrl('https://user:pass@example.com/', false)).toThrow(/exact backend origin/i)
    expect(() => resolveApiBaseUrl('https://vigilant-ai-api.onrender.com/api', false)).toThrow(/exact backend origin/i)
    expect(() => resolveApiBaseUrl('https://vigilant-ai-api.onrender.com?token=abc', false)).toThrow(/exact backend origin/i)
    expect(() => resolveApiBaseUrl('https://vigilant-ai-api.onrender.com#section', false)).toThrow(/exact backend origin/i)
  })

  it('requests the exact health path and accepts only the required healthy fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      model_loaded: true,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getHealth()).resolves.toEqual({ status: 'ok', model_loaded: true })
    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/health`, expect.objectContaining({
      signal: expect.any(AbortSignal),
    }))
  })

  it('omits Content-Type for GET health requests and adds it only for JSON POST bodies', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', model_loaded: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.getHealth()
    await api.scanUrl('https://example.com')

    const healthCall = fetchMock.mock.calls[0][1]
    const scanCall = fetchMock.mock.calls[1][1]
    expect(healthCall.headers).toBeInstanceOf(Headers)
    expect(new Headers(healthCall.headers).has('Content-Type')).toBe(false)
    expect(new Headers(scanCall.headers).get('Content-Type')).toBe('application/json')
  })

  it('rejects a backend health response with model_loaded false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      model_loaded: false,
    }), { status: 200 })))

    await expect(api.getHealth()).rejects.toMatchObject({ kind: 'invalid_response' })
  })

  it('distinguishes malformed successful JSON from HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{bad json', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'warming up' }), { status: 503 })))

    await expect(api.getHealth()).rejects.toMatchObject({ kind: 'invalid_json' })
    await expect(api.getHealth()).rejects.toMatchObject({ kind: 'http', statusCode: 503 })
  })
})
