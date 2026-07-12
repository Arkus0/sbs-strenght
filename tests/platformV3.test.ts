import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendAccessoryProgression } from '../src/lib/accessoryProgression'
import { bodybuildingForSession } from '../src/lib/assistanceProgram.js'
import { deriveAnalytics, deriveTrainingMaxOverview, epleyE1rm, trainingMaxHistoryDisplayMode } from '../src/lib/analytics'
import { deriveCompletionImpact } from '../src/lib/sessionImpact'
import { generateSchedule, redistributeFutureSessions } from '../src/lib/schedule'
import { createFreshState, exportV3State, migrateLegacyState, normalizeV3State, parseStateImport } from '../src/lib/stateV3'
import { buildSessionPlan, createDefaultSetup, createEmptySessionLog, listSessions } from '../src/lib/sbsRtf.js'
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

function completeSetup(frequency = 3): any {
  const setup: any = createDefaultSetup(template)
  setup.frequency = frequency
  for (const slot of template.defaults.liftSlots) setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  return setup
}

function fullSchedule(setup: any): any[] {
  let index = 0
  return generateSchedule(listSessions(template, setup), 'program', '2026-07-13', [1, 3, 5], () => `session-${++index}`)
}

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

test('training max overview uses completed sessions for history and the next appearance for current TM', () => {
  const setup: any = createDefaultSetup(template)
  setup.frequency = 3
  for (const slot of template.defaults.liftSlots) setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  const week1 = buildSessionPlan(template, setup, {}, 1, 1)
  const log1 = createEmptySessionLog(week1)
  const amrap = log1.lifts.main_1.sets.find((set: any) => set.kind === 'amrap')
  amrap.reps = amrap.targetReps + 2
  amrap.done = true
  log1.status = 'completed'
  const schedule: any[] = [
    { id: '1', programId: 'p', code: 'W1D1', sequenceIndex: 0, week: 1, day: 1, scheduledDate: '2020-01-01', status: 'completed', deload: false, createdAt: '', updatedAt: '', version: 1 },
    { id: '2', programId: 'p', code: 'W2D1', sequenceIndex: 3, week: 2, day: 1, scheduledDate: '2020-01-08', status: 'planned', deload: false, createdAt: '', updatedAt: '', version: 1 }
  ]

  const squat = deriveTrainingMaxOverview({ template, setup, schedule, logs: { W1D1: log1 } })
    .find((lift) => lift.slotId === 'main_1')!

  assert.equal(squat.history.length, 1)
  assert.equal(squat.history[0].sessionId, 'W1D1')
  assert.equal(squat.history[0].trainingMax, setup.lifts.main_1.trainingMax)
  assert.equal(squat.currentSessionId, 'W2D1')
  assert.ok(Number(squat.currentTrainingMax) > Number(squat.history[0].trainingMax))
  assert.equal(trainingMaxHistoryDisplayMode(0), 'empty')
  assert.equal(trainingMaxHistoryDisplayMode(4), 'list')
  assert.equal(trainingMaxHistoryDisplayMode(5), 'chart')
})

test('completion impact compares the frozen TM with the next appearance and persists bodybuilding increases', () => {
  const setup = completeSetup()
  const schedule = fullSchedule(setup)
  const plan = buildSessionPlan(template, setup, {}, 1, 1)
  const bodybuilding = bodybuildingForSession(setup, plan, {})
  const log: any = createEmptySessionLog(plan, bodybuilding)
  const squatAmrap = log.lifts.main_1.sets.find((set: any) => set.kind === 'amrap')
  squatAmrap.reps = squatAmrap.targetReps + 2
  squatAmrap.done = true
  const sumoAmrap = log.lifts.aux_5.sets.find((set: any) => set.kind === 'amrap')
  sumoAmrap.reps = sumoAmrap.targetReps - 2
  sumoAmrap.done = true
  const accessory = log.bodybuilding[0]
  accessory.load = 20
  accessory.sets = accessory.sets.map((set: any) => ({ ...set, reps: accessory.repMax, done: true }))
  log.status = 'completed'
  schedule[0].prescriptionSnapshot = structuredClone(plan)

  const summary = deriveCompletionImpact({
    template,
    setup,
    schedule,
    logs: {},
    completedLog: log,
    summary: { id: 'W1D1', durationSeconds: 3600, completedSets: 8, totalSets: 8, exerciseCount: 6 }
  })

  const squat = summary.trainingMaxImpact?.find((impact) => impact.slotId === 'main_1')
  const sumo = summary.trainingMaxImpact?.find((impact) => impact.slotId === 'aux_5')
  assert.equal(summary.impactVersion, 1)
  assert.equal(squat?.before, setup.lifts.main_1.trainingMax)
  assert.equal(squat?.direction, 'increase')
  assert.equal(squat?.nextSessionCode, 'W2D1')
  assert.ok(Number(squat?.after) > Number(squat?.before))
  assert.equal(sumo?.direction, 'decrease')
  assert.ok(Number(sumo?.after) < Number(sumo?.before))
  assert.deepEqual(summary.bodybuildingImpact?.map((impact) => ({ action: impact.action, before: impact.before, after: impact.after, next: impact.nextSessionCode })), [
    { action: 'increase', before: 20, after: 22.5, next: 'W2D1' }
  ])
})

