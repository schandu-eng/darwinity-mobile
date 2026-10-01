import { Mixpanel } from 'mixpanel-react-native'
import { Platform } from 'react-native'

const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? ''

const _mp = TOKEN ? new Mixpanel(TOKEN, false) : null

let _initialized = false

export async function initAnalytics(): Promise<void> {
  if (!_mp || _initialized) return
  await _mp.init()
  _mp.registerSuperProperties({ platform: Platform.OS, environment: __DEV__ ? 'development' : 'production' })
  _initialized = true
}

export const analytics = {
  identify(userId: string, properties: Record<string, unknown> = {}): void {
    if (!_mp || !_initialized) return
    _mp.identify(userId)
    if (Object.keys(properties).length > 0) {
      _mp.getPeople().set(properties)
    }
  },

  setPeople(properties: Record<string, unknown> = {}): void {
    if (!_mp || !_initialized || Object.keys(properties).length === 0) return
    _mp.getPeople().set(properties)
  },

  track(event: string, properties: Record<string, unknown> = {}): void {
    if (!_mp || !_initialized) return
    _mp.track(event, properties)
  },

  timeEvent(event: string): void {
    if (!_mp || !_initialized || !event) return
    _mp.timeEvent(event)
  },

  reset(): void {
    if (!_mp || !_initialized) return
    _mp.reset()
  },
}
