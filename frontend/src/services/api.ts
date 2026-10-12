import type {
  CitizenActionGuide,
  GlossaryTerm,
  HealthResponse,
  LegalInstrument,
  LegalScenario,
  LegalSearchResult,
  ModelInfo,
  ScanAnalytics,
  ScanResult,
  ScamCaseBroadcast,
  ScamCasesResponse,
  ScamCaseStats,
  StreamEventPayload,
  ThreatFeedStats,
  ThreatIndicatorsResponse,
  ThreatSourceStatus,
} from '../types'

export const DEFAULT_PRODUCTION_API_BASE_URL = 'https://vigilant-ai-api.onrender.com'

function isLocalDevelopmentOrigin(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function resolveApiBaseUrl(value = import.meta.env.VITE_API_BASE_URL, isDev = import.meta.env.DEV): string {
  const candidate = (value ?? '').trim()
  const fallback = isDev ? 'http://localhost:5000' : DEFAULT_PRODUCTION_API_BASE_URL
  const input = candidate || fallback

  try {
    const url = new URL(input)
    const protocol = url.protocol.toLowerCase()
    const isLocalHttp = protocol === 'http:' && isLocalDevelopmentOrigin(url.hostname)

    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('The API base URL must be an exact origin without a path, query, hash, or credentials.')
    }

    if (protocol !== 'https:' && !isLocalHttp) {
      throw new Error('Unsupported API base URL protocol. Use HTTPS in production and HTTP only for localhost-style local development origins.')
    }

    return url.origin
  } catch (error) {
    if (candidate) {
      throw new Error(`VITE_API_BASE_URL must be an exact backend origin, received "${value}".`)
    }
    return fallback
  }
}

export const baseUrl = resolveApiBaseUrl()

export type ApiRequestErrorKind = 'timeout' | 'aborted' | 'network_or_cors' | 'http' | 'invalid_json' | 'invalid_response'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly kind: ApiRequestErrorKind,
    readonly statusCode?: number
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const externalSignal = init?.signal
  const abortFromCaller = () => controller.abort()
  if (externalSignal?.aborted) controller.abort()
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })

  const headers = new Headers(init?.headers ?? undefined)
  const method = (init?.method ?? 'GET').toUpperCase()
  const hasJsonBody = typeof init?.body === 'string' && init.body.length > 0
  if (hasJsonBody && !headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json')
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    })

    let body: unknown = null
    try {
      body = await response.json()
    } catch (error) {
      if (controller.signal.aborted) throw error
      if (response.ok) {
        throw new ApiRequestError('The VIGIL backend returned invalid JSON.', 'invalid_json', response.status)
      }
    }

    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : `VIGIL backend returned HTTP ${response.status}.`
      throw new ApiRequestError(message, 'http', response.status)
    }

    return body as T
  } catch (error) {
    if (error instanceof ApiRequestError) throw error
    if (timedOut) {
      throw new ApiRequestError(`The VIGIL backend did not respond before the ${timeoutMs} ms timeout.`, 'timeout')
    }
    if (controller.signal.aborted) {
      throw new ApiRequestError('The VIGIL backend request was cancelled.', 'aborted')
    }
    const detail = error instanceof Error ? ` (${error.message})` : ''
    throw new ApiRequestError(`VIGIL could not reach the backend service${detail}.`, 'network_or_cors')
  } finally {
    window.clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromCaller)
  }
}

