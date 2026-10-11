import { describe, expect, it } from 'vitest'

import { DEFAULT_PRODUCTION_API_BASE_URL, resolveApiBaseUrl } from './api'

describe('API backend configuration', () => {
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
})
