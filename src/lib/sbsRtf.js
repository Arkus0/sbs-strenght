import { createAssistanceBlocks, ensureAssistanceBlocks, normalizeBodybuildingItems } from './assistanceProgram.js'

export const SESSION_STATUS = {
  DRAFT: 'draft',
  COMPLETED: 'completed'
}

export function roundNumber(value, digits = 4) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Number(n.toFixed(digits))
}

export function roundToIncrement(value, increment = 2.5) {
  const n = Number(value)
  const inc = Number(increment)
  if (!Number.isFinite(n) || !Number.isFinite(inc) || inc <= 0) return null
  const decimals = String(inc).includes('.') ? String(inc).split('.')[1].length : 0
  return Number((Math.round(n / inc) * inc).toFixed(Math.max(decimals, 2)))
}

export function sessionId(week, day) {
  return `W${week}D${day}`
}

export function parseSessionId(id) {
  const match = String(id || '').match(/^W(\d+)D(\d+)$/)
  if (!match) return null
  return { week: Number(match[1]), day: Number(match[2]) }
}

export function createDefaultSetup(template) {
  const liftEntries = template.defaults.liftSlots.map((slot) => [
    slot.id,
    {
      id: slot.id,
      kind: slot.kind,
      label: slot.label,
      name: slot.defaultName,
      trainingMax: '',
      singleAt8Pct: slot.singleAt8Pct
    }
  ])

  return {
    version: 3,
    templateId: template.id,
    units: 'kg',
    rounding: template.defaults.rounding || 2.5,
    frequency: 3,
    completedAt: null,
    lifts: Object.fromEntries(liftEntries),
    backExercises: [...template.defaults.backExercises],
    adjustments: structuredClone(template.defaults.adjustments),
    normalSetReps: structuredClone(template.defaults.normalSetReps),
    repOutTargets: structuredClone(template.defaults.repOutTargets),
    intensityByWeek: structuredClone(template.defaults.intensityByWeek),
    weeklyParameters: structuredClone(template.defaults.weeklyParameters || {}),
    tmOverrides: {},
    singlePctReviewRequired: false,
    singlePctReviewedAt: null,
    assistanceBlocks: createAssistanceBlocks(template, 3)
  }
}

export function normalizeImportedSetup(template, setup) {
  const base = createDefaultSetup(template)
  if (!setup || typeof setup !== 'object') return base
  const merged = {
    ...base,
    ...setup,
    version: 3,
    lifts: { ...base.lifts, ...(setup.lifts || {}) },
    adjustments: { ...base.adjustments, ...(setup.adjustments || {}) },
    normalSetReps: { ...base.normalSetReps, ...(setup.normalSetReps || {}) },
    repOutTargets: { ...base.repOutTargets, ...(setup.repOutTargets || {}) },
    intensityByWeek: { ...base.intensityByWeek, ...(setup.intensityByWeek || {}) },
    weeklyParameters: { ...base.weeklyParameters, ...(setup.weeklyParameters || {}) },
    tmOverrides: setup.tmOverrides || {}
  }
  return {
    ...merged,
    assistanceBlocks: ensureAssistanceBlocks(template, merged)
  }
}

export function isDeloadWeek(template, week) {
  return template.defaults.deloadWeeks.includes(Number(week))
}

export function listSessions(template, setup) {
  const frequency = Number(setup?.frequency || 3)
  const layout = template.layouts[String(frequency)] || template.layouts['3']
  const sessions = []
  for (let week = 1; week <= template.meta.weeks; week += 1) {
    for (const day of layout.days) {
      sessions.push({
        id: sessionId(week, day.day),
        week,
        day: day.day,
        frequency,
        deload: isDeloadWeek(template, week)
      })
    }
  }
  return sessions
}

export function requiredSlotIds(template, setup) {
  const frequency = Number(setup?.frequency || 3)
  const layout = template.layouts[String(frequency)] || template.layouts['3']
  return [...new Set(layout.days.flatMap((day) => day.lifts.map((lift) => lift.slotId)))]
}

export function setupMissingMaxes(template, setup) {
  if (!setup) return requiredSlotIds(template, { frequency: 3 })
  return requiredSlotIds(template, setup).filter((slotId) => {
    const tm = Number(setup.lifts?.[slotId]?.trainingMax)
    return !Number.isFinite(tm) || tm <= 0
  })
}

export function isSetupComplete(template, setup) {
  return Boolean(setup?.completedAt) && setupMissingMaxes(template, setup).length === 0
}