export const api = {
  scanUrl: async (url: string) => {
    const requestId = globalThis.crypto?.randomUUID?.()
    const result = await request<ScanResult>('/scan', {
      method: 'POST',
      headers: requestId ? { 'X-Vigil-Request-Id': requestId } : undefined,
      body: JSON.stringify({ url }),
    })
    return result
  },
  getHistory: () => request<ScanResult[]>('/history'),
  getHistoryItem: (id: number) => request<ScanResult>(`/history/${id}`),
  clearHistory: () => request<{ status: string }>('/history', { method: 'DELETE' }),
  getModelInfo: () => request<ModelInfo>('/model-info'),
  getScanAnalytics: () => request<ScanAnalytics>('/analysis/scan-analytics'),
  getHealth: async (timeoutMs = 65000, signal?: AbortSignal) => {
    const response = await request<HealthResponse>('/health', { signal }, timeoutMs)
    if (!response || response.status !== 'ok' || response.model_loaded !== true) {
      throw new ApiRequestError('The VIGIL backend returned an unhealthy or invalid health response.', 'invalid_response')
    }
    return response
  },

  // MODULE 1: Threat Intelligence Feed API
  getThreatIndicators: (params?: {
    page?: number
    limit?: number
    source?: string
    category?: string
    status?: string
    q?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.source && params.source !== 'ALL') query.set('source', params.source)
    if (params?.category && params.category !== 'ALL') query.set('category', params.category)
    if (params?.status && params.status !== 'ALL') query.set('status', params.status)
    if (params?.q?.trim()) query.set('q', params.q.trim())
    const qStr = query.toString()
    return request<ThreatIndicatorsResponse>(`/threat-feed/indicators${qStr ? `?${qStr}` : ''}`)
  },

  getThreatStats: () => request<ThreatFeedStats>('/threat-feed/stats'),
  getThreatSources: () => request<ThreatSourceStatus[]>('/threat-feed/sources'),
  triggerThreatSync: (limit = 150) =>
    request<{ status: string; results: any[] }>(`/threat-feed/sync?limit=${limit}`, { method: 'POST' }),
  injectTestIndicator: (payload: {
    url: string
    source?: string
    indicator_type?: string
    threat_type?: string
    tags?: string[]
  }) =>
    request<{ status: string; indicator: any }>('/threat-feed/test-inject', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  subscribeThreatStream: (
    onEvent: (event: StreamEventPayload) => void,
    onStatusChange: (status: 'LIVE' | 'RECONNECTING' | 'DISCONNECTED') => void
  ) => {
    let lastEventId: string | null = null
    let eventSource: EventSource | null = null
    let reconnectTimeout: number | null = null
    let isExplicitlyClosed = false
    let retryDelay = 1000

    const connect = () => {
      if (isExplicitlyClosed) return

      const streamUrl = new URL(`${baseUrl}/threat-feed/stream`, window.location.origin)
      if (lastEventId) {
        streamUrl.searchParams.set('last_event_id', lastEventId)
      }

      eventSource = new EventSource(streamUrl.toString())

      eventSource.onopen = () => {
        retryDelay = 1000
        onStatusChange('LIVE')
      }

      const handlePayload = (e: MessageEvent) => {
        if (!e.data) return
        try {
          if (e.lastEventId) lastEventId = e.lastEventId
          const data: StreamEventPayload = JSON.parse(e.data)
          if (data.event_id) lastEventId = data.event_id
          onEvent(data)
        } catch (err) {
          console.warn('[SSE Parse Error]', err)
        }
      }

      eventSource.addEventListener('indicator.new', handlePayload)
      eventSource.addEventListener('indicator.update', handlePayload)
      eventSource.addEventListener('stats.update', handlePayload)
      eventSource.addEventListener('connect', () => {
        onStatusChange('LIVE')
      })

      eventSource.onerror = () => {
        if (isExplicitlyClosed) return
        onStatusChange('RECONNECTING')
        eventSource?.close()
        eventSource = null

        const nextDelay = Math.min(retryDelay, 10000)
        retryDelay = Math.min(retryDelay * 1.5, 10000)
        reconnectTimeout = window.setTimeout(connect, nextDelay)
      }
    }

    connect()

    return () => {
      isExplicitlyClosed = true
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout)
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      onStatusChange('DISCONNECTED')
    }
  },

  // MODULE 2: Cyber Scam Case Broadcast API
  getScamCases: (params?: {
    page?: number
    limit?: number
    scam_type?: string
    status?: string
    severity?: string
    q?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.scam_type && params.scam_type !== 'ALL') query.set('scam_type', params.scam_type)
    if (params?.status && params.status !== 'ALL') query.set('status', params.status)
    if (params?.severity && params.severity !== 'ALL') query.set('severity', params.severity)
    if (params?.q?.trim()) query.set('q', params.q.trim())
    const qStr = query.toString()
    return request<ScamCasesResponse>(`/scam-cases${qStr ? `?${qStr}` : ''}`)
  },

  getScamCaseDetail: (idOrSlug: string) => request<ScamCaseBroadcast>(`/scam-cases/${idOrSlug}`),
  getScamStats: () => request<ScamCaseStats>('/scam-cases/stats'),

  // MODULE 3: India Digital Rights & Cyber Law Knowledge API
  getLegalInstruments: (params?: { category?: string; q?: string }) => {
    const query = new URLSearchParams()
    if (params?.category && params.category !== 'ALL') query.set('category', params.category)
    if (params?.q?.trim()) query.set('q', params.q.trim())
    const qStr = query.toString()
    return request<LegalInstrument[]>(`/legal-knowledge/instruments${qStr ? `?${qStr}` : ''}`)
  },

  getLegalInstrumentDetail: (id: string) => request<LegalInstrument>(`/legal-knowledge/instruments/${id}`),
  getLegalScenarios: (search?: string) => {
    const qStr = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    return request<LegalScenario[]>(`/legal-knowledge/scenarios${qStr}`)
  },
  getLegalScenarioDetail: (id: string) => request<LegalScenario>(`/legal-knowledge/scenarios/${id}`),
  getLegalGlossary: (search?: string) => {
    const qStr = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    return request<GlossaryTerm[]>(`/legal-knowledge/glossary${qStr}`)
  },
  getCitizenGuides: (category?: string) => {
    const qStr = category && category !== 'ALL' ? `?category=${category}` : ''
    return request<CitizenActionGuide[]>(`/legal-knowledge/guides${qStr}`)
  },
  searchLegalKnowledge: (query: string) =>
    request<LegalSearchResult>(`/legal-knowledge/search?q=${encodeURIComponent(query || '')}`),
}
