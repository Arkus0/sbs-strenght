import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  adjustmentRateForDelta,
  buildSessionPlan,
  createDefaultSetup,
  createEmptySessionLog,
  listSessions,
  projectTrainingMax,
  prescribedSetsForLift,
  roundToIncrement,
  sessionId,
  tmOverrideKey
} from '../src/lib/sbsRtf.js'
import { specimenTemplateForSession, timerFromSpecimen } from '../src/data/specimenAssistance.js'
import {
  accessoryCountForLiftCount,
  bodybuildingForSession,
  conditioningOptionsForSession,
  createAssistanceBlocks,
  normalizeBodybuildingItems
} from '../src/lib/assistanceProgram.js'
import { parseImport } from '../src/lib/storage.js'

const template = JSON.parse(fs.readFileSync(new URL('../src/data/sbsRtfTemplate.json', import.meta.url), 'utf8'))

function readySetup(frequency = 3) {
  const setup = createDefaultSetup(template)
  setup.frequency = frequency
  setup.completedAt = '2026-01-01T00:00:00.000Z'
  for (const slot of template.defaults.liftSlots) {
    setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  }
  return setup
}

function specimenForPlan(frequency, week, day) {
  const setup = readySetup(frequency)
  const plan = buildSessionPlan(template, setup, {}, week, day)
  return specimenTemplateForSession({
    week,
    day,
    frequency,
    deload: plan.deload,
    lifts: plan.lifts
  })
}

test('rounds loads to the configured increment', () => {
  assert.equal(roundToIncrement(342.4, 2.5), 342.5)
  assert.equal(roundToIncrement(342.4, 5), 340)
  assert.equal(roundToIncrement(101.24, 0.5), 101)
})

test('generates the expected 3x session layout', () => {
  const setup = readySetup(3)
  const sessions = listSessions(template, setup)

  assert.equal(sessions.length, 63)
  assert.deepEqual(sessions.slice(0, 3).map((session) => session.id), ['W1D1', 'W1D2', 'W1D3'])

  const plan = buildSessionPlan(template, setup, {}, 1, 1)
  assert.deepEqual(plan.lifts.map((lift) => lift.slotId), ['main_1', 'aux_5', 'aux_4'])
  assert.equal(plan.lifts[0].weight, 342.5)
  assert.equal(plan.lifts[0].normalReps, 5)
  assert.equal(plan.lifts[0].repOutTarget, 10)
  assert.equal(plan.lifts[1].weight, 300)
  assert.equal(plan.lifts[1].normalReps, 7)
})

test('single @8 updates the current session training max and load', () => {
  const setup = readySetup(3)
  const logs = {
    [sessionId(1, 1)]: {
      id: 'W1D1',
      lifts: {
        main_1: { singleAt8: 460 }
      }
    }
  }

  const plan = buildSessionPlan(template, setup, logs, 1, 1)
  const squat = plan.lifts.find((lift) => lift.slotId === 'main_1')

  assert.equal(squat.projection.source, 'single_at8')
  assert.equal(squat.projection.trainingMax, 511.111)
  assert.equal(squat.weight, 357.5)
})

test('set logs capture every work set and feed single @8 projection', () => {
  const setup = readySetup(3)
  const plan = buildSessionPlan(template, setup, {}, 1, 1)
  const log = createEmptySessionLog(plan)
  const squatLog = log.lifts.main_1
  const single = squatLog.sets.find((set) => set.kind === 'single_at8')

  assert.equal(squatLog.sets.length, 6)
  assert.equal(squatLog.sets.filter((set) => set.kind === 'work').length, 4)
  assert.equal(squatLog.sets.at(-1).kind, 'amrap')

  single.weight = 460
  const livePlan = buildSessionPlan(template, setup, { W1D1: log }, 1, 1)
  const squat = livePlan.lifts.find((lift) => lift.slotId === 'main_1')

  assert.equal(squat.projection.source, 'single_at8')
  assert.equal(squat.weight, 357.5)
})

