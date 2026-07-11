import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { nextTimerCue, playTimerCue, primeTimerAudio } from '../lib/timerAudio.js'

const PRESETS = [
  { id: 'rest-2', label: 'Descanso 2:00', seconds: 120, mode: 'countdown' },
  { id: 'rest-3', label: 'Descanso 3:00', seconds: 180, mode: 'countdown' },
  { id: 'amrap-10', label: 'AMRAP 10:00', seconds: 600, mode: 'countdown' },
  { id: 'emom-10', label: 'EMOM 10:00', seconds: 600, mode: 'emom' },
  { id: 'stopwatch', label: 'Cronometro', seconds: 0, mode: 'stopwatch' }
]

function fmt(seconds) {
  const safe = Math.max(0, Math.round(seconds))
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function SessionTimer({
  suggested,
  title = 'Timer',
  context = '',
  embedded = false,
  compact = false,
  autoStartKey = null,
  onSkip = null
}) {
  const titleId = useId()
  const allPresets = useMemo(() => {
    if (!suggested) return PRESETS
    return [{ id: 'suggested', ...suggested }, ...PRESETS]
  }, [suggested])
  const [presetId, setPresetId] = useState(suggested ? 'suggested' : 'rest-3')
  const preset = allPresets.find((item) => item.id === presetId) || allPresets[0]
  const [phase, setPhase] = useState('idle')
  const [display, setDisplay] = useState(preset.seconds)
  const startedAtRef = useRef(0)
  const offsetRef = useRef(0)
  const durationRef = useRef(preset.seconds)
  const doneRef = useRef(false)
  const autoStartRef = useRef(null)
  const firedCueIdsRef = useRef(new Set())
  const previousRemainingRef = useRef(preset.seconds)

  useEffect(() => {
    if (presetId !== 'suggested') return
    if (phase !== 'idle' && phase !== 'done') return
    durationRef.current = preset.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = preset.seconds
    setDisplay(preset.seconds)
    offsetRef.current = 0
    doneRef.current = false
  }, [preset.seconds, presetId, phase])

  useEffect(() => {
    if (!autoStartKey || autoStartRef.current === autoStartKey) return
    autoStartRef.current = autoStartKey
    setPresetId(suggested ? 'suggested' : 'rest-3')
    offsetRef.current = 0
    durationRef.current = (suggested || PRESETS[1]).seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = durationRef.current
    doneRef.current = false
    setDisplay((suggested || PRESETS[1]).seconds)
    startedAtRef.current = Date.now()
    setPhase('running')
  }, [autoStartKey, suggested])

  useEffect(() => {
    if (phase !== 'running') return
    const tick = window.setInterval(() => {
      const elapsed = offsetRef.current + (Date.now() - startedAtRef.current) / 1000
      if (preset.mode === 'stopwatch') {
        setDisplay(elapsed)
        return
      }
      const remaining = Math.max(0, durationRef.current - elapsed)
      setDisplay(remaining)
      const cue = nextTimerCue(
        durationRef.current,
        previousRemainingRef.current,
        remaining,
        firedCueIdsRef.current
      )
      if (cue) {
        firedCueIdsRef.current.add(cue.id)
        playTimerCue(cue.type)
      }
      previousRemainingRef.current = remaining
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true
        setPhase('done')
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [phase, preset.mode, preset.seconds])

  function start() {
    primeTimerAudio()
    if (phase !== 'paused') {
      offsetRef.current = 0
      durationRef.current = preset.seconds
      firedCueIdsRef.current = new Set()
      previousRemainingRef.current = durationRef.current
      setDisplay(durationRef.current)
    }
    doneRef.current = false
    startedAtRef.current = Date.now()
    setPhase('running')
  }

  function pause() {
    if (phase !== 'running') return
    offsetRef.current += (Date.now() - startedAtRef.current) / 1000
    setPhase('paused')
  }

  function reset() {
    offsetRef.current = 0
    durationRef.current = preset.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = preset.seconds
    doneRef.current = false
    setDisplay(preset.seconds)
    setPhase('idle')
  }

  function changePreset(nextId) {
    setPresetId(nextId)
    const next = allPresets.find((item) => item.id === nextId) || allPresets[0]
    offsetRef.current = 0
    durationRef.current = next.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = next.seconds
    doneRef.current = false
    setDisplay(next.seconds)
    setPhase('idle')
  }

  function adjust(seconds) {
    if (preset.mode === 'stopwatch') return
    durationRef.current = Math.max(0, durationRef.current + seconds)
    setDisplay((value) => {
      const nextDisplay = Math.max(0, value + seconds)
      previousRemainingRef.current = nextDisplay
      return nextDisplay
    })
  }

  function skip() {
    reset()
    onSkip?.()
  }

  const emomRound = preset.mode === 'emom' && phase === 'running'
    ? Math.floor((preset.seconds - display) / 60) + 1
    : null

  return (
    <section
      className={`timer-card ${embedded ? 'embedded-timer' : ''} ${compact ? 'compact-timer-card' : ''} ${phase === 'running' ? 'live' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="section-title timer-heading">
        <div>
          <span className="eyebrow">{title}</span>
          <h2 id={titleId}>{preset.label}</h2>
          {context && <p className="timer-context">{context}</p>}
        </div>
        {emomRound && <span className="status-pill">Ronda {Math.min(10, emomRound)}</span>}
      </div>
      <div className={`timer-face ${compact ? 'compact' : ''}`} role="timer" aria-live="polite">
        {fmt(display)}
      </div>
      <div className={`timer-controls ${compact ? 'compact' : ''}`}>
        {compact && preset.mode !== 'stopwatch' && <button onClick={() => adjust(-15)}>-15 s</button>}
        {phase === 'running' ? (
          <button onClick={pause}>Pausa</button>
        ) : (
          <button className="primary" onClick={start}>
            {phase === 'paused' ? 'Reanudar' : 'Start'}
          </button>
        )}
        {compact && preset.mode !== 'stopwatch' && <button onClick={() => adjust(15)}>+15 s</button>}
        <button onClick={skip}>{compact ? 'Omitir' : 'Reset'}</button>
      </div>
      <details className="timer-settings">
        <summary>Ajustes del timer</summary>
        <p className="timer-cue-note">Avisos sonoros: mitad · 10 s · cuenta atras 3-2-1 · final.</p>
        <div className="timer-settings-fields">
          <select aria-label="Preset de timer" value={presetId} onChange={(event) => changePreset(event.target.value)}>
            {allPresets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button onClick={reset}>Reset</button>
        </div>
      </details>
    </section>
  )
}
