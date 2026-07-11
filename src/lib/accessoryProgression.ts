import type { AccessoryHistoryEntry, AccessoryRecommendation } from '../types/domain'

function roundToStep(value: number, step: number): number {
  const safeStep = step > 0 ? step : 1
  const decimals = String(safeStep).split('.')[1]?.length || 0
  return Number((Math.round(value / safeStep) * safeStep).toFixed(decimals))
}

function validWorkHistory(history: AccessoryHistoryEntry[]): AccessoryHistoryEntry[] {
  return history.filter((entry) => !entry.deload && entry.status === 'performed' && entry.sets.length > 0)
}

function result(entry: AccessoryHistoryEntry): 'top' | 'in_range' | 'below' {
  const reps = entry.sets.filter((set) => set.done).map((set) => set.reps).filter((value): value is number => value !== null)
  if (reps.length !== entry.sets.length || reps.some((value) => value < entry.repMin)) return 'below'
  if (reps.every((value) => value >= entry.repMax)) return 'top'
  return 'in_range'
}

export function recommendAccessoryProgression({
  history,
  loadStep,
  deload = false
}: {
  history: AccessoryHistoryEntry[]
  loadStep: number
  deload?: boolean
}): AccessoryRecommendation {
  const work = validWorkHistory(history).sort((a, b) => a.sessionId.localeCompare(b.sessionId))
  const previous = work.at(-1)
  if (!previous || previous.load === null) {
    return {
      action: deload ? 'deload' : 'choose',
      recommendedLoad: null,
      targetTotalReps: null,
      reason: deload ? 'Deload sin historial de carga: usa una carga cómoda.' : 'Primera exposición: elige una carga que permita entrar en el rango.',
      sourceSessionIds: []
    }
  }

  if (deload) {
    return {
      action: 'deload',
      recommendedLoad: previous.load,
      targetTotalReps: previous.sets.length * previous.repMin,
      reason: 'Deload: conserva la referencia, realiza dos series en el mínimo y no evalúes progresión.',
      sourceSessionIds: [previous.sessionId]
    }
  }

  const previousResult = result(previous)
  if (previousResult === 'top') {
    return {
      action: 'increase',
      recommendedLoad: roundToStep(previous.load + loadStep, loadStep),
      targetTotalReps: previous.sets.length * previous.repMin,
      reason: `Todas las series alcanzaron ${previous.repMax} reps: sube un incremento.`,
      sourceSessionIds: [previous.sessionId]
    }
  }

  if (previousResult === 'in_range') {
    const total = previous.sets.reduce((sum, set) => sum + Number(set.reps || 0), 0)
    return {
      action: 'repeat',
      recommendedLoad: previous.load,
      targetTotalReps: Math.min(total + 1, previous.sets.length * previous.repMax),
      reason: 'Mantén la carga y supera en una repetición el total anterior.',
      sourceSessionIds: [previous.sessionId]
    }
  }

  const prior = work.at(-2)
  if (prior && result(prior) === 'below') {
    const reduction = Math.max(loadStep, previous.load * 0.05)
    return {
      action: 'reduce',
      recommendedLoad: Math.max(0, roundToStep(previous.load - reduction, loadStep)),
      targetTotalReps: previous.sets.length * previous.repMin,
      reason: 'Dos exposiciones seguidas por debajo del rango: reduce la carga y reconstruye.',
      sourceSessionIds: [prior.sessionId, previous.sessionId]
    }
  }

  return {
    action: 'repeat',
    recommendedLoad: previous.load,
    targetTotalReps: previous.sets.length * previous.repMin,
    reason: 'Primera exposición por debajo del rango: repite la carga antes de reducir.',
    sourceSessionIds: [previous.sessionId]
  }
}