test('last-set delta buckets map to the spreadsheet adjustments', () => {
  const adjustments = readySetup(3).adjustments.main_1
  assert.equal(adjustmentRateForDelta(adjustments, -4), -0.05)
  assert.equal(adjustmentRateForDelta(adjustments, -1), -0.02)
  assert.equal(adjustmentRateForDelta(adjustments, 0), 0)
  assert.equal(adjustmentRateForDelta(adjustments, 1), 0.005)
  assert.equal(adjustmentRateForDelta(adjustments, 2), 0.01)
  assert.equal(adjustmentRateForDelta(adjustments, 3), 0.015)
  assert.equal(adjustmentRateForDelta(adjustments, 4), 0.02)
  assert.equal(adjustmentRateForDelta(adjustments, 8), 0.03)
})

test('last-set reps adjust the next appearance of a lift', () => {
  const setup = readySetup(3)
  const logs = {
    W1D1: {
      id: 'W1D1',
      lifts: {
        main_1: { lastSetReps: 15 }
      }
    }
  }

  const projection = projectTrainingMax(template, setup, logs, 'main_1', 2, 1)
  assert.equal(projection.source, 'last_set')
  assert.equal(projection.delta, 5)
  assert.equal(projection.adjustment, 0.03)
  assert.equal(projection.trainingMax, 504.7)
})

test('amrap set reps adjust the next appearance of a lift', () => {
  const setup = readySetup(3)
  const plan = buildSessionPlan(template, setup, {}, 1, 1)
  const log = createEmptySessionLog(plan)
  const amrap = log.lifts.main_1.sets.find((set) => set.kind === 'amrap')
  amrap.reps = 15

  const projection = projectTrainingMax(template, setup, { W1D1: log }, 'main_1', 2, 1)
  assert.equal(projection.source, 'last_set')
  assert.equal(projection.delta, 5)
  assert.equal(projection.trainingMax, 504.7)
})

test('missing logs carry the prior training max forward', () => {
  const setup = readySetup(3)
  const projection = projectTrainingMax(template, setup, {}, 'main_1', 2, 1)

  assert.equal(projection.source, 'initial')
  assert.equal(projection.trainingMax, 490)
})

test('deload weeks do not adjust training max from rep-out entries', () => {
  const setup = readySetup(3)
  const logs = {
    W7D1: {
      id: 'W7D1',
      lifts: {
        main_1: { lastSetReps: 30 }
      }
    }
  }

  const week7 = buildSessionPlan(template, setup, logs, 7, 1).lifts.find((lift) => lift.slotId === 'main_1')
  const week8 = projectTrainingMax(template, setup, logs, 'main_1', 8, 1)

  assert.equal(week7.deload, true)
  assert.equal(week7.repOutTarget, null)
  assert.equal(week8.trainingMax, 490)
})

test('deload weeks keep the spreadsheet single @8 override but no AMRAP adjustment', () => {
  const setup = readySetup(3)
  const week7Plan = buildSessionPlan(template, setup, {}, 7, 1)
  const squat = week7Plan.lifts.find((lift) => lift.slotId === 'main_1')
  const prescribed = prescribedSetsForLift(squat)

  assert.equal(squat.deload, true)
  assert.deepEqual(prescribed.map((set) => set.kind), ['single_at8', 'work', 'work', 'work', 'work', 'work'])
  assert.equal(prescribed[0].optional, true)
  assert.equal(prescribed.some((set) => set.kind === 'amrap'), false)

  const logs = {
    W7D1: {
      id: 'W7D1',
      lifts: {
        main_1: {
          singleAt8: 450,
          lastSetReps: 30
        }
      }
    }
  }
  const week7 = projectTrainingMax(template, setup, logs, 'main_1', 7, 1)
  const week8 = projectTrainingMax(template, setup, logs, 'main_1', 8, 1)

  assert.equal(week7.source, 'single_at8')
  assert.equal(week7.trainingMax, 500)
  assert.equal(week8.trainingMax, 500)
  assert.equal(week8.adjustment, null)
})

test('manual training max overrides apply to the selected week', () => {
  const setup = readySetup(3)
  setup.tmOverrides[tmOverrideKey(2, 'main_1')] = 500

  const plan = buildSessionPlan(template, setup, {}, 2, 1)
  const squat = plan.lifts.find((lift) => lift.slotId === 'main_1')

  assert.equal(squat.projection.source, 'manual_override')
  assert.equal(squat.projection.trainingMax, 500)
  assert.equal(squat.weight, 375)
})

