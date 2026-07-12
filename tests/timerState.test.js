import assert from 'node:assert/strict'
import test from 'node:test'
import { createActiveRestTimer, normalizeActiveRestTimer } from '../src/lib/timerState.js'

test('active rest timers use a wall-clock deadline and restore remaining time', () => {
  const timer = createActiveRestTimer({
    id: 'W1D1:main:1',
    label: 'Descanso principal 3:00',
    context: 'Squat · Serie 1',
    durationSeconds: 180,
    now: 1_000
  })
  assert.equal(timer.deadlineAt, new Date(181_000).toISOString())
  assert.equal(timer.remainingSeconds, 180)

  const restored = normalizeActiveRestTimer(timer, 31_000)
  assert.equal(restored.phase, 'running')
  assert.equal(restored.remainingSeconds, 150)
  assert.deepEqual(restored.firedCueIds, [])
})

test('expired restored timers become done without replaying stale countdown cues', () => {
  const timer = createActiveRestTimer({
    id: 'W1D1:main:1',
    label: 'Descanso principal 2:00',
    durationSeconds: 120,
    now: 0
  })
  const restored = normalizeActiveRestTimer(timer, 121_000)
  assert.equal(restored.phase, 'done')
  assert.equal(restored.deadlineAt, null)
  assert.equal(restored.remainingSeconds, 0)
  assert.deepEqual(restored.firedCueIds, [
    'halfway', 'warning-10', 'countdown-3', 'countdown-2', 'countdown-1', 'final'
  ])
})

test('invalid timer payloads are ignored safely', () => {
  assert.equal(normalizeActiveRestTimer(null), null)
  assert.equal(normalizeActiveRestTimer({ version: 1, id: '', durationSeconds: 120 }), null)
  assert.equal(normalizeActiveRestTimer({ version: 1, id: 'x', label: 'Timer', mode: 'countdown', phase: 'running', durationSeconds: 120, deadlineAt: 'invalid' }), null)
})
