import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendAccessoryProgression } from '../src/lib/accessoryProgression'
import { deriveAnalytics, epleyE1rm } from '../src/lib/analytics'
import { generateSchedule, redistributeFutureSessions } from '../src/lib/schedule'
import { exportV3State, migrateLegacyState, parseStateImport } from '../src/lib/stateV3'
import { createDefaultSetup } from '../src/lib/sbsRtf.js'
import template from '../src/data/sbsRtfTemplate.json'

const performed = (sessionId: string, reps: number[], load = 20) => ({
  sessionId,
  load,
  repMin: 8,
  repMax: 12,
  deload: false,
  status: 'performed' as const,
  sets: reps.map((value) => ({ done: true, reps: value }))
})

test('calendar generation preserves sequence and weekdays across DST-safe local dates', () => {
  const sessions = Array.from({ length: 6 }, (_, index) => ({ id: `W1D${index + 1}`, week: 1, day: index + 1, deload: false }))
  let id = 0
  const schedule = generateSchedule(sessions, 'program', '2026-03-27', [1, 3, 5], () => `id-${++id}`)
  assert.deepEqual(schedule.map((item) => item.scheduledDate), ['2026-03-27', '2026-03-30', '2026-04-01', '2026-04-03', '2026-04-06', '2026-04-08'])
  const redistributed = redistributeFutureSessions(schedule, 3, '2026-04-10', [2, 4])
  assert.deepEqual(redistributed.slice(0, 3).map((item) => item.scheduledDate), schedule.slice(0, 3).map((item) => item.scheduledDate))
  assert.deepEqual(redistributed.slice(3).map((item) => item.scheduledDate), ['2026-04-14', '2026-04-16', '2026-04-21'])
  assert.deepEqual(redistributed.map((item) => item.sequenceIndex), [0, 1, 2, 3, 4, 5])
})

test('accessory progression covers choose, increase, repeat and two-strike reduction', () => {
  assert.equal(recommendAccessoryProgression({ history: [], loadStep: 2.5 }).action, 'choose')
  assert.deepEqual(recommendAccessoryProgression({ history: [performed('W1D1', [12, 12, 12])], loadStep: 2.5 }), {
    action: 'increase', recommendedLoad: 22.5, targetTotalReps: 24,
    reason: 'Todas las series alcanzaron 12 reps: sube un incremento.', sourceSessionIds: ['W1D1']
  })
  assert.equal(recommendAccessoryProgression({ history: [performed('W1D1', [10, 10, 10])], loadStep: 2.5 }).targetTotalReps, 31)
  const reduced = recommendAccessoryProgression({ history: [performed('W1D1', [7, 7, 7]), performed('W2D1', [7, 7, 7])], loadStep: 2.5 })
  assert.equal(reduced.action, 'reduce')
  assert.equal(reduced.recommendedLoad, 17.5)
})

test('analytics uses only completed sets and labels Epley estimates', () => {
  assert.equal(epleyE1rm(100, 10), 133.3)
  const schedule: any[] = [{ id: '1', programId: 'p', code: 'W1D1', sequenceIndex: 0, week: 1, day: 1, scheduledDate: '2020-01-01', status: 'completed', deload: false, createdAt: '', updatedAt: '', version: 1 }]
  const logs = { W1D1: { status: 'completed', activeSeconds: 3600, lifts: { main_1: { sets: [{ kind: 'work', done: true, weight: 100, reps: 5 }, { kind: 'amrap', done: true, weight: 100, reps: 10 }, { kind: 'work', done: false, weight: 100, reps: 5 }] } }, bodybuilding: [], conditioning: { status: 'completed' } } }
  const result = deriveAnalytics({ schedule, logs, liftNames: { main_1: 'Squat' } })
  assert.equal(result.completedSets, 2)
  assert.equal(result.weekly[0].tonnage, 1500)
  assert.equal(result.liftSeries.main_1[0].e1rm, 133.3)
  assert.equal(result.conditioningCompleted, 1)
})

test('v2 migration preserves draft logs and v3 export round-trips', () => {
  const setup: any = createDefaultSetup(template)
  setup.completedAt = '2026-01-01T00:00:00.000Z'
  for (const slot of template.defaults.liftSlots) setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  const legacy = {
    setup,
    selectedSessionId: 'W1D1',
    logs: { W1D1: { id: 'W1D1', week: 1, day: 1, status: 'draft', startedAt: '2026-07-11T10:00:00.000Z', lifts: {} } }
  }
  const migrated = migrateLegacyState(legacy)
  assert.equal(migrated.schemaVersion, 3)
  assert.equal(migrated.logs.W1D1.status, 'draft')
  assert.equal(migrated.schedule.find((session) => session.code === 'W1D1')?.status, 'draft')
  assert.equal(migrated.programs[migrated.activeProgramId].setup.lifts.main_1.trainingMax, template.defaults.liftSlots[0].defaultTrainingMax)
  const restored = parseStateImport(exportV3State(migrated))
  assert.deepEqual(restored, migrated)
})
