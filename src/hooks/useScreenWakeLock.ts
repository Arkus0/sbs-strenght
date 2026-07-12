import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeLockStatus = 'requesting' | 'active' | 'released' | 'unsupported' | 'error'

interface WakeLockSentinelLike {
  released?: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void, options?: { once?: boolean }) => void
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

export function screenWakeLockSupported(navigatorValue: Navigator = navigator): boolean {
  return Boolean((navigatorValue as unknown as NavigatorWithWakeLock).wakeLock?.request)
}

export function useScreenWakeLock(enabled = true): { status: WakeLockStatus; retry: () => Promise<void> } {
  const [status, setStatus] = useState<WakeLockStatus>(() => screenWakeLockSupported() ? 'released' : 'unsupported')
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const requestingRef = useRef(false)
  const desiredRef = useRef(enabled)
  desiredRef.current = enabled

  const release = useCallback(async (): Promise<void> => {
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    if (sentinel && !sentinel.released) {
      try { await sentinel.release() } catch { /* The platform may have released it first. */ }
    }
    if (desiredRef.current) setStatus(screenWakeLockSupported() ? 'released' : 'unsupported')
  }, [])

  const retry = useCallback(async (): Promise<void> => {
    if (!desiredRef.current || document.visibilityState !== 'visible') return
    const wakeLock = (navigator as unknown as NavigatorWithWakeLock).wakeLock
    if (!wakeLock?.request) {
      setStatus('unsupported')
      return
    }
    if (sentinelRef.current && !sentinelRef.current.released) {
      setStatus('active')
      return
    }
    if (requestingRef.current) return
    requestingRef.current = true
    setStatus('requesting')
    try {
      const sentinel = await wakeLock.request('screen')
      if (!desiredRef.current) {
        await sentinel.release()
        return
      }
      sentinelRef.current = sentinel
      setStatus('active')
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null
        if (!desiredRef.current) return
        setStatus(document.visibilityState === 'hidden' ? 'released' : 'error')
      }, { once: true })
    } catch {
      if (desiredRef.current) setStatus('error')
    } finally {
      requestingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      desiredRef.current = false
      void release()
      return undefined
    }
    desiredRef.current = true
    void retry()
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void retry()
      else setStatus(screenWakeLockSupported() ? 'released' : 'unsupported')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      desiredRef.current = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void release()
    }
  }, [enabled, release, retry])

  return { status, retry }
}
