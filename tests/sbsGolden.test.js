import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { buildSessionPlan, createDefaultSetup, createEmptySessionLog, listSessions } from '../src/lib/sbsRtf.js'

const template = JSON.parse(fs.readFileSync(new URL('../src/data/sbsRtfTemplate.json', import.meta.url), 'utf8'))

function readySetup(frequency) {
  const setup = createDefaultSetup(template)
  setup.frequency = frequency
  setup.completedAt = 'golden'
  for (const slot of template.defaults.liftSlots) setup.lifts[slot.id].trainingMax = slot.defaultTrainingMax
  return setup
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

test('Excel SBS RTF: source formula graph is immutable', () => {
  assert.equal(template.source.formulaDigest, 'c4a9d6a6241f22fdddf4df65b341f4a7dde49ebd3e9a6c5da31126825b6ecc4a')
})

test('Excel SBS RTF: every default prescription across frequencies and weeks is immutable', () => {
  const matrix = {}
  for (const frequency of template.meta.frequencies) {
    const setup = readySetup(frequency)
    matrix[frequency] = listSessions(template, setup).map(({ week, day }) => {
      const plan = buildSessionPlan(template, setup, {}, week, day)
      return {
        id: plan.id,
        deload: plan.deload,
        lifts: plan.lifts.map((lift) => ({
          id: lift.slotId,
          tm: lift.projection.trainingMax,
          intensity: lift.intensity,
          weight: lift.weight,
          single: lift.singleAt8Weight,
          normal: lift.normalReps,
          repout: lift.repOutTarget,
          sets: lift.setGoal
        }))
      }
    })
  }
  assert.equal(digest(matrix), 'e752c665e9a6f6f2fe416000115a5d80a3beb4ac369706473faf13eff4cbfc8e')
})

test('Excel SBS RTF: sequential single and AMRAP adjustments are immutable', () => {
  const setup = readySetup(3)
  const logs = {}
  const trace = []
  for (const session of listSessions(template, setup)) {
    const plan = buildSessionPlan(template, setup, logs, session.week, session.day)
    trace.push({
      id: plan.id,
      lifts: plan.lifts.map((lift) => ({
        id: lift.slotId,
        tm: lift.projection.trainingMax,
        source: lift.projection.source,
        weight: lift.weight,
        repout: lift.repOutTarget
      }))
    })
    const log = createEmptySessionLog(plan)
    log.status = 'completed'
    for (const lift of plan.lifts) {
      const row = log.lifts[lift.slotId]
      const single = row.sets.find((set) => set.kind === 'single_at8')
      const amrap = row.sets.find((set) => set.kind === 'amrap')
      if (single && session.week % 4 === 0) {
        single.weight = lift.singleAt8Weight
        single.done = true
        single.useForAutoregulation = true
        row.singleAt8 = lift.singleAt8Weight
      }
      if (amrap) {
        amrap.reps = Number(lift.repOutTarget) + ((session.week + session.day) % 7 - 2)
        // Preserve the historical golden trace: legacy non-positive entries were treated as blank.
        amrap.done = Number(amrap.reps) > 0
        row.lastSetReps = amrap.reps
      }
    }
    logs[plan.id] = log
  }
  assert.equal(digest(trace), '25effc574400497ee0f07151f1984449f1f3020917fb8b7984d57f7f435182ce')
})
