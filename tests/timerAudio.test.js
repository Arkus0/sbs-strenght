import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTimerCue, timerAudioPlan, timerCueSchedule } from '../src/lib/timerAudio.js'

test('countdown timers schedule halfway, warning, countdown and final cues', () => {
  assert.deepEqual(
    timerCueSchedule(120).map((cue) => [cue.id, cue.at]),
    [
      ['halfway', 60],
      ['warning-10', 10],
      ['countdown-3', 3],
      ['countdown-2', 2],
      ['countdown-1', 1],
      ['final', 0]
    ]
  )
})

test('short timers omit halfway but retain the audible countdown', () => {
  assert.deepEqual(
    timerCueSchedule(30).map((cue) => cue.id),
    ['warning-10', 'countdown-3', 'countdown-2', 'countdown-1', 'final']
  )
})

test('timer cues fire once when their threshold is crossed', () => {
  const fired = new Set()
  const halfway = nextTimerCue(120, 60.2, 59.9, fired)
  assert.equal(halfway.id, 'halfway')
  fired.add(halfway.id)
  assert.equal(nextTimerCue(120, 59.9, 59.5, fired), null)

  assert.equal(nextTimerCue(120, 3.2, 2.8, fired).id, 'countdown-3')
  assert.equal(nextTimerCue(120, 2.2, 1.8, fired).id, 'countdown-2')
  assert.equal(nextTimerCue(120, 1.2, 0.8, fired).id, 'countdown-1')
})

test('a throttled timer jumping to zero emits only the final cue', () => {
  assert.equal(nextTimerCue(120, 65, 0, new Set()).id, 'final')
})

test('audio cues are scheduled from the audio clock and skip consumed thresholds', () => {
  assert.deepEqual(
    timerAudioPlan(120, 65, new Set()).map((cue) => [cue.id, cue.delaySeconds]),
    [
      ['halfway', 5],
      ['warning-10', 55],
      ['countdown-3', 62],
      ['countdown-2', 63],
      ['countdown-1', 64],
      ['final', 65]
    ]
  )
  assert.deepEqual(
    timerAudioPlan(120, 9, new Set(['halfway', 'warning-10'])).map((cue) => cue.id),
    ['countdown-3', 'countdown-2', 'countdown-1', 'final']
  )
})
