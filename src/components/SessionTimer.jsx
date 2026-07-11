import { useEffect, useId, useMemo, useRef, useState } from 'react'

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

function beep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.28)
  } catch {
    // Audio is best-effort in browser/PWA mode.
  }
}

export default function SessionTimer({
  suggested,
  title = 'Timer',
  context = '',
  embedded = false,
  autoStartKey = null
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
  const doneRef = useRef(false)
  const autoStartRef = useRef(autoStartKey)

  useEffect(() => {
    if (presetId !== 'suggested') return
    if (phase !== 'idle' && phase !== 'done') return
    setDisplay(preset.seconds)
    offsetRef.current = 0
    doneRef.current = false
  }, [preset.seconds, presetId, phase])

  useEffect(() => {
    if (!autoStartKey || autoStartRef.current === autoStartKey) return
    autoStartRef.current = autoStartKey
    setPresetId(suggested ? 'suggested' : 'rest-3')
    offsetRef.current = 0
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
      const remaining = Math.max(0, preset.seconds - elapsed)
      setDisplay(remaining)
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true
        setPhase('done')
        beep()
        navigator.vibrate?.([100, 50, 100])
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [phase, preset.mode, preset.seconds])

  function start() {
    if (phase !== 'paused') {
      offsetRef.current = 0
      setDisplay(preset.seconds)
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
    doneRef.current = false
    setDisplay(preset.seconds)
    setPhase('idle')
  }

  function changePreset(nextId) {
    setPresetId(nextId)
    const next = allPresets.find((item) => item.id === nextId) || allPresets[0]
    offsetRef.current = 0
    doneRef.current = false
    setDisplay(next.seconds)
    setPhase('idle')
  }

  const emomRound = preset.mode === 'emom' && phase === 'running'
    ? Math.floor((preset.seconds - display) / 60) + 1
    : null

  return (
    <section
      className={`timer-card ${embedded ? 'embedded-timer' : ''} ${phase === 'running' ? 'live' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="section-title">
        <div>
          <span className="eyebrow">{title}</span>
          <h2 id={titleId}>{preset.label}</h2>
          {context && <p className="timer-context">{context}</p>}
        </div>
        {emomRound && <span className="status-pill">Ronda {Math.min(10, emomRound)}</span>}
      </div>
      <div className="timer-face" role="timer" aria-live="polite">
        {fmt(display)}
      </div>
      <div className="timer-controls">
        <select aria-label="Preset de timer" value={presetId} onChange={(event) => changePreset(event.target.value)}>
          {allPresets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {phase === 'running' ? (
          <button onClick={pause}>Pausa</button>
        ) : (
          <button className="primary" onClick={start}>
            {phase === 'paused' ? 'Reanudar' : 'Start'}
          </button>
        )}
        <button onClick={reset}>Reset</button>
      </div>
    </section>
  )
}
