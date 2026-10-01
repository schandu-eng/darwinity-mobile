import { useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { analytics } from './analytics'

export function useSessionTracker(
  startEvent: string,
  endEvent: string,
  properties: Record<string, unknown> = {}
): void {
  const startTimeRef = useRef<number | null>(null)
  const accumulatedRef = useRef(0)
  const propsRef = useRef(properties)

  useEffect(() => {
    propsRef.current = properties
  })

  useEffect(() => {
    analytics.track(startEvent, propsRef.current)
    startTimeRef.current = Date.now()
    accumulatedRef.current = 0

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (startTimeRef.current !== null) {
          accumulatedRef.current += Date.now() - startTimeRef.current
          startTimeRef.current = null
        }
      } else if (nextState === 'active') {
        startTimeRef.current = Date.now()
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription.remove()
      let total = accumulatedRef.current
      if (startTimeRef.current !== null) {
        total += Date.now() - startTimeRef.current
      }
      analytics.track(endEvent, {
        ...propsRef.current,
        time_spent_seconds: Math.round(total / 1000),
      })
    }
  }, [startEvent, endEvent])
}
