export const RUNNER_INPUT_VERSION = 1

export function runnerInputKey(slotId, setId, field) {
  return `${slotId}:${setId}:${field}`
}

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined
}

function storedSetFor(storedLog, slotId, setId) {
  return storedLog?.lifts?.[slotId]?.sets?.find((set) => set?.id === setId)
}

function prescribedValue(lift, set, field) {
  if (field === 'weight') {
    return set.kind === 'single_at8' ? lift.singleAt8Weight : set.prescribedWeight
  }
  if (field === 'reps' && set.kind !== 'amrap') return set.targetReps
  return ''
}

function inputSnapshot(log) {
  return JSON.stringify({
    progressionSemanticsVersion: log?.progressionSemanticsVersion,
    runnerInputVersion: log?.runnerInputVersion,
    runnerInputOrigins: log?.runnerInputOrigins || {},
    lifts: Object.fromEntries(Object.entries(log?.lifts || {}).map(([slotId, lift]) => [
      slotId,
      (lift.sets || []).map((set) => ({ id: set.id, weight: set.weight, reps: set.reps }))
    ]))
  })
}

export function materializeSessionInputs(plan, normalizedLog, storedLog = null) {
  if (normalizedLog.status === 'completed') {
    return { log: normalizedLog, needsSync: false }
  }

  const hasStoredLog = Boolean(storedLog?.id)
  const isCurrentVersion = storedLog?.runnerInputVersion === RUNNER_INPUT_VERSION
  const origins = { ...(storedLog?.runnerInputOrigins || {}) }
  const lifts = Object.fromEntries(plan.lifts.map((lift) => {
    const liftLog = normalizedLog.lifts[lift.slotId] || { sets: [] }
    const sets = (liftLog.sets || []).map((set) => {
      const storedSet = storedSetFor(storedLog, lift.slotId, set.id)
      const next = { ...set }

      for (const field of ['weight', 'reps']) {
        const value = prescribedValue(lift, set, field)
        if (!hasValue(value)) continue
        const key = runnerInputKey(lift.slotId, set.id, field)

        if (!isCurrentVersion || !origins[key]) {
          const existing = storedSet?.[field]
          const generatedSingleRep = field === 'reps' && set.kind === 'single_at8' && String(existing ?? '') === String(value)
          origins[key] = !hasStoredLog || !hasValue(existing) || generatedSingleRep ? 'prescribed' : 'manual'
        }

        if (origins[key] === 'prescribed') next[field] = String(value)
      }

      return next
    })
    return [lift.slotId, { ...liftLog, sets }]
  }))

  const log = {
    ...normalizedLog,
    lifts,
    progressionSemanticsVersion: 2,
    runnerInputVersion: RUNNER_INPUT_VERSION,
    runnerInputOrigins: origins
  }

  return { log, needsSync: inputSnapshot(log) !== inputSnapshot(storedLog) }
}
