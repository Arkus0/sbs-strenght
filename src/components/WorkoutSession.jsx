import { useEffect, useRef, useState } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { bodybuildingForSession, conditioningOptionsForSession } from '../lib/assistanceProgram.js'
import {
  buildSessionPlan,
  createEmptySessionLog,
  normalizeSessionLogForPlan,
  roundToIncrement
} from '../lib/sbsRtf.js'
import { materializeSessionInputs, runnerInputKey, RUNNER_INPUT_VERSION } from '../lib/sessionInputs.js'
import { primeTimerAudio } from '../lib/timerAudio.js'
import SessionTimer from './SessionTimer.jsx'

function numberValue(value) {
  return value ?? ''
}

function updateNested(object, key, patch) {
  return {
    ...object,
    [key]: {
      ...(object?.[key] || {}),
      ...patch
    }
  }
}

function recordedSetWeight(set) {
  return set?.weight ?? ''
}

function effectiveSetWeight(set) {
  return set?.weight !== '' && set?.weight !== undefined ? set.weight : set?.prescribedWeight ?? ''
}

function recordedSetReps(set) {
  return set?.reps ?? ''
}

function effectiveSetReps(set) {
  return set?.reps !== '' && set?.reps !== undefined
    ? set.reps
    : set?.kind === 'work'
      ? set.targetReps
      : set?.reps ?? ''
}

function setLabel(set) {
  if (set?.kind === 'single_at8') return 'Single'
  if (set?.kind === 'amrap') return 'AMRAP'
  const match = String(set?.label || '').match(/Serie\s+(\d+)/i)
  return match ? `S${match[1]}` : set?.label || 'Serie'
}

function setTarget(set) {
  if (set?.kind === 'single_at8') return '1 @8'
  if (set?.kind === 'amrap') return `${set.targetReps}+`
  return String(set?.targetReps || '-')
}

function restPreset(set, lift) {
  if (set?.kind === 'single_at8') {
    return { label: 'Descanso tecnico 2:00', seconds: 120, mode: 'countdown' }
  }
  if (set?.kind === 'amrap') {
    return { label: 'Descanso largo 4:00', seconds: 240, mode: 'countdown' }
  }
  return {
    label: lift?.kind === 'main' ? 'Descanso principal 3:00' : 'Descanso auxiliar 2:00',
    seconds: lift?.kind === 'main' ? 180 : 120,
    mode: 'countdown'
  }
}