test('specimen assistance is deterministic and sourced from training montage', () => {
  const normal = specimenForPlan(3, 1, 1)
  const repeat = specimenForPlan(3, 1, 1)
  const deload = specimenForPlan(3, 7, 1)

  assert.deepEqual(normal, repeat)
  assert.equal(normal.sourcePolicy, 'training-montage')
  assert.equal(normal.upperBackOptions.length, 3)
  assert.equal(normal.assistanceOptions.length, 5)
  assert.match(`${normal.upperBack.title} ${normal.upperBack.prescription}`, /row|pull|chin|sandbag|carry/i)
  assert.ok(['carry', 'conditioning', 'assistance', 'strength', 'strongman'].includes(normal.assistance.type))
  assert.ok(normal.assistanceOptions.some((option) => option.tags.includes('calisthenics')))
  assert.equal(deload.sourcePolicy, 'training-montage')
  assert.ok(deload.assistance.source.program)
  assert.equal(timerFromSpecimen(normal).seconds >= 0, true)
})

test('specimen template is contextual to the SBS day and cycle phase', () => {
  const squatHingeDay = specimenForPlan(3, 1, 1)
  const pressDay = specimenForPlan(4, 1, 2)
  const deadliftPeak = specimenForPlan(4, 15, 3)

  assert.equal(squatHingeDay.profile.focusList.includes('hinge'), true)
  assert.ok(squatHingeDay.upperBack.source.program)
  assert.ok(squatHingeDay.assistanceOptions.some((option) => option.tags.includes('legs')))

  assert.equal(pressDay.profile.focusList.includes('press'), true)
  assert.ok(pressDay.upperBackOptions.some((option) => option.tags.includes('pull')))
  assert.ok(pressDay.assistanceOptions.some((option) => option.tags.includes('press')))

  assert.equal(deadliftPeak.phase, 'peak')
  assert.equal(deadliftPeak.sourcePolicy, 'training-montage')
})

test('specimen template keeps broad no-sled variety across the 21 week cycle', () => {
  const sessions = []
  const setup = readySetup(3)
  for (let week = 1; week <= 21; week += 1) {
    for (let day = 1; day <= 3; day += 1) {
      const plan = buildSessionPlan(template, setup, {}, week, day)
      sessions.push(specimenTemplateForSession({
        week,
        day,
        frequency: 3,
        deload: plan.deload,
        lifts: plan.lifts
      }))
    }
  }

  const upperBackTitles = new Set(sessions.flatMap((session) => session.upperBackOptions.map((option) => option.title)))
  const assistanceTitles = new Set(sessions.flatMap((session) => session.assistanceOptions.map((option) => option.title)))
  const allOptions = sessions.flatMap((session) => [...session.upperBackOptions, ...session.assistanceOptions])
  const allText = allOptions.map((option) => `${option.title} ${option.prescription}`).join(' ')
  const sandbagOptions = allOptions.filter((option) => option.tags.includes('sandbag'))
  const sandbagSources = new Set(sandbagOptions.map((option) => option.source.program))

  assert.ok(upperBackTitles.size >= 7)
  assert.ok(assistanceTitles.size >= 12)
  assert.ok(allOptions.every((option) => option.source?.program && option.source?.week && option.source?.day))
  assert.ok(sessions.some((session) => session.upperBackOptions.some((option) => option.tags.includes('sandbag'))))
  assert.ok(sessions.some((session) => session.assistanceOptions.some((option) => option.tags.includes('sandbag'))))
  assert.ok(sandbagSources.has('edc'))
  assert.ok(sandbagSources.has('powerbuilder') || sandbagSources.has('powerbuilder_lite'))
  assert.match(sandbagOptions.map((option) => option.prescription).join(' '), /Sandbag/i)
  assert.match(allText, /Push-Ups|Dips|Squats|Pull-Ups/)
  assert.doesNotMatch(allText, /sled|trineo/i)
})

