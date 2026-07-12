import assert from 'node:assert/strict'
import test from 'node:test'
import { screenWakeLockSupported } from '../src/hooks/useScreenWakeLock'

test('screen wake lock support is detected without assuming browser availability', () => {
  assert.equal(screenWakeLockSupported({} as Navigator), false)
  assert.equal(screenWakeLockSupported({ wakeLock: { request: async () => ({}) } } as unknown as Navigator), true)
})