function targetFromIntensity(table, slotId, intensity) {
  const slotTable = table?.[slotId]
  if (!slotTable) return null
  const rounded = roundNumber(intensity)
  if (Object.hasOwn(slotTable, String(rounded))) return slotTable[String(rounded)]
  return null
}

function weeklyParametersFor(setup, slotId, week) {
  const exact = setup.weeklyParameters?.[slotId]?.[String(week)]
  if (exact) return exact
  const intensity = setup.intensityByWeek?.[slotId]?.[String(week)] ?? null
  return {
    intensity,
    normalReps: targetFromIntensity(setup.normalSetReps, slotId, intensity),
    repOutTarget: targetFromIntensity(setup.repOutTargets, slotId, intensity),
    sets: Number(setup.adjustments?.[slotId]?.sets || 5),
    adjustments: setup.adjustments?.[slotId] || null
  }
}

export function adjustmentRateForDelta(adjustments, delta) {
  if (delta <= -2) return adjustments.belowBy2Plus
  if (delta === -1) return adjustments.belowBy1
  if (delta === 0) return adjustments.hit
  if (delta === 1) return adjustments.beatBy1
  if (delta === 2) return adjustments.beatBy2
  if (delta === 3) return adjustments.beatBy3
  if (delta === 4) return adjustments.beatBy4
  return adjustments.beatBy5Plus
}

export function tmOverrideKey(week, slotId) {
  return `${week}:${slotId}`
}

function numericOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function nonNegativeIntegerOrNull(value) {
  if (value === '' || value === undefined || value === null) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function logFor(logs, id) {
  return logs?.[id] || null
}

function rowLog(log, slotId) {
  return log?.lifts?.[slotId] || {}
}

export function prescribedSetsForLift(lift) {
  const sets = []
  const setGoal = Number(lift?.setGoal || 0)
  const workSets = lift?.deload ? setGoal : Math.max(0, setGoal - 1)

  sets.push({
    id: `${lift.slotId}:single_at8`,
    kind: 'single_at8',
    label: 'Single @8',
    optional: true,
    prescribedWeight: '',
    targetReps: 1,
    weight: '',
    reps: '1',
    done: false,
    useForAutoregulation: false,
    notes: ''
  })

  for (let index = 0; index < workSets; index += 1) {
    sets.push({
      id: `${lift.slotId}:work:${index + 1}`,
      kind: 'work',
      label: `Serie ${index + 1}`,
      optional: false,
      prescribedWeight: lift?.weight ?? '',
      targetReps: lift?.normalReps ?? '',
      weight: '',
      reps: '',
      done: false,
      notes: ''
    })
  }

  if (!lift?.deload) {
    sets.push({
      id: `${lift.slotId}:amrap`,
      kind: 'amrap',
      label: `Serie ${workSets + 1} AMRAP`,
      optional: false,
      prescribedWeight: lift?.weight ?? '',
      targetReps: lift?.repOutTarget ?? '',
      weight: '',
      reps: '',
      done: false,
      notes: ''
    })
  }

  return sets
}

function matchingSet(existingSets, prescribed, index) {
  if (!Array.isArray(existingSets)) return null
  return (
    existingSets.find((set) => set?.id === prescribed.id) ||
    existingSets.filter((set) => set?.kind === prescribed.kind)[index] ||
    null
  )
}

export function normalizeLiftLogForPlan(liftLog = {}, lift) {
  const prescribed = prescribedSetsForLift(lift)
  const kindSeen = {}
  const sets = prescribed.map((set, index) => {
    const kindIndex = kindSeen[set.kind] || 0
    kindSeen[set.kind] = kindIndex + 1
    const existing = matchingSet(liftLog.sets, set, kindIndex) || matchingSet(liftLog.sets, set, index) || {}
    const merged = {
      ...set,
      weight: existing.weight ?? '',
      reps: existing.reps ?? set.reps ?? '',
      done: Boolean(existing.done),
      useForAutoregulation: Boolean(existing.useForAutoregulation),
      notes: existing.notes || ''
    }

    if (!Array.isArray(liftLog.sets) && set.kind === 'single_at8' && merged.weight === '' && liftLog.singleAt8 !== undefined) {
      merged.weight = liftLog.singleAt8
    }
    if (!Array.isArray(liftLog.sets) && set.kind === 'amrap' && merged.reps === '' && liftLog.lastSetReps !== undefined) {
      merged.reps = liftLog.lastSetReps
    }

    return merged
  })

  return {
    singleAt8: liftLog.singleAt8 ?? '',
    lastSetReps: liftLog.lastSetReps ?? '',
    video: liftLog.video || '',
    notes: liftLog.notes || '',
    sets
  }
}

export function normalizeSessionLogForPlan(plan, log = {}, bodybuildingPrescription = []) {
  const base = log && typeof log === 'object' ? log : {}
  const legacyAssistance = base.legacyAssistance || [
    base.upperBack?.exercise ? { role: 'back', name: base.upperBack.exercise, ...base.upperBack } : null,
    ...(base.accessories || []).filter((item) => item?.name || item?.load || item?.sets || item?.reps)
      .map((item) => ({ role: 'accessory', ...item }))
  ].filter(Boolean)
  return {
    id: plan.id,
    week: plan.week,
    day: plan.day,
    status: base.status || SESSION_STATUS.DRAFT,
    startedAt: base.startedAt || undefined,
    completedAt: base.completedAt,
    updatedAt: base.updatedAt || new Date().toISOString(),
    lifts: Object.fromEntries(
      plan.lifts.map((lift) => [lift.slotId, normalizeLiftLogForPlan(base.lifts?.[lift.slotId] || {}, lift)])
    ),
    upperBack: { exercise: '', load: '', sets: '', reps: '', notes: '', ...(base.upperBack || {}) },
    accessories: Array.from({ length: plan.accessorySlots }, (_, index) => ({
      name: '',
      load: '',
      sets: '',
      reps: '',
      notes: '',
      ...(base.accessories?.[index] || {})
    })),
    notes: base.notes || '',
    specimenAccepted: Boolean(base.specimenAccepted),
    specimenSelection: {
      upperBackId: '',
      assistanceId: '',
      ...(base.specimenSelection || {})
    },
    bodybuilding: normalizeBodybuildingItems(bodybuildingPrescription, base.bodybuilding || []),
    conditioning: {
      optionId: '',
      status: 'not_selected',
      score: '',
      load: '',
      notes: '',
      ...(base.conditioning || {})
    },
    legacyAssistance
  }
}

function loggedSingleAt8(liftLog) {
  if (Array.isArray(liftLog.sets)) {
    const singleSet = liftLog.sets.find((set) => set?.kind === 'single_at8')
    if (!singleSet?.done || !singleSet?.useForAutoregulation) return null
    return numericOrNull(singleSet.weight)
  }
  return numericOrNull(liftLog.singleAt8)
}

function loggedLastSetReps(liftLog) {
  if (Array.isArray(liftLog.sets)) {
    const amrap = liftLog.sets.filter((set) => set?.kind === 'amrap').at(-1)
    if (!amrap?.done) return null
    return nonNegativeIntegerOrNull(amrap.reps)
  }
  return nonNegativeIntegerOrNull(liftLog.lastSetReps)
}

export function projectTrainingMax(template, setup, logs, slotId, targetWeek, targetDay) {
  const initial = numericOrNull(setup?.lifts?.[slotId]?.trainingMax)
  if (!initial) {
    return {
      slotId,
      trainingMax: null,
      source: 'missing',
      adjustment: null,
      delta: null,
      baseTrainingMax: null
    }
  }

  let state = {
    trainingMax: initial,
    source: 'initial',
    adjustment: null,
    delta: null,
    baseTrainingMax: initial
  }

  for (const session of listSessions(template, setup)) {
    const layout = template.layouts[String(setup.frequency)].days.find((day) => day.day === session.day)
    if (!layout?.lifts.some((lift) => lift.slotId === slotId)) continue

    const id = sessionId(session.week, session.day)
    const log = logFor(logs, id)
    const liftLog = rowLog(log, slotId)
    const override = numericOrNull(setup.tmOverrides?.[tmOverrideKey(session.week, slotId)])
    const isTarget = session.week === Number(targetWeek) && session.day === Number(targetDay)
    const logCanAffectProjection = isTarget || log?.status === SESSION_STATUS.COMPLETED || log?.status === undefined
    let current = { ...state, baseTrainingMax: state.trainingMax }

    if (override) {
      current = {
        trainingMax: override,
        source: 'manual_override',
        adjustment: null,
        delta: null,
        baseTrainingMax: state.trainingMax
      }
    }

    const singleAt8 = logCanAffectProjection && !override ? loggedSingleAt8(liftLog) : null
    if (singleAt8 !== null) {
      current = {
        trainingMax: singleAt8 / Number(setup.lifts[slotId].singleAt8Pct || 0.9),
        source: 'single_at8',
        adjustment: null,
        delta: null,
        baseTrainingMax: current.trainingMax
      }
    }

    if (isTarget) {
      return {
        slotId,
        ...current,
        rawTrainingMax: current.trainingMax,
        trainingMax: roundNumber(current.trainingMax, 3),
        baseTrainingMax: roundNumber(current.baseTrainingMax, 3)
      }
    }

    if (isDeloadWeek(template, session.week)) {
      state = { ...current, source: current.source === 'single_at8' ? 'single_at8' : 'carried' }
      continue
    }

    const lastSetReps = logCanAffectProjection ? loggedLastSetReps(liftLog) : null
    if (lastSetReps !== null) {
      const weekly = weeklyParametersFor(setup, slotId, session.week)
      const repOutTarget = weekly.repOutTarget
      const delta = lastSetReps - Number(repOutTarget)
      const adjustment = adjustmentRateForDelta(weekly.adjustments, delta)
      state = {
        trainingMax: current.trainingMax * (1 + adjustment),
        source: 'last_set',
        adjustment,
        delta,
        baseTrainingMax: current.trainingMax
      }
    } else {
      state = {
        ...current,
        source: current.source === 'initial' ? 'initial' : 'carried'
      }
    }
  }

  return {
    slotId,
    ...state,
    rawTrainingMax: state.trainingMax,
    trainingMax: roundNumber(state.trainingMax, 3),
    baseTrainingMax: roundNumber(state.baseTrainingMax, 3)
  }
}

export function buildSessionPlan(template, setup, logs, week, day) {
  const frequency = Number(setup.frequency)
  const layout = template.layouts[String(frequency)]?.days.find((entry) => entry.day === Number(day))
  if (!layout) return null
  const deload = isDeloadWeek(template, week)

  const lifts = layout.lifts.map(({ slotId }) => {
    const lift = setup.lifts[slotId]
    const projection = projectTrainingMax(template, setup, logs, slotId, week, day)
    const weekly = weeklyParametersFor(setup, slotId, week)
    const intensity = weekly.intensity
    const setGoal = deload ? 5 : Number(weekly.sets || 5)
    const normalReps = deload ? 5 : weekly.normalReps
    const repOutTarget = deload ? null : weekly.repOutTarget
    const singleAt8Pct = Number(lift?.singleAt8Pct || 0.9)
    const calculationTrainingMax = projection.trainingMax
    const weight = calculationTrainingMax
      ? roundToIncrement(calculationTrainingMax * intensity, setup.rounding)
      : null
    const singleAt8Weight = calculationTrainingMax
      ? roundToIncrement(calculationTrainingMax * singleAt8Pct, setup.rounding)
      : null

    return {
      slotId,
      name: lift?.name || slotId,
      label: lift?.label || '',
      kind: lift?.kind || 'lift',
      singleAt8Pct,
      singleAt8Weight,
      intensity,
      weight,
      normalReps,
      repOutTarget,
      setGoal,
      deload,
      projection
    }
  })

  return {
    id: sessionId(week, day),
    week: Number(week),
    day: Number(day),
    frequency,
    deload,
    lifts,
    accessorySlots: layout.accessorySlots || 3
  }
}

export function nextSession(template, setup, logs) {
  const sessions = listSessions(template, setup)
  return sessions.find((session) => logs?.[session.id]?.status !== SESSION_STATUS.COMPLETED) || sessions.at(-1)
}

export function previousSessionLogs(logs, beforeId) {
  const before = parseSessionId(beforeId)
  if (!before) return []
  return Object.values(logs || {})
    .filter((log) => {
      if (!log?.id) return false
      const parsed = parseSessionId(log.id)
      if (!parsed) return false
      return parsed.week < before.week || (parsed.week === before.week && parsed.day < before.day)
    })
    .sort((a, b) => {
      const aa = parseSessionId(a.id)
      const bb = parseSessionId(b.id)
      return aa.week - bb.week || aa.day - bb.day
    })
}

export function latestAccessorySnapshot(logs, beforeId) {
  const previous = previousSessionLogs(logs, beforeId).reverse()
  for (const log of previous) {
    if (log.upperBack?.exercise || log.accessories?.some((item) => item?.name || item?.load || item?.reps)) {
      return {
        upperBack: log.upperBack || {},
        accessories: log.accessories || [],
        sourceId: log.id
      }
    }
  }
  return null
}

export function createEmptySessionLog(plan, bodybuildingPrescription = []) {
  return normalizeSessionLogForPlan(plan, {
    id: plan.id,
    week: plan.week,
    day: plan.day,
    status: SESSION_STATUS.DRAFT,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, bodybuildingPrescription)
}
