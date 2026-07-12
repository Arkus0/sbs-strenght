import type { AnalyticsSnapshot, Measurement, ScheduledSession, TrainingMaxOverview } from '../types/domain'
import { buildSessionPlan, parseSessionId, projectTrainingMax, requiredSlotIds } from './sbsRtf.js'

export function epleyE1rm(weight: unknown, reps: unknown): number | null {
  const w = Number(weight)
  const r = Number(reps)
  if (!(w > 0) || !(r > 0)) return null
  return Number((w * (1 + r / 30)).toFixed(1))
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function deriveAnalytics({
  schedule,
  logs,
  measurements: _measurements = [],
  liftNames = {}
}: {
  schedule: ScheduledSession[]
  logs: Record<string, any>
  measurements?: Measurement[]
  liftNames?: Record<string, string>
}): AnalyticsSnapshot {
  const today = new Date().toISOString().slice(0, 10)
  const completed = schedule.filter((session) => logs[session.code]?.status === 'completed')
  const due = schedule.filter((session) => session.scheduledDate <= today)
  const weeklyMap = new Map<number, { week: number; sessions: number; tonnage: number; sets: number }>()
  const liftSeries: AnalyticsSnapshot['liftSeries'] = {}
  const accessorySeries: AnalyticsSnapshot['accessorySeries'] = {}
  const records: AnalyticsSnapshot['records'] = []
  let conditioningCompleted = 0
  let completedSets = 0
  const activeDurations: number[] = []
  const bestE1rm = new Map<string, number>()
  const bestLoad = new Map<string, number>()
  const bestReps = new Map<string, number>()

  for (const session of completed) {
    const log = logs[session.code]
    const weekly = weeklyMap.get(session.week) || { week: session.week, sessions: 0, tonnage: 0, sets: 0 }
    weekly.sessions += 1
    if (Number(log.activeSeconds) > 0 && !log.legacyDuration) activeDurations.push(Number(log.activeSeconds))
    if (log.conditioning?.status === 'completed') conditioningCompleted += 1

    for (const [slotId, lift] of Object.entries<any>(log.lifts || {})) {
      let sessionWeight: number | null = null
      let sessionE1rm: number | null = null
      for (const [setIndex, set] of (lift.sets || []).entries()) {
        if (!set.done) continue
        const weight = Number(set.weight ?? set.prescribedWeight)
        const reps = Number(set.reps)
        if (weight > 0 && reps > 0) {
          weekly.tonnage += weight * reps
          sessionWeight = Math.max(sessionWeight || 0, weight)
        }
        weekly.sets += 1
        completedSets += 1
        if (set.kind === 'amrap') sessionE1rm = epleyE1rm(weight, reps)
        const exercise = liftNames[slotId] || slotId
        if (weight > (bestLoad.get(exercise) || 0)) {
          bestLoad.set(exercise, weight)
          records.push({ id: `${session.code}:${slotId}:${set.id || setIndex}:load`, kind: 'load', exercise, value: weight, sessionId: session.code })
        }
        if (reps > (bestReps.get(exercise) || 0)) {
          bestReps.set(exercise, reps)
          records.push({ id: `${session.code}:${slotId}:${set.id || setIndex}:reps`, kind: 'reps', exercise, value: reps, sessionId: session.code })
        }
      }
      if (sessionE1rm && sessionE1rm > (bestE1rm.get(slotId) || 0)) {
        bestE1rm.set(slotId, sessionE1rm)
        records.push({ id: `${session.code}:${slotId}:e1rm`, kind: 'e1rm', exercise: liftNames[slotId] || slotId, value: sessionE1rm, sessionId: session.code })
      }
      const projection = lift.projection || lift.prescriptionSnapshot?.projection
      ;(liftSeries[slotId] ||= []).push({
        sessionId: session.code,
        week: session.week,
        tm: Number(projection?.trainingMax) || null,
        e1rm: sessionE1rm,
        weight: sessionWeight
      })
    }

    for (const item of log.bodybuilding || []) {
      const doneSets = (item.sets || []).filter((set: any) => set.done)
      completedSets += doneSets.length
      weekly.sets += doneSets.length
      const totalReps = doneSets.reduce((sum: number, set: any) => sum + Number(set.reps || 0), 0)
      ;(accessorySeries[item.exerciseId] ||= []).push({
        sessionId: session.code,
        name: item.name,
        load: Number(item.load) || null,
        totalReps,
        atTop: doneSets.length > 0 && doneSets.every((set: any) => Number(set.reps) >= Number(item.repMax))
      })
      if (Number(item.load) > 0) weekly.tonnage += Number(item.load) * totalReps
    }
    weeklyMap.set(session.week, weekly)
  }

  return {
    completionPct: schedule.length ? Math.round(completed.length / schedule.length * 100) : 0,
    adherencePct: due.length ? Math.round(completed.filter((session) => session.scheduledDate <= today).length / due.length * 100) : 100,
    completedSessions: completed.length,
    scheduledToDate: due.length,
    conditioningCompleted,
    completedSets,
    medianActiveSeconds: median(activeDurations),
    weekly: [...weeklyMap.values()].sort((a, b) => a.week - b.week),
    liftSeries,
    accessorySeries,
    records: records.slice(-20).reverse()
  }
}

export function deriveTrainingMaxOverview({
  template,
  setup,
  schedule,
  logs
}: {
  template: any
  setup: Record<string, any>
  schedule: ScheduledSession[]
  logs: Record<string, any>
}): TrainingMaxOverview[] {
  const slotIds = requiredSlotIds(template, setup)
  const orderedSchedule = [...schedule].sort((a, b) => a.sequenceIndex - b.sequenceIndex)

  return slotIds.map((slotId: string) => {
    const history = orderedSchedule.flatMap((session) => {
      if (logs[session.code]?.status !== 'completed') return []
      const parsed = parseSessionId(session.code)
      if (!parsed) return []
      const lift = buildSessionPlan(template, setup, logs, parsed.week, parsed.day)?.lifts
        .find((entry: any) => entry.slotId === slotId)
      if (!lift) return []
      return [{
        sessionId: session.code,
        week: session.week,
        day: session.day,
        trainingMax: Number(lift.projection?.trainingMax) || null
      }]
    })

    let currentTrainingMax: number | null = null
    let currentSessionId: string | null = null
    for (const session of orderedSchedule) {
      if (session.status === 'completed' || session.status === 'skipped' || logs[session.code]?.status === 'completed') continue
      const parsed = parseSessionId(session.code)
      if (!parsed) continue
      const lift = buildSessionPlan(template, setup, logs, parsed.week, parsed.day)?.lifts
        .find((entry: any) => entry.slotId === slotId)
      if (!lift) continue
      currentTrainingMax = Number(lift.projection?.trainingMax) || null
      currentSessionId = session.code
      break
    }

    if (currentSessionId === null) {
      const finalProjection = projectTrainingMax(template, setup, logs, slotId, Number.MAX_SAFE_INTEGER, 0)
      currentTrainingMax = Number(finalProjection.trainingMax) || null
    }

    const liftSetup = setup.lifts[slotId] || {}
    return {
      slotId,
      name: liftSetup.name || slotId,
      label: liftSetup.label || '',
      currentTrainingMax,
      currentSessionId,
      history
    }
  })
}

export function trainingMaxHistoryDisplayMode(count: number): 'empty' | 'list' | 'chart' {
  if (count <= 0) return 'empty'
  return count <= 4 ? 'list' : 'chart'
}
