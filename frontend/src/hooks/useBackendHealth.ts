import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../services/api'

const HEALTH_TIMEOUT_MS = 65_000
const HEALTH_POLL_INTERVAL_MS = 15_000
const HEALTH_RETRY_BASE_MS = 3_000
const HEALTH_RETRY_MAX_MS = 30_000

export function useBackendHealth(): boolean | null {
  const [health, setHealth] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let requestSequence = 0
    let failureCount = 0
    let timer: number | undefined
    let activeController: AbortController | undefined

    const scheduleNextCheck = (delay: number) => {
      if (!cancelled) timer = window.setTimeout(() => void checkHealth(), delay)
    }

    const checkHealth = async () => {
      if (cancelled || inFlight) return

      inFlight = true
      const sequence = ++requestSequence
      const controller = new AbortController()
      activeController = controller

      try {
        await api.getHealth(HEALTH_TIMEOUT_MS, controller.signal)
        if (cancelled || sequence !== requestSequence) return
        failureCount = 0
        setHealth(true)
        scheduleNextCheck(HEALTH_POLL_INTERVAL_MS)
      } catch (error) {
        if (cancelled || sequence !== requestSequence) return
        failureCount += 1
        setHealth(false)
        if (error instanceof ApiRequestError) {
          console.warn(`[VIGIL health check: ${error.kind}]`, error.message)
        } else {
          console.warn('[VIGIL health check: unexpected error]', error)
        }
        const retryDelay = Math.min(
          HEALTH_RETRY_BASE_MS * 2 ** (failureCount - 1),
          HEALTH_RETRY_MAX_MS
        )
        scheduleNextCheck(retryDelay)
      } finally {
        if (sequence === requestSequence) {
          inFlight = false
          activeController = undefined
        }
      }
    }

    void checkHealth()

    return () => {
      cancelled = true
      requestSequence += 1
      if (timer !== undefined) window.clearTimeout(timer)
      activeController?.abort()
    }
  }, [])

  return health
}