test('completion impact reports a bodybuilding reduction only after the second failed exposure', () => {
  const setup = completeSetup()
  const schedule = fullSchedule(setup)
  const plan1 = buildSessionPlan(template, setup, {}, 1, 1)
  const bodybuilding1 = bodybuildingForSession(setup, plan1, {})
  const log1: any = createEmptySessionLog(plan1, bodybuilding1)
  log1.bodybuilding[0].load = 20
  log1.bodybuilding[0].sets = log1.bodybuilding[0].sets.map((set: any) => ({ ...set, reps: 7, done: true }))
  log1.status = 'completed'

  const logs = { W1D1: log1 }
  const plan2 = buildSessionPlan(template, setup, logs, 2, 1)
  const bodybuilding2 = bodybuildingForSession(setup, plan2, logs)
  const log2: any = createEmptySessionLog(plan2, bodybuilding2)
  log2.bodybuilding[0].load = 20
  log2.bodybuilding[0].sets = log2.bodybuilding[0].sets.map((set: any) => ({ ...set, reps: 7, done: true }))
  log2.status = 'completed'
  schedule[0].status = 'completed'
  schedule[3].status = 'completed'
  schedule[3].prescriptionSnapshot = structuredClone(plan2)

  const summary = deriveCompletionImpact({
    template,
    setup,
    schedule,
    logs,
    completedLog: log2,
    summary: { id: 'W2D1', durationSeconds: 3000, completedSets: 0, totalSets: 0, exerciseCount: 1 }
  })

  assert.deepEqual(summary.bodybuildingImpact?.map((impact) => ({ action: impact.action, before: impact.before, after: impact.after, next: impact.nextSessionCode })), [
    { action: 'reduce', before: 20, after: 17.5, next: 'W3D1' }
  ])
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
  migrated.measurements.push({ id: 'weight-1', kind: 'bodyweight', value: 80, unit: 'kg', measuredAt: '2026-07-01T08:00:00.000Z', createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z', version: 1 })
  const restored = parseStateImport(exportV3State(migrated))
  assert.deepEqual(restored, migrated)
})

test('existing v3 profiles receive local timer feedback defaults without a schema bump', () => {
  const existing = createFreshState() as any
  delete existing.profile.timerPreferences
  const normalized = normalizeV3State(existing)
  assert.deepEqual(normalized.profile.timerPreferences, {
    soundEnabled: true,
    volume: 1,
    vibrationEnabled: true,
    visualAlertEnabled: true
  })
  assert.equal(normalized.schemaVersion, 3)
})

test('completed legacy progression entries are upgraded once without losing values', () => {
  const setup: any = createDefaultSetup(template)
  setup.version = 2
  setup.completedAt = '2026-01-01T00:00:00.000Z'
  for (const slot of template.defaults.liftSlots) setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  const migrated = migrateLegacyState({
    setup,
    logs: {
      W1D1: {
        id: 'W1D1', week: 1, day: 1, status: 'completed',
        lifts: { main_1: { singleAt8: 94, lastSetReps: 13 } }
      }
    }
  })
  const lift = migrated.logs.W1D1.lifts.main_1
  const single = lift.sets.find((set: any) => set.kind === 'single_at8')
  const amrap = lift.sets.find((set: any) => set.kind === 'amrap')
  assert.equal(single.weight, 94)
  assert.equal(single.done, true)
  assert.equal(single.useForAutoregulation, true)
  assert.equal(amrap.reps, 13)
  assert.equal(amrap.done, true)
  assert.equal(migrated.logs.W1D1.progressionSemanticsVersion, 2)
  assert.equal(migrated.programs[migrated.activeProgramId].setup.singlePctReviewRequired, true)
})