function sourceLabel(source) {
  return {
    initial: 'Inicial',
    carried: 'Arrastre',
    last_set: 'Ultimo set',
    single_at8: 'Single @8',
    manual_override: 'Manual',
    missing: 'Pendiente'
  }[source] || source
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function completedCount(sets) {
  return (sets || []).filter((set) => set.done).length
}

function MainLiftCard({ lift, liftLog, units, rowError, pendingSingleCalibration, onSetChange, onToggleSet, onLiftChange, onApplySingleCalibration, onDismissSingleCalibration }) {
  const sets = liftLog.sets || []
  const singleSet = sets.find((set) => set.kind === 'single_at8')
  return (
    <article className="workout-exercise-card main-exercise-card">
      <header className="exercise-card-header">
        <div>
          <span className="eyebrow">{lift.label}</span>
          <h2>{lift.name}</h2>
          <p>{Math.max(0, lift.setGoal - 1)}x{lift.normalReps} + 1x{lift.repOutTarget}+ · {lift.weight ?? '-'} {units}</p>
        </div>
        <span className="exercise-progress">{completedCount(sets)}/{sets.length}</span>
      </header>

      <div className="set-table-head" aria-hidden="true">
        <span>Serie</span>
        <span>Objetivo</span>
        <span>Peso</span>
        <span>Reps</span>
        <span>Hecha</span>
      </div>
      <div className="compact-set-list" aria-label={`Series de ${lift.name}`}>
        {sets.map((set) => {
          const errorKey = `${lift.slotId}:${set.id}`
          return (
            <div className={`compact-set-row ${set.done ? 'done' : ''} ${rowError === errorKey ? 'invalid' : ''}`} key={set.id}>
              <strong>{setLabel(set)}</strong>
              <span className="set-target">{setTarget(set)}</span>
              <label>
                <span className="sr-only">Peso {set.label} {lift.name}</span>
                <input
                  inputMode="decimal"
                  aria-label={`Peso ${set.label} ${lift.name}`}
                  value={numberValue(recordedSetWeight(set))}
                  onChange={(event) => onSetChange(lift.slotId, set.id, { weight: event.target.value })}
                />
              </label>
              <label>
                <span className="sr-only">Reps {set.label} {lift.name}</span>
                <input
                  inputMode="numeric"
                  aria-label={`Reps ${set.label} ${lift.name}`}
                  value={numberValue(recordedSetReps(set))}
                  onChange={(event) => onSetChange(lift.slotId, set.id, { reps: event.target.value })}
                />
              </label>
              <button
                className="set-done-button"
                aria-label={`${set.done ? 'Desmarcar' : 'Completar'} ${set.label} ${lift.name}`}
                aria-pressed={set.done}
                onClick={() => onToggleSet(lift, set)}
              >
                ✓
              </button>
              {rowError === errorKey && <small className="set-row-error">Introduce una carga y unas reps válidas antes de completar.</small>}
            </div>
          )
        })}
      </div>

      {singleSet?.done && !singleSet.useForAutoregulation && pendingSingleCalibration === `${lift.slotId}:${singleSet.id}` && (
        <div className="single-calibration-prompt" role="region" aria-label={`Calibrar el TM de ${lift.name}`}>
          <div>
            <strong>¿Calibrar el TM con esta single?</strong>
            <small>{singleSet.weight} {units} al {Math.round(lift.singleAt8Pct * 10000) / 100}%.</small>
          </div>
          <div>
            <button autoFocus className="primary" onClick={() => onApplySingleCalibration(lift, singleSet)}>Calibrar TM</button>
            <button onClick={onDismissSingleCalibration}>Mantener TM</button>
          </div>
        </div>
      )}

      <details className="exercise-details">
        <summary>Detalles y notas</summary>
        <div className="prescription-grid compact-prescription">
          <div><span>Intensidad</span><strong>{Math.round(lift.intensity * 1000) / 10}%</strong></div>
          <div><span>TM</span><strong>{lift.projection.trainingMax ?? '-'}</strong></div>
          <div><span>Fuente</span><strong>{sourceLabel(lift.projection.source)}</strong></div>
          <div>
            <span>Ajuste</span>
            <strong>
              {lift.projection.delta === null
                ? '-'
                : `${lift.projection.delta > 0 ? '+' : ''}${lift.projection.delta} reps · ${Math.round(lift.projection.adjustment * 1000) / 10}%`}
            </strong>
          </div>
        </div>
        <div className="inline-fields">
          <label>
            RPE real del single (opcional)
            <input
              inputMode="decimal"
              aria-label={`RPE del single ${lift.name}`}
              value={liftLog.singleRpe || ''}
              onChange={(event) => onLiftChange(lift.slotId, { singleRpe: event.target.value })}
            />
          </label>
          <label>
            Video
            <input value={liftLog.video || ''} onChange={(event) => onLiftChange(lift.slotId, { video: event.target.value })} />
          </label>
          <label>
            Notas del lift
            <textarea rows="2" value={liftLog.notes || ''} onChange={(event) => onLiftChange(lift.slotId, { notes: event.target.value })} />
          </label>
        </div>
      </details>
    </article>
  )
}

function BodybuildingCard({ item, exerciseIndex, units, rowError, onChange, onSetChange, onToggleSet }) {
  return (
    <article className="workout-exercise-card bodybuilding-exercise-card">
      <header className="exercise-card-header">
        <div>
          <span className="eyebrow">{item.role === 'back' ? 'Espalda' : item.category.replaceAll('_', ' ')}</span>
          <h2>{item.name}</h2>
          <p>{item.targetSets}x{item.repMin}-{item.repMax}</p>
        </div>
        <span className={`progression-badge ${item.progressionAction}`}>
          {item.deload
            ? 'Sin progresion'
            : item.progressionAction === 'increase'
              ? 'Subir carga'
              : item.progressionAction === 'reduce'
                ? 'Bajar carga'
              : item.progressionAction === 'repeat'
                ? 'Repetir carga'
                : 'Elige carga'}
        </span>
      </header>

      {item.previousSessionId && <p className="previous-performance">Anterior: {item.previousLoad || '-'} {units} · {item.previousSessionId}</p>}
      {item.recommendation?.reason && (
        <p className="accessory-recommendation">
          <strong>Recomendación: {item.recommendedLoad || item.previousLoad || 'elige carga'} {item.recommendedLoad || item.previousLoad ? units : ''}</strong>
          <span>{item.recommendation.reason}</span>
        </p>
      )}
      <label className="exercise-load-field">
        {item.loadMode === 'added_weight' ? 'Lastre' : 'Carga'} ({units})
        <input
          inputMode="decimal"
          aria-label={`Carga ${item.name}`}
          value={numberValue(item.load)}
          onChange={(event) => onChange(exerciseIndex, { load: event.target.value })}
        />
      </label>

      <div className="set-table-head bodybuilding-head" aria-hidden="true">
        <span>Serie</span>
        <span>Objetivo</span>
        <span>Reps</span>
        <span>Hecha</span>
      </div>
      <div className="compact-set-list bodybuilding-compact-list" aria-label={`Series de ${item.name}`}>
        {item.sets.map((set, setIndex) => {
          const errorKey = `bodybuilding:${exerciseIndex}:${set.id}`
          return (
            <div className={`compact-set-row bodybuilding-row ${set.done ? 'done' : ''} ${rowError === errorKey ? 'invalid' : ''}`} key={set.id}>
              <strong>S{setIndex + 1}</strong>
              <span className="set-target">{item.repMin}-{item.repMax}</span>
              <label>
                <span className="sr-only">Reps serie {setIndex + 1} {item.name}</span>
                <input
                  inputMode="numeric"
                  aria-label={`Reps serie ${setIndex + 1} ${item.name}`}
                  value={numberValue(set.reps)}
                  onChange={(event) => onSetChange(exerciseIndex, setIndex, { reps: event.target.value })}
                />
              </label>
              <button
                className="set-done-button"
                aria-label={`${set.done ? 'Desmarcar' : 'Completar'} serie ${setIndex + 1} ${item.name}`}
                aria-pressed={set.done}
                onClick={() => onToggleSet(exerciseIndex, setIndex)}
              >
                ✓
              </button>
              {rowError === errorKey && <small className="set-row-error">Introduce las reps antes de completar.</small>}
            </div>
          )
        })}
      </div>

      <details className="exercise-details">
        <summary>Notas</summary>
        <label>
          Resultado del ejercicio
          <select value={item.outcome || 'performed'} onChange={(event) => onChange(exerciseIndex, { outcome: event.target.value })}>
            <option value="performed">Realizado</option>
            <option value="unavailable">Material no disponible</option>
            <option value="pain">Dolor o molestia</option>
            <option value="skipped">Omitido</option>
          </select>
        </label>
        <label>
          Notas de {item.name}
          <input value={item.notes || ''} onChange={(event) => onChange(exerciseIndex, { notes: event.target.value })} />
        </label>
      </details>
    </article>
  )
}

function ConditioningCard({
  options,
  selectedId,
  log,
  timerKey,
  onSelectedIdChange,
  onStart,
  onSkip,
  onComplete,
  onUpdate
}) {
  const selected = options.find((option) => option.id === selectedId) || options[0] || null
  if (!selected) return null
  const active = log.status === 'selected'
  const completed = log.status === 'completed'
  const skipped = log.status === 'skipped'

  return (
    <article className="workout-exercise-card conditioning-exercise-card">
      <header className="exercise-card-header">
        <div>
          <span className="eyebrow">Opcional</span>
          <h2>Conditioning</h2>
        </div>
        <span className={`status-pill ${completed ? 'completed' : ''}`}>{completed ? 'Hecho' : skipped ? 'Omitido' : 'Opcional'}</span>
      </header>

      <label>
        Propuesta
        <select aria-label="Propuesta de conditioning" value={selected.id} onChange={(event) => onSelectedIdChange(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
        </select>
      </label>
      <div className="conditioning-prescription">
        <strong>{selected.title}</strong>
        <p>{selected.shortPrescription}</p>
        <small>{selected.matchReason} · {selected.sourceLabel}</small>
      </div>

      {!active && !completed && (
        <div className="conditioning-actions">
          <button onClick={onSkip}>{skipped ? 'Seguir omitiendo' : 'Omitir'}</button>
          <button className="primary" onClick={() => onStart(selected)}>Empezar</button>
        </div>
      )}

      {(active || completed) && (
        <>
          {active && (
            <SessionTimer
              embedded
              compact
              title="Conditioning"
              context={selected.title}
              suggested={selected.timerPreset}
              autoStartKey={timerKey}
            />
          )}
          <div className="inline-fields">
            <label>
              Resultado
              <input aria-label="Resultado conditioning" value={log.score || ''} onChange={(event) => onUpdate({ score: event.target.value })} />
            </label>
            <label>
              Carga
              <input inputMode="decimal" aria-label="Carga conditioning" value={log.load || ''} onChange={(event) => onUpdate({ load: event.target.value })} />
            </label>
          </div>
          <details className="exercise-details">
            <summary>Prescripcion completa y notas</summary>
            <pre className="conditioning-raw">{selected.prescription}</pre>
            <label>
              Notas de conditioning
              <textarea rows="2" value={log.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value })} />
            </label>
          </details>
          <div className="conditioning-actions">
            <button onClick={onSkip}>Omitir</button>
            <button className="primary" onClick={completed ? () => onStart(selected) : onComplete}>
              {completed ? 'Reabrir' : 'Completar'}
            </button>
          </div>
        </>
      )}
    </article>
  )
}

export default function WorkoutSession({ setup, logs, selected, onLogChange, onDiscard, onBack, onComplete }) {
  const plan = buildSessionPlan(template, setup, logs, selected.week, selected.day)
  const generatedBodybuilding = bodybuildingForSession(setup, plan, logs)
  const bodybuildingPrescription = logs[plan.id]?.status === 'completed' && logs[plan.id]?.bodybuilding?.length
    ? logs[plan.id].bodybuilding
    : generatedBodybuilding
  const normalizedLog = normalizeSessionLogForPlan(
    plan,
    logs[plan.id] || createEmptySessionLog(plan, bodybuildingPrescription),
    bodybuildingPrescription
  )
  const storedLog = logs[plan.id] || {}
  const materializedInputs = materializeSessionInputs(plan, normalizedLog, logs[plan.id] || null)
  const currentLog = {
    ...materializedInputs.log,
    lifts: Object.fromEntries(plan.lifts.map((lift) => [
      lift.slotId,
      { ...materializedInputs.log.lifts[lift.slotId], singleRpe: storedLog.lifts?.[lift.slotId]?.singleRpe || '' }
    ])),
    activeSeconds: Number(storedLog.activeSeconds || 0),
    lastActiveAt: storedLog.lastActiveAt,
    sessionRpe: storedLog.sessionRpe || '',
    completionSummary: storedLog.completionSummary
  }
  const conditioningOptions = conditioningOptionsForSession(plan, bodybuildingPrescription, logs)
  const savedConditioningId = currentLog.conditioning?.optionId || ''
  const firstConditioningId = conditioningOptions[0]?.id || ''
  const [selectedConditioningId, setSelectedConditioningId] = useState(savedConditioningId || firstConditioningId)
  const [restTimer, setRestTimer] = useState(null)
  const [conditioningTimerKey, setConditioningTimerKey] = useState(null)
  const [rowError, setRowError] = useState('')
  const [pendingSingleCalibration, setPendingSingleCalibration] = useState('')
  const [now, setNow] = useState(Date.now())
  const [resumeNotice, setResumeNotice] = useState(false)
  const activeSecondsRef = useRef(Number(currentLog.activeSeconds || 0))
  const activeStartedAtRef = useRef(Date.now())
  const hiddenAtRef = useRef(null)
  const endingRef = useRef(false)
  const logRef = useRef(currentLog)
  const onLogChangeRef = useRef(onLogChange)

  useEffect(() => { logRef.current = currentLog })
  useEffect(() => { onLogChangeRef.current = onLogChange }, [onLogChange])

  useEffect(() => {
    const stored = logs[plan.id]
    if (!stored || materializedInputs.needsSync) {
      onLogChange(currentLog)
      return
    }
    if (stored.status !== 'completed' && !stored.startedAt) {
      const timestamp = new Date().toISOString()
      onLogChange({ ...currentLog, startedAt: timestamp, activeSeconds: 0, lastActiveAt: timestamp, updatedAt: timestamp })
    }
  }, [currentLog, logs, onLogChange, plan.id])

  useEffect(() => {
    setSelectedConditioningId(savedConditioningId || firstConditioningId)
  }, [firstConditioningId, plan.id, savedConditioningId])

  useEffect(() => {
    setRestTimer(null)
    setConditioningTimerKey(null)
    setRowError('')
    setPendingSingleCalibration('')
    setResumeNotice(false)
    const storedSeconds = Number(logs[plan.id]?.activeSeconds || 0)
    const startedAt = Date.parse(logs[plan.id]?.startedAt || '')
    const recentElapsed = Number.isFinite(startedAt) && Date.now() - startedAt <= 15 * 60 * 1000
      ? (Date.now() - startedAt) / 1000
      : 0
    activeSecondsRef.current = storedSeconds || recentElapsed
    activeStartedAtRef.current = Date.now()
    hiddenAtRef.current = null
  }, [plan.id])

  useEffect(() => {
    if (currentLog.status === 'completed') return undefined

    function elapsed(at = Date.now()) {
      if (hiddenAtRef.current) return activeSecondsRef.current
      return activeSecondsRef.current + Math.max(0, (at - activeStartedAtRef.current) / 1000)
    }

    function persist(at = Date.now()) {
      const seconds = elapsed(at)
      activeSecondsRef.current = seconds
      activeStartedAtRef.current = at
      const timestamp = new Date(at).toISOString()
      onLogChangeRef.current({
        ...logRef.current,
        activeSeconds: Math.round(seconds),
        lastActiveAt: timestamp,
        updatedAt: timestamp
      })
    }

    function visibilityChanged() {
      const timestamp = Date.now()
      if (document.hidden) {
        persist(timestamp)
        hiddenAtRef.current = timestamp
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt) {
        const gapSeconds = (timestamp - hiddenAt) / 1000
        if (gapSeconds <= 15 * 60) activeSecondsRef.current += gapSeconds
        else setResumeNotice(true)
      }
      activeStartedAtRef.current = timestamp
    }

    const interval = window.setInterval(() => persist(), 15_000)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', visibilityChanged)
      if (!hiddenAtRef.current && !endingRef.current) persist()
    }
  }, [currentLog.status, plan.id])

  useEffect(() => {
    if (currentLog.status === 'completed' || !currentLog.startedAt) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [currentLog.startedAt, currentLog.status])

  const requiredMainSets = plan.lifts.flatMap((lift) => (currentLog.lifts[lift.slotId]?.sets || []).filter((set) => !set.optional))
  const bodybuildingSets = currentLog.bodybuilding.flatMap((item) => item.sets || [])
  const requiredSets = [...requiredMainSets, ...bodybuildingSets]
  const completedSets = requiredSets.filter((set) => set.done).length
  const totalSets = requiredSets.length
  const progressPct = totalSets ? Math.round((completedSets / totalSets) * 100) : 0
  const elapsedSeconds = currentLog.status === 'completed'
    ? Number(currentLog.activeSeconds || currentLog.completionSummary?.durationSeconds || 0)
    : activeSecondsRef.current + (hiddenAtRef.current ? 0 : Math.max(0, (now - activeStartedAtRef.current) / 1000))
  const restTimerVisible = Boolean(restTimer && !pendingSingleCalibration)

  function updateLift(slotId, patch, logPatch = {}) {
    onLogChange({
      ...currentLog,
      ...logPatch,
      updatedAt: new Date().toISOString(),
      status: currentLog.status || 'draft',
      lifts: updateNested(currentLog.lifts, slotId, patch)
    })
  }

  function updateSet(slotId, setId, patch) {
    const liftLog = currentLog.lifts[slotId] || { sets: [] }
    let changed = null
    let previous = null
    const sets = liftLog.sets.map((set) => {
      if (set.id !== setId) return set
      previous = set
      const normalizedPatch = { ...patch }
      if (Object.hasOwn(patch, 'weight') && patch.weight === '') {
        normalizedPatch.done = false
        if (set.kind === 'single_at8') normalizedPatch.useForAutoregulation = false
      }
      if (Object.hasOwn(patch, 'reps') && patch.reps === '') normalizedPatch.done = false
      changed = { ...set, ...normalizedPatch }
      return changed
    })
    const derived = {}
    if (changed?.kind === 'single_at8' && Object.hasOwn(patch, 'weight')) derived.singleAt8 = ''
    if (changed?.kind === 'amrap' && Object.hasOwn(patch, 'reps')) derived.lastSetReps = ''
    const origins = { ...(currentLog.runnerInputOrigins || {}) }
    for (const field of ['weight', 'reps']) {
      if (Object.hasOwn(patch, field) && String(previous?.[field] ?? '') !== String(patch[field] ?? '')) {
        origins[runnerInputKey(slotId, setId, field)] = 'manual'
      }
    }
    updateLift(slotId, { sets, ...derived }, {
      runnerInputVersion: RUNNER_INPUT_VERSION,
      runnerInputOrigins: origins
    })
  }

  function setSingleAutoregulation(lift, singleSet, enabled) {
    if (!enabled) {
      updateSet(lift.slotId, singleSet.id, { useForAutoregulation: false })
      return true
    }
    const weight = Number(singleSet.weight)
    const percentage = Number(lift.singleAt8Pct)
    if (!(weight > 0 && percentage > 0)) return false
    const workStarted = currentLog.lifts[lift.slotId]?.sets?.some((set) => set.kind !== 'single_at8' && set.done)
    const nextTm = weight / percentage
    const nextWeight = roundToIncrement(nextTm * Number(lift.intensity), setup.rounding)
    const message = `Esta single sustituirá el TM de ${lift.projection.trainingMax} por ${Math.round(nextTm * 1000) / 1000} y la carga de trabajo por ${nextWeight} ${setup.units}. ¿Aplicar?`
    if (workStarted && !window.confirm(message)) return false
    updateSet(lift.slotId, singleSet.id, { useForAutoregulation: true })
    return true
  }

  function applySingleCalibration(lift, singleSet) {
    if (setSingleAutoregulation(lift, singleSet, true)) setPendingSingleCalibration('')
  }

  function toggleLiftSet(lift, set) {
    const errorKey = `${lift.slotId}:${set.id}`
    if (set.done) {
      setRowError('')
      if (set.kind === 'single_at8') setPendingSingleCalibration('')
      updateSet(lift.slotId, set.id, set.kind === 'single_at8' ? { done: false, useForAutoregulation: false } : { done: false })
      return
    }
    const reps = effectiveSetReps(set)
    const validReps = set.kind === 'amrap'
      ? Number.isInteger(Number(reps)) && Number(reps) >= 0
      : Number(reps) > 0
    const weight = effectiveSetWeight(set)
    if (!validReps || !(Number(weight) > 0)) {
      setRowError(errorKey)
      return
    }
    setRowError('')
    primeTimerAudio()
    updateSet(lift.slotId, set.id, {
      done: true,
      weight,
      reps
    })
    if (set.kind === 'single_at8') setPendingSingleCalibration(errorKey)
    setRestTimer({
      key: `${plan.id}:${lift.slotId}:${set.id}:${Date.now()}`,
      suggested: restPreset(set, lift),
      context: `${lift.name} · ${set.label}`
    })
  }

  function updateBodybuilding(exerciseIndex, patch) {
    const bodybuilding = [...currentLog.bodybuilding]
    bodybuilding[exerciseIndex] = { ...bodybuilding[exerciseIndex], ...patch }
    onLogChange({ ...currentLog, bodybuilding, updatedAt: new Date().toISOString() })
  }

  function updateBodybuildingSet(exerciseIndex, setIndex, patch) {
    const item = currentLog.bodybuilding[exerciseIndex]
    const sets = [...item.sets]
    sets[setIndex] = { ...sets[setIndex], ...patch }
    updateBodybuilding(exerciseIndex, { sets })
  }

  function toggleBodybuildingSet(exerciseIndex, setIndex) {
    const item = currentLog.bodybuilding[exerciseIndex]
    const set = item.sets[setIndex]
    const errorKey = `bodybuilding:${exerciseIndex}:${set.id}`
    if (set.done) {
      setRowError('')
      updateBodybuildingSet(exerciseIndex, setIndex, { done: false })
      return
    }
    if (!(Number(set.reps) > 0)) {
      setRowError(errorKey)
      return
    }
    setRowError('')
    primeTimerAudio()
    updateBodybuildingSet(exerciseIndex, setIndex, { done: true })
    setRestTimer({
      key: `${plan.id}:${item.slotKey}:${set.id}:${Date.now()}`,
      suggested: { label: 'Descanso bodybuilding 2:00', seconds: 120, mode: 'countdown' },
      context: `${item.name} · Serie ${setIndex + 1}`
    })
  }

  function updateConditioning(patch) {
    onLogChange({
      ...currentLog,
      updatedAt: new Date().toISOString(),
      conditioning: { ...currentLog.conditioning, ...patch }
    })
  }

  function startConditioning(option) {
    primeTimerAudio()
    setSelectedConditioningId(option.id)
    updateConditioning({ optionId: option.id, status: 'selected' })
    setConditioningTimerKey(`${plan.id}:conditioning:${Date.now()}`)
  }

  function finishSession() {
    const incomplete = totalSets - completedSets
    if (incomplete > 0 && !window.confirm(`Finalizar con ${incomplete} series obligatorias pendientes?`)) return
    endingRef.current = true
    const completedAt = new Date().toISOString()
    const finalActiveSeconds = Math.round(activeSecondsRef.current + (hiddenAtRef.current ? 0 : Math.max(0, (Date.now() - activeStartedAtRef.current) / 1000)))
    const completedLog = {
      ...currentLog,
      status: 'completed',
      activeSeconds: finalActiveSeconds,
      completedAt,
      updatedAt: completedAt
    }
    onComplete(completedLog, {
      id: plan.id,
      durationSeconds: finalActiveSeconds,
      completedSets,
      totalSets,
      exerciseCount: plan.lifts.length + currentLog.bodybuilding.length + (currentLog.conditioning.status === 'completed' ? 1 : 0)
    })
  }

  return (
    <main className={`screen runner-screen simplified-runner ${restTimerVisible ? 'has-rest-timer' : ''}`}>
      <header className="runner-header simplified-runner-header">
        <button onClick={onBack} aria-label="Volver al inicio">Volver</button>
        <div className="runner-session-title">
          <span className="eyebrow">{plan.id}</span>
          <h1>Semana {plan.week} · D{plan.day}</h1>
        </div>
        <div className="runner-header-actions">
          <span className="session-elapsed" aria-label="Duracion de la sesion">
            {elapsedSeconds === null ? '--:--' : formatDuration(elapsedSeconds)}
          </span>
          <span className="autosave-state" title="Guardado local automático">Guardado</span>
          <button className="primary finish-session-button" disabled={currentLog.status === 'completed'} onClick={finishSession}>
            {currentLog.status === 'completed' ? 'Completada' : 'Finalizar'}
          </button>
        </div>
      </header>

      <section className="session-progress-panel" aria-label={`${completedSets} de ${totalSets} series obligatorias completadas`}>
        <div>
          <strong>{completedSets}/{totalSets} series</strong>
          <span>{progressPct}%</span>
        </div>
        <progress max="100" value={progressPct}>{progressPct}%</progress>
        <p>{plan.deload ? 'Deload' : 'RTF'} · Los singles y el conditioning son opcionales.</p>
      </section>

      {resumeNotice && (
        <div className="resume-notice" role="status">
          <span>La app estuvo en segundo plano más de 15 minutos; ese intervalo no se ha sumado.</span>
          <button onClick={() => setResumeNotice(false)}>Entendido</button>
        </div>
      )}

      <section className="workout-exercise-list" aria-label="Ejercicios de la sesion">
        {plan.lifts.map((lift) => (
          <MainLiftCard
            key={lift.slotId}
            lift={lift}
            liftLog={currentLog.lifts[lift.slotId] || { sets: [] }}
            units={setup.units}
            rowError={rowError}
            pendingSingleCalibration={pendingSingleCalibration}
            onSetChange={updateSet}
            onToggleSet={toggleLiftSet}
            onLiftChange={updateLift}
            onApplySingleCalibration={applySingleCalibration}
            onDismissSingleCalibration={() => setPendingSingleCalibration('')}
          />
        ))}

        {currentLog.bodybuilding.map((item, exerciseIndex) => (
          <BodybuildingCard
            key={`${item.slotKey}:${item.exerciseId}`}
            item={item}
            exerciseIndex={exerciseIndex}
            units={setup.units}
            rowError={rowError}
            onChange={updateBodybuilding}
            onSetChange={updateBodybuildingSet}
            onToggleSet={toggleBodybuildingSet}
          />
        ))}

        <ConditioningCard
          options={conditioningOptions}
          selectedId={selectedConditioningId}
          log={currentLog.conditioning}
          timerKey={conditioningTimerKey}
          onSelectedIdChange={setSelectedConditioningId}
          onStart={startConditioning}
          onSkip={() => updateConditioning({ optionId: selectedConditioningId, status: 'skipped' })}
          onComplete={() => updateConditioning({ optionId: selectedConditioningId, status: 'completed' })}
          onUpdate={updateConditioning}
        />
      </section>

      {currentLog.legacyAssistance.length > 0 && (
        <details className="panel legacy-assistance">
          <summary>Asistencia guardada con la version anterior</summary>
          {currentLog.legacyAssistance.map((item, index) => (
            <p key={`${item.name}:${index}`}><strong>{item.name || item.exercise}</strong> · {item.load || '-'} · {item.sets || ''} {item.reps || ''}</p>
          ))}
        </details>
      )}

      <details className="panel session-notes-panel">
        <summary>Notas de sesion</summary>
        <label>
          Esfuerzo global de la sesión (1-10, opcional)
          <input
            inputMode="decimal"
            aria-label="Esfuerzo global de la sesión"
            value={currentLog.sessionRpe || ''}
            onChange={(event) => onLogChange({ ...currentLog, sessionRpe: event.target.value, updatedAt: new Date().toISOString() })}
          />
        </label>
        <label>
          Notas de la sesion
          <textarea
            rows="3"
            value={currentLog.notes || ''}
            onChange={(event) => onLogChange({ ...currentLog, notes: event.target.value, updatedAt: new Date().toISOString() })}
          />
        </label>
      </details>

      {currentLog.status !== 'completed' && (
        <button className="discard-session-button" onClick={() => { endingRef.current = true; onDiscard(plan.id) }}>Descartar sesion</button>
      )}

      {restTimerVisible && (
        <aside className="rest-timer-dock" aria-label="Descanso activo">
          <SessionTimer
            key={restTimer.key}
            embedded
            compact
            title="Descanso"
            context={restTimer.context}
            suggested={restTimer.suggested}
            autoStartKey={restTimer.key}
            onSkip={() => setRestTimer(null)}
          />
        </aside>
      )}
    </main>
  )
}
