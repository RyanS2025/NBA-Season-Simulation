import { useRef, useState, useCallback, useEffect } from 'react'
import { SimBridge } from './sim-bridge'

interface UseSimBridgeReturn {
  bridge: SimBridge
  initialized: boolean
  initializing: boolean
  error: string | null
  progress: { percent: number; message: string } | null
  initialize: (engineCode: string) => Promise<void>
}

export function useSimBridge(): UseSimBridgeReturn {
  const bridgeRef = useRef(new SimBridge())
  const [initialized, setInitialized] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)

  useEffect(() => {
    return () => {
      bridgeRef.current.terminate()
    }
  }, [])

  const initialize = useCallback(async (engineCode: string) => {
    if (bridgeRef.current.initialized) return

    setInitializing(true)
    setError(null)
    setProgress({ percent: 0, message: 'Starting...' })

    try {
      await bridgeRef.current.init(engineCode, (percent, message) => {
        setProgress({ percent, message })
      })
      setInitialized(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInitializing(false)
      setProgress(null)
    }
  }, [])

  return {
    bridge: bridgeRef.current,
    initialized,
    initializing,
    error,
    progress,
    initialize,
  }
}