test('bodybuilding dose keeps sessions near six resistance blocks at every frequency', () => {
  for (const frequency of template.meta.frequencies) {
    const setup = readySetup(frequency)
    setup.assistanceBlocks = createAssistanceBlocks(template, frequency)
    const layout = template.layouts[String(frequency)]
    for (const day of layout.days) {
      const plan = buildSessionPlan(template, setup, {}, 1, day.day)
      const assistance = bodybuildingForSession(setup, plan, {})
      assert.equal(assistance.length, 1 + accessoryCountForLiftCount(plan.lifts.length))
      assert.equal(assistance[0].role, 'back')
      assert.ok(assistance.every((item) => item.targetSets === 3))
    }
  }
})

test('bodybuilding selections stay fixed through work and deload weeks', () => {
  const setup = readySetup(3)
  const week1 = buildSessionPlan(template, setup, {}, 1, 1)
  const week6 = buildSessionPlan(template, setup, {}, 6, 1)
  const week7 = buildSessionPlan(template, setup, {}, 7, 1)
  const week8 = buildSessionPlan(template, setup, {}, 8, 1)
  const ids = (plan) => bodybuildingForSession(setup, plan, {}).map((item) => item.exerciseId)

  assert.deepEqual(ids(week1), ids(week6))
  assert.deepEqual(ids(week6), ids(week7))
  assert.ok(bodybuildingForSession(setup, week7, {}).every((item) => item.targetSets === 2 && item.deload))
  assert.notDeepEqual(ids(week7), ids(week8))
})

test('double progression is tied to exercise history and ignores deload promotion', () => {
  const setup = readySetup(3)
  const week1 = buildSessionPlan(template, setup, {}, 1, 1)
  const prescription = bodybuildingForSession(setup, week1, {})
  const completed = normalizeBodybuildingItems(prescription)
  completed[0].load = '50'
  completed[0].sets = completed[0].sets.map((set) => ({ ...set, done: true, reps: completed[0].repMax }))
  const logs = { W1D1: { id: 'W1D1', status: 'completed', bodybuilding: completed } }
  const week2 = buildSessionPlan(template, setup, logs, 2, 1)
  const next = bodybuildingForSession(setup, week2, logs)[0]

  assert.equal(next.exerciseId, completed[0].exerciseId)
  assert.equal(next.previousLoad, '50')
  assert.equal(next.progressionAction, 'increase')

  const deloadItem = { ...completed[0], deload: true }
  const deloadLogs = { W7D1: { id: 'W7D1', status: 'completed', bodybuilding: [deloadItem] } }
  const week8 = buildSessionPlan(template, setup, deloadLogs, 8, 1)
  const changedBlock = bodybuildingForSession(setup, week8, deloadLogs)
  assert.ok(changedBlock.every((item) => item.progressionAction !== 'increase'))
})

test('conditioning fills uncommon domains, excludes sleds and avoids immediate repeats', () => {
  const setup = readySetup(3)
  const plan1 = buildSessionPlan(template, setup, {}, 1, 1)
  const bodybuilding1 = bodybuildingForSession(setup, plan1, {})
  const options1 = conditioningOptionsForSession(plan1, bodybuilding1, {})
  assert.equal(options1.length, 3)
  assert.ok(options1.some((option) => option.fills.some((tag) => ['sandbag', 'carry', 'calisthenics', 'core', 'locomotion'].includes(tag))))
  assert.ok(options1.every((option) => !/sled|trineo/i.test(`${option.title} ${option.prescription}`)))

  const logs = { W1D1: { id: 'W1D1', conditioning: { optionId: options1[0].id, status: 'completed' } } }
  const plan2 = buildSessionPlan(template, setup, logs, 1, 2)
  const options2 = conditioningOptionsForSession(plan2, bodybuildingForSession(setup, plan2, logs), logs)
  assert.notEqual(options2[0].id, options1[0].id)
})

test('v1 imports receive v2 assistance blocks without losing logs', () => {
  const oldSetup = readySetup(3)
  delete oldSetup.assistanceBlocks
  oldSetup.version = 1
  const imported = parseImport(template, JSON.stringify({
    state: {
      setup: oldSetup,
      logs: { W1D1: { id: 'W1D1', upperBack: { exercise: 'DB rows' } } }
    }
  }))

  assert.equal(imported.setup.version, 2)
  assert.equal(imported.setup.assistanceBlocks['block-1'].frequency, 3)
  assert.equal(imported.logs.W1D1.upperBack.exercise, 'DB rows')
})
