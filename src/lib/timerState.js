import { timerCueSchedule } from './timerAudio.js'

function safeSeconds(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : fallback
}

export function consumedTimerCueIds(durationSeconds, remainingSeconds, existing = []) {
  const consumed = new Set(Array.isArray(existing) ? existing : [])
  for (const cue of timerCueSchedule(durationSeconds)) {
    if (remainingSeconds <= cue.at) consumed.add(cue.id)
  }
  return [...consumed]
}

export function createActiveRestTimer({
  id,
  presetId = 'suggested',
  label,
  context = '',
  mode = 'countdown',
  durationSeconds,
  now = Date.now()
}) {
  const duration = safeSeconds(durationSeconds)
  const timestamp = new Date(now).toISOString()
  return {
    version: 1,
    id,
    presetId,
    label,
    context,
    mode,
    phase: 'running',
    durationSeconds: duration,
    deadlineAt: new Date(now + duration * 1000).toISOString(),
    remainingSeconds: duration,
    firedCueIds: [],
    updatedAt: timestamp
  }
}

export function normalizeActiveRestTimer(input, now = Date.now()) {
  if (!input || input.version !== 1 || typeof input.id !== 'string' || !input.id) return null
  if (!['countdown', 'emom', 'stopwatch'].includes(input.mode)) return null
  if (!['running', 'paused', 'done'].includes(input.phase)) return null

  const durationSeconds = safeSeconds(input.durationSeconds)
  if (!(durationSeconds > 0) || typeof input.label !== 'string') return null

  let phase = input.phase
  let deadlineAt = typeof input.deadlineAt === 'string' ? input.deadlineAt : null
  let remainingSeconds = safeSeconds(input.remainingSeconds, durationSeconds)

  if (phase === 'running') {
    const deadline = Date.parse(deadlineAt || '')
    if (!Number.isFinite(deadline)) return null
    remainingSeconds = Math.max(0, (deadline - now) / 1000)
    if (remainingSeconds <= 0) {
      phase = 'done'
      deadlineAt = null
    }
  } else {
    deadlineAt = null
    if (phase === 'done') remainingSeconds = 0
  }

  return {
    version: 1,
    id: input.id,
    presetId: typeof input.presetId === 'string' ? input.presetId : 'suggested',
    label: input.label,
    context: typeof input.context === 'string' ? input.context : '',
    mode: input.mode,
    phase,
    durationSeconds,
    deadlineAt,
    remainingSeconds,
    firedCueIds: consumedTimerCueIds(durationSeconds, remainingSeconds, input.firedCueIds),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date(now).toISOString()
  }
}
