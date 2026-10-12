import { act, cleanup, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, api } from '../services/api'
import { useBackendHealth } from './useBackendHealth'

vi.mock('../services/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/api')>()
  return { ...actual, api: { ...actual.api, getHealth: vi.fn() } }
})

const getHealth = vi.mocked(api.getHealth)
const healthyResponse = { status: 'ok', model_loaded: true }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useBackendHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getHealth.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('stays Checking while a valid health check is pending, then becomes Online', async () => {
    const pending = deferred<typeof healthyResponse>()
    getHealth.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useBackendHealth())

    expect(result.current).toBeNull()
    expect(getHealth).toHaveBeenCalledWith(65_000, expect.any(AbortSignal))
    await act(async () => pending.resolve(healthyResponse))
    expect(result.current).toBe(true)
  })

  it('retries after failures with bounded backoff and recovers to Online', async () => {
    getHealth
      .mockRejectedValueOnce(new ApiRequestError('unavailable', 'network_or_cors'))
      .mockResolvedValueOnce(healthyResponse)
    const { result } = renderHook(() => useBackendHealth())

    await act(async () => { await Promise.resolve() })
    expect(result.current).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(getHealth).toHaveBeenCalledTimes(2)
    expect(result.current).toBe(true)
  })

  it('does not overlap requests and aborts the in-flight request on unmount', async () => {
    const pending = deferred<typeof healthyResponse>()
    getHealth.mockReturnValue(pending.promise)
    const { unmount } = renderHook(() => useBackendHealth())
    const signal = getHealth.mock.calls[0][1]

    await act(async () => { await vi.advanceTimersByTimeAsync(65_000) })
    expect(getHealth).toHaveBeenCalledTimes(1)
    unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => pending.reject(new Error('late failure')))
  })

  it('ignores a late failure from the cleaned-up health check', async () => {
    const staleRequest = deferred<typeof healthyResponse>()
    const currentRequest = deferred<typeof healthyResponse>()
    getHealth
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(currentRequest.promise)
    const { result } = renderHook(() => useBackendHealth(), { wrapper: StrictMode })

    expect(getHealth).toHaveBeenCalledTimes(2)
    await act(async () => currentRequest.resolve(healthyResponse))
    expect(result.current).toBe(true)
    await act(async () => staleRequest.reject(new Error('late failure')))
    expect(result.current).toBe(true)
  })

  it('clears scheduled polling on unmount', async () => {
    getHealth.mockResolvedValue(healthyResponse)
    const { unmount } = renderHook(() => useBackendHealth())
    await act(async () => { await Promise.resolve() })
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(getHealth).toHaveBeenCalledTimes(1)
  })
})
