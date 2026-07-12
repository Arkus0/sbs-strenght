import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  nextTimerCue,
  playTimerCue,
  playTimerVibration,
  scheduleTimerAudio,
  timerAudioContextState,
  timerCueSchedule
} from '../lib/timerAudio.js'
import { consumedTimerCueIds, normalizeActiveRestTimer } from '../lib/timerState.js'

const PRESETS = [
  { id: 'rest-2', label: 'Descanso 2:00', seconds: 120, mode: 'countdown' },
  { id: 'rest-3', label: 'Descanso 3:00', seconds: 180, mode: 'countdown' },
  { id: 'amrap-10', label: 'AMRAP 10:00', seconds: 600, mode: 'countdown' },
  { id: 'emom-10', label: 'EMOM 10:00', seconds: 600, mode: 'emom' },
  { id: 'stopwatch', label: 'Cronometro', seconds: 0, mode: 'stopwatch' }
]

const DEFAULT_PREFERENCES = {
  soundEnabled: true,
  volume: 1,
  vibrationEnabled: true,
  visualAlertEnabled: true
}

function normalizePreferences(preferences) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
    volume: Math.min(1, Math.max(0, Number(preferences?.volume ?? 1)))
  }
}

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
  initialState = null,
  preferences = DEFAULT_PREFERENCES,
  onPreferencesChange = null,
  onStateChange = null,
  onSkip = null
}) {
  const titleId = useId()
  const allPresets = useMemo(() => {
    if (!suggested) return PRESETS
    return [{ id: 'suggested', ...suggested }, ...PRESETS]
  }, [suggested])
  const restoredRef = useRef(undefined)
  if (restoredRef.current === undefined) restoredRef.current = normalizeActiveRestTimer(initialState)
  const restored = restoredRef.current
  const initialPresetId = restored && allPresets.some((item) => item.id === restored.presetId)
    ? restored.presetId
    : suggested ? 'suggested' : 'rest-3'
  const initialPreset = allPresets.find((item) => item.id === initialPresetId) || allPresets[0]

  const [presetId, setPresetId] = useState(initialPresetId)
  const preset = allPresets.find((item) => item.id === presetId) || allPresets[0]
  const [phase, setPhase] = useState(restored?.phase || 'idle')
  const [display, setDisplay] = useState(restored?.remainingSeconds ?? initialPreset.seconds)
  const [audioRevision, setAudioRevision] = useState(0)
  const [visualAlert, setVisualAlert] = useState(false)
  const phaseRef = useRef(restored?.phase || 'idle')
  const startedAtRef = useRef(Date.now())
  const offsetRef = useRef(0)
  const durationRef = useRef(restored?.durationSeconds ?? initialPreset.seconds)
  const deadlineAtRef = useRef(restored?.deadlineAt ? Date.parse(restored.deadlineAt) : 0)
  const timerIdRef = useRef(restored?.id || autoStartKey || `timer-${Date.now()}`)
  const autoStartRef = useRef(restored ? autoStartKey : null)
  const firedCueIdsRef = useRef(new Set(restored?.firedCueIds || []))
  const previousRemainingRef = useRef(restored?.remainingSeconds ?? initialPreset.seconds)
  const audioHandleRef = useRef(null)
  const visualTimeoutRef = useRef(null)
  const visualFrameRef = useRef(null)
  const missedFinalRef = useRef(false)
  const preferencesRef = useRef(normalizePreferences(preferences))
  const onStateChangeRef = useRef(onStateChange)

  useEffect(() => { onStateChangeRef.current = onStateChange }, [onStateChange])
  useEffect(() => { preferencesRef.current = normalizePreferences(preferences) }, [preferences])

  function setTimerPhase(nextPhase) {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }

  function currentRemaining(at = Date.now()) {
    return Math.max(0, (deadlineAtRef.current - at) / 1000)
  }

  function timerSnapshot(nextPhase, remainingSeconds, at = Date.now()) {
    if (preset.mode === 'stopwatch') return null
    return {
      version: 1,
      id: timerIdRef.current,
      presetId,
      label: preset.label,
      context,
      mode: preset.mode,
      phase: nextPhase,
      durationSeconds: durationRef.current,
      deadlineAt: nextPhase === 'running' ? new Date(deadlineAtRef.current).toISOString() : null,
      remainingSeconds: Math.max(0, remainingSeconds),
      firedCueIds: [...firedCueIdsRef.current],
      updatedAt: new Date(at).toISOString()
    }
  }

  function persistTimer(nextPhase, remainingSeconds, at = Date.now()) {
    const snapshot = timerSnapshot(nextPhase, remainingSeconds, at)
    if (snapshot) onStateChangeRef.current?.(snapshot)
  }

  function triggerVisualAlert() {
    if (!preferencesRef.current.visualAlertEnabled) return
    if (visualTimeoutRef.current) window.clearTimeout(visualTimeoutRef.current)
    if (visualFrameRef.current) window.cancelAnimationFrame(visualFrameRef.current)
    setVisualAlert(false)
    visualFrameRef.current = window.requestAnimationFrame(() => setVisualAlert(true))
    visualTimeoutRef.current = window.setTimeout(() => setVisualAlert(false), 1500)
  }

  function markCrossedCues(remaining) {
    firedCueIdsRef.current = new Set(consumedTimerCueIds(
      durationRef.current,
      remaining,
      [...firedCueIdsRef.current]
    ))
  }

  useEffect(() => {
    audioHandleRef.current?.cancel()
    audioHandleRef.current = null
    if (phase !== 'running' || preset.mode === 'stopwatch') return undefined
    const remaining = currentRemaining()
    audioHandleRef.current = scheduleTimerAudio({
      duration: durationRef.current,
      remaining,
      firedCueIds: firedCueIdsRef.current,
      ...preferencesRef.current
    })
    return () => {
      audioHandleRef.current?.cancel()
      audioHandleRef.current = null
    }
  }, [audioRevision, phase, preset.mode, preferences.soundEnabled, preferences.volume])

  useEffect(() => () => {
    audioHandleRef.current?.cancel()
    if (visualTimeoutRef.current) window.clearTimeout(visualTimeoutRef.current)
    if (visualFrameRef.current) window.cancelAnimationFrame(visualFrameRef.current)
  }, [])

  useEffect(() => {
    if (presetId !== 'suggested' || restored) return
    if (phase !== 'idle' && phase !== 'done') return
    durationRef.current = preset.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = preset.seconds
    setDisplay(preset.seconds)
    offsetRef.current = 0
    deadlineAtRef.current = 0
  }, [phase, preset.seconds, presetId, restored])

  useEffect(() => {
    if (!autoStartKey || autoStartRef.current === autoStartKey || restored) return
    autoStartRef.current = autoStartKey
    timerIdRef.current = autoStartKey
    const nextPreset = suggested || PRESETS[1]
    setPresetId(suggested ? 'suggested' : 'rest-3')
    offsetRef.current = 0
    durationRef.current = nextPreset.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = nextPreset.seconds
    setDisplay(nextPreset.seconds)
    startedAtRef.current = Date.now()
    deadlineAtRef.current = Date.now() + nextPreset.seconds * 1000
    setTimerPhase('running')
    setAudioRevision((value) => value + 1)
  }, [autoStartKey, restored, suggested])

  useEffect(() => {
    if (phase !== 'running') return undefined
    const tick = window.setInterval(() => {
      if (preset.mode === 'stopwatch') {
        setDisplay(offsetRef.current + (Date.now() - startedAtRef.current) / 1000)
        return
      }
      const now = Date.now()
      const remaining = currentRemaining(now)
      setDisplay(remaining)
      const cue = nextTimerCue(
        durationRef.current,
        previousRemainingRef.current,
        remaining,
        firedCueIdsRef.current
      )
      if (cue) {
        firedCueIdsRef.current.add(cue.id)
        playTimerVibration(cue.type, preferencesRef.current.vibrationEnabled)
        if (cue.id === 'final') {
          triggerVisualAlert()
          missedFinalRef.current = document.visibilityState === 'hidden' && timerAudioContextState() === 'suspended'
        }
      }
      previousRemainingRef.current = remaining
      if (remaining <= 0) {
        markCrossedCues(0)
        setTimerPhase('done')
        persistTimer('done', 0, now)
      } else if (cue) {
        persistTimer('running', remaining, now)
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [phase, preset.mode])

  useEffect(() => {
    function visibilityChanged() {
      if (document.visibilityState !== 'visible') return
      if (phaseRef.current === 'done') {
        if (missedFinalRef.current) {
          missedFinalRef.current = false
          playTimerCue('final', preferencesRef.current)
          playTimerVibration('final', preferencesRef.current.vibrationEnabled)
          triggerVisualAlert()
        }
        return
      }
      if (phaseRef.current !== 'running' || preset.mode === 'stopwatch') return
      const now = Date.now()
      const remaining = currentRemaining(now)
      audioHandleRef.current?.cancel()
      markCrossedCues(remaining)
      previousRemainingRef.current = remaining
      setDisplay(remaining)
      if (remaining <= 0) {
        const audioWasSuspended = timerAudioContextState() === 'suspended'
        setTimerPhase('done')
        persistTimer('done', 0, now)
        playTimerVibration('final', preferencesRef.current.vibrationEnabled)
        triggerVisualAlert()
        if (audioWasSuspended) playTimerCue('final', preferencesRef.current)
      } else {
        persistTimer('running', remaining, now)
        setAudioRevision((value) => value + 1)
      }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => document.removeEventListener('visibilitychange', visibilityChanged)
  }, [context, preset.label, preset.mode, presetId])

  function start() {
    const now = Date.now()
    if (preset.mode === 'stopwatch') {
      if (phase !== 'paused') offsetRef.current = 0
      startedAtRef.current = now
      setTimerPhase('running')
      return
    }
    const remaining = phase === 'paused' ? display : durationRef.current
    if (phase !== 'paused') {
      firedCueIdsRef.current = new Set()
      previousRemainingRef.current = remaining
      setDisplay(remaining)
    }
    deadlineAtRef.current = now + remaining * 1000
    missedFinalRef.current = false
    setTimerPhase('running')
    persistTimer('running', remaining, now)
    setAudioRevision((value) => value + 1)
  }

  function pause() {
    if (phase !== 'running') return
    if (preset.mode === 'stopwatch') {
      offsetRef.current += (Date.now() - startedAtRef.current) / 1000
      setDisplay(offsetRef.current)
      setTimerPhase('paused')
      return
    }
    const now = Date.now()
    const remaining = currentRemaining(now)
    setDisplay(remaining)
    previousRemainingRef.current = remaining
    deadlineAtRef.current = 0
    setTimerPhase('paused')
    persistTimer('paused', remaining, now)
  }

  function reset() {
    offsetRef.current = 0
    durationRef.current = preset.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = preset.seconds
    deadlineAtRef.current = 0
    missedFinalRef.current = false
    setDisplay(preset.seconds)
    setTimerPhase('idle')
    onStateChangeRef.current?.(null)
  }

  function changePreset(nextId) {
    const next = allPresets.find((item) => item.id === nextId) || allPresets[0]
    setPresetId(nextId)
    offsetRef.current = 0
    durationRef.current = next.seconds
    firedCueIdsRef.current = new Set()
    previousRemainingRef.current = next.seconds
    deadlineAtRef.current = 0
    missedFinalRef.current = false
    setDisplay(next.seconds)
    setTimerPhase('idle')
    onStateChangeRef.current?.(null)
  }

  function adjust(seconds) {
    if (preset.mode === 'stopwatch') return
    const now = Date.now()
    const baseRemaining = phase === 'running' ? currentRemaining(now) : display
    const nextRemaining = Math.max(0, baseRemaining + seconds)
    durationRef.current = Math.max(0, durationRef.current + seconds)
    previousRemainingRef.current = nextRemaining
    setDisplay(nextRemaining)
    if (phase === 'running') deadlineAtRef.current = now + nextRemaining * 1000
    if (nextRemaining <= 0) {
      audioHandleRef.current?.cancel()
      markCrossedCues(0)
      setTimerPhase('done')
      playTimerCue('final', preferencesRef.current)
      playTimerVibration('final', preferencesRef.current.vibrationEnabled)
      triggerVisualAlert()
      persistTimer('done', 0, now)
      return
    }
    if (phase === 'running') {
      persistTimer('running', nextRemaining, now)
      setAudioRevision((value) => value + 1)
    } else if (phase === 'paused') {
      persistTimer('paused', nextRemaining, now)
    }
  }

  function extendFinished() {
    const now = Date.now()
    durationRef.current += 15
    deadlineAtRef.current = now + 15_000
    previousRemainingRef.current = 15
    firedCueIdsRef.current = new Set(timerCueSchedule(durationRef.current)
      .filter((cue) => cue.at >= 15)
      .map((cue) => cue.id))
    setDisplay(15)
    missedFinalRef.current = false
    setTimerPhase('running')
    persistTimer('running', 15, now)
    setAudioRevision((value) => value + 1)
  }

  function skip() {
    audioHandleRef.current?.cancel()
    if (onSkip) onSkip()
    else reset()
  }

  function patchPreferences(patch) {
    const next = normalizePreferences({ ...preferencesRef.current, ...patch })
    preferencesRef.current = next
    onPreferencesChange?.(next)
    if (phaseRef.current === 'running') setAudioRevision((value) => value + 1)
  }

  function testFinalCue() {
    playTimerCue('final', preferencesRef.current)
    playTimerVibration('final', preferencesRef.current.vibrationEnabled)
    triggerVisualAlert()
  }

  const emomRound = preset.mode === 'emom' && phase === 'running'
    ? Math.floor((durationRef.current - display) / 60) + 1
    : null
  const done = phase === 'done'
  const normalizedPreferences = normalizePreferences(preferences)

  return (
    <section
      className={`timer-card ${embedded ? 'embedded-timer' : ''} ${compact ? 'compact-timer-card' : ''} ${phase === 'running' ? 'live' : ''} ${done ? 'done' : ''} ${visualAlert ? 'visual-alert' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="section-title timer-heading">
        <div>
          <span className="eyebrow">{done ? 'Descanso terminado' : title}</span>
          <h2 id={titleId}>{done ? 'Listo para la siguiente serie' : preset.label}</h2>
          {context && <p className="timer-context">{context}</p>}
        </div>
        {emomRound && <span className="status-pill">Ronda {Math.min(10, emomRound)}</span>}
      </div>
      <div className={`timer-face ${compact ? 'compact' : ''}`} role="timer" aria-live={done ? 'assertive' : 'polite'}>
        {fmt(display)}
      </div>
      {done ? (
        <div className={`timer-controls ${compact ? 'compact done-controls' : ''}`}>
          <button className="primary" onClick={extendFinished}>+15 s</button>
          <button onClick={skip}>Cerrar</button>
        </div>
      ) : (
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
      )}
      <details className="timer-settings">
        <summary>Ajustes del timer</summary>
        <p className="timer-cue-note">Avisos: mitad · 10 s · cuenta atrás 3-2-1 · final.</p>
        <div className="timer-settings-fields">
          <select aria-label="Preset de timer" value={presetId} onChange={(event) => changePreset(event.target.value)}>
            {allPresets.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <button onClick={reset}>Reset</button>
        </div>
        <div className="timer-feedback-settings">
          <label className="timer-volume">
            <span>Volumen <strong>{Math.round(normalizedPreferences.volume * 100)}%</strong></span>
            <input
              aria-label="Volumen de avisos"
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(normalizedPreferences.volume * 100)}
              disabled={!normalizedPreferences.soundEnabled}
              onChange={(event) => patchPreferences({ volume: Number(event.target.value) / 100 })}
            />
          </label>
          <label><input type="checkbox" checked={normalizedPreferences.soundEnabled} onChange={(event) => patchPreferences({ soundEnabled: event.target.checked })} /> Sonido</label>
          <label><input type="checkbox" checked={normalizedPreferences.vibrationEnabled} onChange={(event) => patchPreferences({ vibrationEnabled: event.target.checked })} /> Vibración</label>
          <label><input type="checkbox" checked={normalizedPreferences.visualAlertEnabled} onChange={(event) => patchPreferences({ visualAlertEnabled: event.target.checked })} /> Aviso visual</label>
          <button type="button" onClick={testFinalCue}>Probar aviso final</button>
        </div>
      </details>
    </section>
  )
}
