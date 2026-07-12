import { bodybuildingForSession } from './assistanceProgram.js'
import { buildSessionPlan, parseSessionId, projectTrainingMax } from './sbsRtf.js'
import type {
  BodybuildingImpact,
  CompletionSummary,
  ScheduledSession,
  TrainingMaxImpact
} from '../types/domain'

interface DeriveCompletionImpactOptions {
  template: any
  setup: Record<string, any>
  schedule: ScheduledSession[]
  logs: Record<string, any>
  completedLog: any
  summary: CompletionSummary
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function rounded(value: number): number {
  return Number(value.toFixed(3))
}

function direction(delta: number | null): TrainingMaxImpact['direction'] {
  if (delta === null || delta === 0) return 'same'
  return delta > 0 ? 'increase' : 'decrease'
}

function pendingFutureSessions(schedule: ScheduledSession[], current: ScheduledSession): ScheduledSession[] {
  return schedule
    .filter((session) => session.sequenceIndex > current.sequenceIndex && !['completed', 'skipped'].includes(session.status))
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
}

function trainingMaxImpact({
  template,
  setup,
  schedule,
  logs,
  completedLog
}: Omit<DeriveCompletionImpactOptions, 'summary'>): TrainingMaxImpact[] {
  const current = schedule.find((session) => session.code === completedLog.id)
  const parsed = parseSessionId(completedLog.id)
  if (!current || !parsed) return []

  const logsBefore = { ...logs }
  delete logsBefore[completedLog.id]
  const logsAfter = { ...logs, [completedLog.id]: completedLog }
  const baselinePlan = current.prescriptionSnapshot || buildSessionPlan(template, setup, logsBefore, parsed.week, parsed.day)
  const future = pendingFutureSessions(schedule, current)

  return (baselinePlan?.lifts || []).map((baselineLift: any) => {
    let nextSession: ScheduledSession | null = null
    let nextLift: any = null

    for (const session of future) {
      const plan = buildSessionPlan(template, setup, logsAfter, session.week, session.day)
      const lift = plan?.lifts?.find((candidate: any) => candidate.slotId === baselineLift.slotId)
      if (lift) {
        nextSession = session
        nextLift = lift
        break
      }
    }

    const before = finiteNumber(baselineLift.projection?.trainingMax)
    const after = nextLift
      ? finiteNumber(nextLift.projection?.trainingMax)
      : finiteNumber(projectTrainingMax(
          template,
          setup,
          logsAfter,
          baselineLift.slotId,
          Number(template.meta?.weeks || 21) + 1,
          1
        ).trainingMax)
    const delta = before !== null && after !== null ? rounded(after - before) : null

    return {
      slotId: baselineLift.slotId,
      name: baselineLift.name || setup.lifts?.[baselineLift.slotId]?.name || baselineLift.slotId,
      label: baselineLift.label || setup.lifts?.[baselineLift.slotId]?.label || '',
      before,
      after,
      delta,
      direction: direction(delta),
      nextSessionCode: nextSession?.code || null,
      nextScheduledDate: nextSession?.scheduledDate || null,
      timing: nextSession ? 'next_session' : 'cycle_end'
    }
  })
}

function bodybuildingImpact({
  template,
  setup,
  schedule,
  logs,
  completedLog
}: Omit<DeriveCompletionImpactOptions, 'summary'>): BodybuildingImpact[] {
  const current = schedule.find((session) => session.code === completedLog.id)
  if (!current) return []

  const logsAfter = { ...logs, [completedLog.id]: completedLog }
  const future = pendingFutureSessions(schedule, current).filter((session) => !session.deload)
  const result: BodybuildingImpact[] = []

  for (const item of completedLog.bodybuilding || []) {
    const before = finiteNumber(item.load)
    if (item.deload || (item.outcome || 'performed') !== 'performed' || before === null || before <= 0) continue

    for (const session of future) {
      const plan = buildSessionPlan(template, setup, logsAfter, session.week, session.day)
      if (!plan) continue
      const recommendation = bodybuildingForSession(setup, plan, logsAfter)
        .find((candidate: any) => candidate.exerciseId === item.exerciseId)
      if (!recommendation) continue

      const action = recommendation.progressionAction
      const after = finiteNumber(recommendation.recommendedLoad)
      if ((action === 'increase' || action === 'reduce') && after !== null && after !== before) {
        result.push({
          slotKey: item.slotKey,
          exerciseId: item.exerciseId,
          name: item.name,
          action,
          before,
          after,
          delta: rounded(after - before),
          nextSessionCode: session.code,
          nextScheduledDate: session.scheduledDate
        })
      }
      break
    }
  }

  return result
}

export function deriveCompletionImpact(options: DeriveCompletionImpactOptions): CompletionSummary {
  return {
    ...options.summary,
    impactVersion: 1,
    trainingMaxImpact: trainingMaxImpact(options),
    bodybuildingImpact: bodybuildingImpact(options)
  }
}
