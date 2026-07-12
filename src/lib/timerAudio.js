let audioContext = null
let masterGain = null
let compressor = null
let resumePromise = null

function clampVolume(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1
}

function timerAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  if (!audioContext) {
    audioContext = new AudioContext()
    masterGain = audioContext.createGain()
    compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 18
    compressor.ratio.value = 8
    compressor.attack.value = 0.003
    compressor.release.value = 0.2
    masterGain.gain.value = 1
    masterGain.connect(compressor)
    compressor.connect(audioContext.destination)
  }
  return audioContext
}

function setMasterVolume(volume) {
  if (masterGain) masterGain.gain.value = clampVolume(volume)
}

export async function primeTimerAudio(volume = 1) {
  try {
    const context = timerAudioContext()
    if (!context) return null
    setMasterVolume(volume)
    if (context.state === 'suspended') {
      resumePromise ||= context.resume()
        .catch(() => null)
        .finally(() => { resumePromise = null })
      await resumePromise
    }
    return context.state === 'running' ? context : null
  } catch {
    return null
  }
}

export function timerAudioContextState() {
  try {
    return timerAudioContext()?.state || 'unavailable'
  } catch {
    return 'unavailable'
  }
}

function tone(context, { startAt, duration = 0.18, frequency, volume = 0.7, type = 'square' }) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const endAt = startAt + duration
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.001, startAt)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), startAt + 0.014)
  gain.gain.setValueAtTime(Math.max(0.01, volume), Math.max(startAt + 0.015, endAt - 0.045))
  gain.gain.exponentialRampToValueAtTime(0.001, endAt)
  oscillator.connect(gain)
  gain.connect(masterGain)
  oscillator.start(startAt)
  oscillator.stop(endAt + 0.025)
  return oscillator
}

const CUES = {
  halfway: {
    tones: [
      { frequency: 720, duration: 0.18, volume: 0.62, type: 'triangle' },
      { frequency: 980, at: 0.2, duration: 0.2, volume: 0.68 }
    ],
    vibration: [90, 60, 90]
  },
  warning: {
    tones: [
      { frequency: 880, duration: 0.2, volume: 0.7 },
      { frequency: 880, at: 0.26, duration: 0.2, volume: 0.7 }
    ],
    vibration: [120, 80, 120]
  },
  countdown: {
    tones: [
      { frequency: 1050, duration: 0.22, volume: 0.76 },
      { frequency: 1550, duration: 0.16, volume: 0.42, type: 'triangle' }
    ],
    vibration: [130]
  },
  final: {
    tones: [
      { frequency: 980, duration: 0.28, volume: 0.82 },
      { frequency: 1480, duration: 0.25, volume: 0.62, type: 'triangle' },
      { frequency: 1180, at: 0.34, duration: 0.3, volume: 0.86 },
      { frequency: 1760, at: 0.34, duration: 0.27, volume: 0.66, type: 'triangle' },
      { frequency: 1380, at: 0.72, duration: 0.42, volume: 0.9 },
      { frequency: 1960, at: 0.72, duration: 0.36, volume: 0.7, type: 'triangle' }
    ],
    vibration: [320, 110, 320, 110, 520]
  }
}

function scheduleCue(context, type, delaySeconds, nodes) {
  const cue = CUES[type]
  if (!cue) return
  const base = context.currentTime + Math.max(0.025, delaySeconds)
  for (const definition of cue.tones) {
    nodes.push(tone(context, { ...definition, startAt: base + (definition.at || 0) }))
  }
}

export function playTimerVibration(type, enabled = true) {
  try {
    if (!enabled) return
    const cue = CUES[type]
    if (cue) navigator.vibrate?.(cue.vibration)
  } catch {
    // Vibration is best-effort in browser/PWA mode.
  }
}

export function playTimerCue(type, { soundEnabled = true, volume = 1 } = {}) {
  const nodes = []
  let cancelled = false
  const ready = soundEnabled
    ? primeTimerAudio(volume).then((context) => {
        if (!context || cancelled) return
        scheduleCue(context, type, 0, nodes)
      })
    : Promise.resolve()
  return {
    ready,
    cancel() {
      cancelled = true
      for (const node of nodes) {
        try { node.stop() } catch { /* It may already have ended. */ }
      }
    }
  }
}

export function timerCueSchedule(duration) {
  const total = Math.max(0, Number(duration) || 0)
  const schedule = []
  if (total >= 60) schedule.push({ id: 'halfway', at: Math.floor(total / 2), type: 'halfway' })
  if (total > 10) schedule.push({ id: 'warning-10', at: 10, type: 'warning' })
  if (total > 3) {
    schedule.push(
      { id: 'countdown-3', at: 3, type: 'countdown' },
      { id: 'countdown-2', at: 2, type: 'countdown' },
      { id: 'countdown-1', at: 1, type: 'countdown' }
    )
  }
  schedule.push({ id: 'final', at: 0, type: 'final' })
  return schedule.sort((a, b) => b.at - a.at)
}

export function timerAudioPlan(duration, remaining, firedCueIds = new Set()) {
  const fired = firedCueIds instanceof Set ? firedCueIds : new Set(firedCueIds)
  return timerCueSchedule(duration)
    .filter((cue) => !fired.has(cue.id) && remaining > cue.at)
    .map((cue) => ({ ...cue, delaySeconds: remaining - cue.at }))
}

export function scheduleTimerAudio({ duration, remaining, firedCueIds = new Set(), soundEnabled = true, volume = 1 }) {
  const nodes = []
  let cancelled = false
  const plan = timerAudioPlan(duration, remaining, firedCueIds)
  const ready = soundEnabled
    ? primeTimerAudio(volume).then((context) => {
        if (!context || cancelled) return
        for (const cue of plan) scheduleCue(context, cue.type, cue.delaySeconds, nodes)
      })
    : Promise.resolve()
  return {
    plan,
    ready,
    cancel() {
      cancelled = true
      for (const node of nodes) {
        try { node.stop() } catch { /* It may already have ended. */ }
      }
    }
  }
}

export function nextTimerCue(duration, previousRemaining, remaining, firedCueIds = new Set()) {
  const crossed = timerCueSchedule(duration).filter((cue) => (
    !firedCueIds.has(cue.id) && previousRemaining > cue.at && remaining <= cue.at
  ))
  if (!crossed.length) return null
  if (remaining <= 0) return crossed.find((cue) => cue.id === 'final') || crossed.at(-1)
  return crossed.at(-1)
}
