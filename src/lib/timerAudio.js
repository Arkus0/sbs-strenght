let audioContext = null
let masterGain = null

function timerAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  if (!audioContext) {
    audioContext = new AudioContext()
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.72
    masterGain.connect(audioContext.destination)
  }
  return audioContext
}

export function primeTimerAudio() {
  try {
    const context = timerAudioContext()
    if (!context) return
    if (context.state === 'suspended') context.resume().catch(() => {})
  } catch {
    // Audio and vibration are best-effort in browser/PWA mode.
  }
}

function tone(context, { at = 0, duration = 0.12, frequency, volume = 0.5, type = 'square' }) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const startAt = context.currentTime + at
  const endAt = startAt + duration
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, endAt)
  oscillator.connect(gain)
  gain.connect(masterGain)
  oscillator.start(startAt)
  oscillator.stop(endAt + 0.02)
}

const CUES = {
  halfway: {
    tones: [
      { frequency: 660, duration: 0.11, volume: 0.46 },
      { frequency: 880, at: 0.15, duration: 0.11, volume: 0.5 }
    ],
    vibration: [70, 55, 70]
  },
  warning: {
    tones: [
      { frequency: 780, duration: 0.13, volume: 0.52 },
      { frequency: 780, at: 0.18, duration: 0.13, volume: 0.52 }
    ],
    vibration: [90, 70, 90]
  },
  countdown: {
    tones: [{ frequency: 940, duration: 0.14, volume: 0.58 }],
    vibration: [100]
  },
  final: {
    tones: [
      { frequency: 1040, duration: 0.2, volume: 0.66 },
      { frequency: 1320, at: 0.24, duration: 0.32, volume: 0.72 }
    ],
    vibration: [220, 90, 220, 90, 360]
  }
}

export function playTimerCue(type) {
  try {
    const cue = CUES[type]
    const context = timerAudioContext()
    if (!cue || !context) return
    const play = () => cue.tones.forEach((definition) => tone(context, definition))
    if (context.state === 'suspended') context.resume().then(play).catch(() => {})
    else play()
    navigator.vibrate?.(cue.vibration)
  } catch {
    // Audio and vibration are best-effort in browser/PWA mode.
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

export function nextTimerCue(duration, previousRemaining, remaining, firedCueIds = new Set()) {
  const crossed = timerCueSchedule(duration).filter((cue) => (
    !firedCueIds.has(cue.id) && previousRemaining > cue.at && remaining <= cue.at
  ))
  if (!crossed.length) return null
  if (remaining <= 0) return crossed.find((cue) => cue.id === 'final') || crossed.at(-1)
  return crossed.at(-1)
}
