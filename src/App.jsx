import { useEffect, useMemo, useState } from 'react'
import template from './data/sbsRtfTemplate.json'
import { ACCESSORY_EXERCISES, BACK_EXERCISES, bodybuildingExercise } from './data/bodybuildingCatalog.js'
import SessionTimer from './components/SessionTimer.jsx'
import WorkoutSession from './components/WorkoutSession.jsx'
import {
  ASSISTANCE_BLOCKS,
  bodybuildingForSession,
  completedAtTop,
  conditioningOptionsForSession,
  createAssistanceBlocks
} from './lib/assistanceProgram.js'
import {
  buildSessionPlan,
  createDefaultSetup,
  createEmptySessionLog,
  isSetupComplete,
  listSessions,
  nextSession,
  normalizeSessionLogForPlan,
  parseSessionId,
  projectTrainingMax,
  requiredSlotIds,
  sessionId,
  setupMissingMaxes
} from './lib/sbsRtf.js'
import { clearStoredState, exportState, loadState, parseImport, saveState } from './lib/storage.js'

const VIEWS = {
  DASHBOARD: 'dashboard',
  RUNNER: 'runner',
  PLAN: 'plan',
  ANALYTICS: 'analytics',
  SETUP: 'setup'
}

function numberInputValue(value) {
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

function Onboarding({ setup, onChange, onComplete }) {
  const missing = setupMissingMaxes(template, setup)
  const required = new Set(requiredSlotIds(template, setup))

  function setUnits(units) {
    onChange({
      ...setup,
      units,
      rounding: units === 'lb' ? 5 : 2.5
    })
  }

  function updateLift(slotId, patch) {
    onChange({
      ...setup,
      lifts: updateNested(setup.lifts, slotId, patch)
    })
  }

  function setFrequency(frequency) {
    onChange({
      ...setup,
      frequency,
      assistanceBlocks: createAssistanceBlocks(template, frequency)
    })
  }

  return (
    <main className="setup-shell">
      <section className="setup-hero">
        <p className="eyebrow">SBS Strength</p>
        <h1>Reps To Failure</h1>
        <p>Configura unidades, frecuencia y training maxes para desbloquear las cargas.</p>
      </section>

      <section className="panel" aria-labelledby="setup-basics">
        <h2 id="setup-basics">Inicio</h2>
        <div className="segmented" aria-label="Unidades">
          <button className={setup.units === 'kg' ? 'active' : ''} onClick={() => setUnits('kg')}>
            kg
          </button>
          <button className={setup.units === 'lb' ? 'active' : ''} onClick={() => setUnits('lb')}>
            lb
          </button>
        </div>
        <label>
          Redondeo
          <input
            inputMode="decimal"
            value={numberInputValue(setup.rounding)}
            onChange={(event) => onChange({ ...setup, rounding: event.target.value })}
          />
        </label>
        <label>
          Frecuencia semanal
          <select
            value={setup.frequency}
            onChange={(event) => setFrequency(Number(event.target.value))}
          >
            {template.meta.frequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}x por semana
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel" aria-labelledby="setup-lifts">
        <h2 id="setup-lifts">Lifts</h2>
        <div className="lift-setup-list">
          {template.defaults.liftSlots.map((slot) => {
            const lift = setup.lifts[slot.id]
            const isRequired = required.has(slot.id)
            return (
              <div className={`lift-setup ${isRequired ? 'required' : ''}`} key={slot.id}>
                <div>
                  <span className="muted">{slot.label}</span>
                  <strong>{isRequired ? 'Requerido' : 'Opcional en esta frecuencia'}</strong>
                </div>
                <label>
                  Ejercicio
                  <input
                    value={lift.name}
                    onChange={(event) => updateLift(slot.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Training max
                  <input
                    inputMode="decimal"
                    aria-label={`Training max ${lift.name}`}
                    value={numberInputValue(lift.trainingMax)}
                    onChange={(event) => updateLift(slot.id, { trainingMax: event.target.value })}
                  />
                </label>
                <label>
                  Single @8 %
                  <input
                    inputMode="decimal"
                    value={numberInputValue(lift.singleAt8Pct)}
                    onChange={(event) => updateLift(slot.id, { singleAt8Pct: event.target.value })}
                  />
                </label>
              </div>
            )
          })}
        </div>
      </section>

      <div className="action-dock">
        <div>
          <strong>{missing.length ? `${missing.length} maxes pendientes` : 'Setup listo'}</strong>
          <span>{setup.frequency}x semanal, redondeo {setup.rounding || '-'} {setup.units}</span>
        </div>
        <button className="primary" disabled={missing.length > 0} onClick={onComplete}>
          Entrar
        </button>
      </div>
    </main>
  )
}

function AssistanceBlocksEditor({ setup, onChange }) {
  function updateExercise(blockId, dayId, role, index, exerciseId) {
    const block = setup.assistanceBlocks[blockId]
    const day = block.days[String(dayId)]
    const nextDay = role === 'back'
      ? { ...day, backExerciseId: exerciseId }
      : {
          ...day,
          accessoryExerciseIds: day.accessoryExerciseIds.map((id, itemIndex) => itemIndex === index ? exerciseId : id)
        }
    onChange({
      ...setup,
      assistanceBlocks: {
        ...setup.assistanceBlocks,
        [blockId]: {
          ...block,
          days: { ...block.days, [String(dayId)]: nextDay }
        }
      }
    })
  }

  function regenerate() {
    onChange({ ...setup, assistanceBlocks: createAssistanceBlocks(template, setup.frequency) })
  }

  return (
    <section className="panel" aria-labelledby="assistance-blocks-title">
      <div className="section-title">
        <div>
          <span className="eyebrow">Bodybuilding</span>
          <h2 id="assistance-blocks-title">Ejercicios por bloque</h2>
        </div>
        <button onClick={regenerate}>Regenerar propuesta</button>
      </div>
      <p className="muted">Las semanas de deload conservan estos ejercicios con dos series.</p>
      <div className="assistance-block-editor">
        {ASSISTANCE_BLOCKS.map((definition) => {
          const block = setup.assistanceBlocks?.[definition.id]
          if (!block) return null
          return (
            <details key={definition.id} open={definition.id === 'block-1'}>
              <summary>{definition.label} · semanas {definition.workWeeks[0]}-{definition.workWeeks.at(-1)} + deload {definition.deloadWeek}</summary>
              <div className="block-days">
                {Object.values(block.days).map((day) => (
                  <article className="block-day" key={day.day}>
                    <h3>Dia {day.day}</h3>
                    <span className="muted">{day.focus.join(' / ')}</span>
                    <label>
                      Espalda
                      <select
                        aria-label={`${definition.label} dia ${day.day} espalda`}
                        value={day.backExerciseId}
                        onChange={(event) => updateExercise(definition.id, day.day, 'back', 0, event.target.value)}
                      >
                        {BACK_EXERCISES.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.repMin}-{exercise.repMax}</option>
                        ))}
                      </select>
                    </label>
                    {day.accessoryExerciseIds.map((exerciseId, index) => {
                      const selectedExercise = bodybuildingExercise(exerciseId)
                      return (
                        <label key={`${day.day}:${index}`}>
                          Accesorio {index + 1}
                          <select
                            aria-label={`${definition.label} dia ${day.day} accesorio ${index + 1}`}
                            value={exerciseId}
                            onChange={(event) => updateExercise(definition.id, day.day, 'accessory', index, event.target.value)}
                          >
                            {ACCESSORY_EXERCISES.map((exercise) => (
                              <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.repMin}-{exercise.repMax}</option>
                            ))}
                          </select>
                          {selectedExercise && <small>{selectedExercise.category.replaceAll('_', ' ')}</small>}
                        </label>
                      )
                    })}
                  </article>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

function AppHeader({ setup, setView, view }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">SBS Strength</p>
        <h1>{viewTitle(view)}</h1>
      </div>
      <div className="header-meta">
        <span>{setup.frequency}x</span>
        <span>{setup.units}</span>
      </div>
      <nav className="tabs" aria-label="Navegacion principal">
        <button className={view === VIEWS.DASHBOARD ? 'active' : ''} onClick={() => setView(VIEWS.DASHBOARD)}>
          Inicio
        </button>
        <button className={view === VIEWS.PLAN ? 'active' : ''} onClick={() => setView(VIEWS.PLAN)}>
          Plan
        </button>
        <button className={view === VIEWS.ANALYTICS ? 'active' : ''} onClick={() => setView(VIEWS.ANALYTICS)}>
          Analiticas
        </button>
        <button className={view === VIEWS.SETUP ? 'active' : ''} onClick={() => setView(VIEWS.SETUP)}>
          Setup
        </button>
      </nav>
    </header>
  )
}

function viewTitle(view) {
  return {
    [VIEWS.DASHBOARD]: 'Inicio',
    [VIEWS.PLAN]: 'Calendario',
    [VIEWS.ANALYTICS]: 'Analiticas',
    [VIEWS.SETUP]: 'Setup'
  }[view] || 'SBS Strength'
}

function displaySetWeight(set) {
  return set?.weight !== '' && set?.weight !== undefined ? set.weight : set?.prescribedWeight ?? ''
}

function displaySetReps(set) {
  return set?.reps !== '' && set?.reps !== undefined ? set.reps : set?.kind === 'work' ? set.targetReps : set?.reps ?? ''
}

function setRestPreset(set, lift) {
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

function setTargetText(set, units) {
  if (!set) return ''
  const weight = set.prescribedWeight ? `${set.prescribedWeight} ${units}` : 'peso libre'
  if (set.kind === 'single_at8') return `Opcional: 1 rep @8. Sugerencia ${weight}.`
  if (set.kind === 'amrap') return `AMRAP: objetivo ${set.targetReps}+ reps con ${weight}.`
  return `${set.targetReps} reps con ${weight}.`
}

function compactSetLabel(set) {
  if (set?.kind === 'single_at8') return 'Single'
  if (set?.kind === 'amrap') return 'AMRAP'
  const match = String(set?.label || '').match(/Serie\s+(\d+)/i)
  return match ? `S${match[1]}` : set?.label || 'Set'
}

function compactSetValue(set, units) {
  const weight = displaySetWeight(set)
  const reps = displaySetReps(set)
  if (set?.done) return `${weight || '-'} ${units} x ${reps || '-'}`
  if (set?.kind === 'single_at8') return `1 @8`
  if (set?.kind === 'amrap') return `${set.targetReps}+ reps`
  return `${set?.targetReps || '-'} reps`
}

function compactSetStatus(set) {
  if (set?.done) return 'Hecha'
  if (set?.optional) return 'Opcional'
  return 'Pendiente'
}

function SessionRunner({ setup, logs, selected, onLogChange, onDiscard, onBack }) {
  const plan = buildSessionPlan(template, setup, logs, selected.week, selected.day)
  const generatedBodybuilding = bodybuildingForSession(setup, plan, logs)
  const bodybuildingPrescription = logs[plan.id]?.status === 'completed' && logs[plan.id]?.bodybuilding?.length
    ? logs[plan.id].bodybuilding
    : generatedBodybuilding
  const currentLog = normalizeSessionLogForPlan(
    plan,
    logs[plan.id] || createEmptySessionLog(plan, bodybuildingPrescription),
    bodybuildingPrescription
  )
  const [activeLiftIndex, setActiveLiftIndex] = useState(0)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [restTimer, setRestTimer] = useState(null)
  const conditioningOptions = conditioningOptionsForSession(plan, bodybuildingPrescription, logs)
  const [selectedConditioningId, setSelectedConditioningId] = useState('')

  useEffect(() => {
    if (!logs[plan.id]) onLogChange(currentLog)
  }, [currentLog, logs, onLogChange, plan.id])

  useEffect(() => {
    setActiveLiftIndex(0)
    setActiveSetIndex(0)
    setRestTimer(null)
    setSelectedConditioningId(currentLog.conditioning?.optionId || '')
  }, [plan.id])

  const activeLift = plan.lifts[activeLiftIndex] || plan.lifts[0]
  const activeLiftLog = currentLog.lifts[activeLift.slotId] || { sets: [] }
  const activeSets = activeLiftLog.sets || []
  const activeSet = activeSets[activeSetIndex] || activeSets[0]
  const activeSetDone = Boolean(activeSet?.done)
  const activeSetNeedsReps = activeSet?.kind === 'amrap'
  const activeSetHasRequiredReps = !activeSetNeedsReps || Number(displaySetReps(activeSet)) > 0
  const selectedConditioning = conditioningOptions.find((option) => option.id === selectedConditioningId) || null

  useEffect(() => {
    if (activeSetIndex >= activeSets.length) setActiveSetIndex(Math.max(0, activeSets.length - 1))
  }, [activeSetIndex, activeSets.length])

  function updateLift(slotId, patch) {
    onLogChange({
      ...currentLog,
      updatedAt: new Date().toISOString(),
      status: currentLog.status || 'draft',
      lifts: updateNested(currentLog.lifts, slotId, patch)
    })
  }

  function updateSet(slotId, setId, patch) {
    const liftLog = currentLog.lifts[slotId] || { sets: [] }
    let changed = null
    const sets = liftLog.sets.map((set) => {
      if (set.id !== setId) return set
      changed = { ...set, ...patch }
      return changed
    })
    const derived = {}
    if (changed?.kind === 'single_at8' && Object.hasOwn(patch, 'weight')) {
      derived.singleAt8 = patch.weight
    }
    if (changed?.kind === 'amrap' && Object.hasOwn(patch, 'reps')) {
      derived.lastSetReps = patch.reps
    }
    updateLift(slotId, { sets, ...derived })
  }

  function noteActiveSetDone() {
    if (!activeSet || !activeSetHasRequiredReps) return
    const completedLift = activeLift
    const completedSet = activeSet
    const patch = {
      done: true,
      weight: displaySetWeight(completedSet),
      reps: displaySetReps(completedSet)
    }
    updateSet(completedLift.slotId, completedSet.id, patch)
    setRestTimer({
      key: `${plan.id}:${completedLift.slotId}:${completedSet.id}:${Date.now()}`,
      suggested: setRestPreset(completedSet, completedLift),
      context: `${completedLift.name} - ${completedSet.label}`
    })
    goNextSet()
  }

  function goPreviousSet() {
    if (activeSetIndex > 0) {
      setActiveSetIndex((value) => value - 1)
      return
    }
    if (activeLiftIndex > 0) {
      const previousLift = plan.lifts[activeLiftIndex - 1]
      const previousSets = currentLog.lifts[previousLift.slotId]?.sets || []
      setActiveLiftIndex((value) => value - 1)
      setActiveSetIndex(Math.max(0, previousSets.length - 1))
    }
  }

  function goNextSet() {
    if (activeSetIndex < activeSets.length - 1) {
      setActiveSetIndex((value) => value + 1)
      return
    }
    if (activeLiftIndex < plan.lifts.length - 1) {
      setActiveLiftIndex((value) => value + 1)
      setActiveSetIndex(0)
    }
  }

  function selectLift(index) {
    setActiveLiftIndex(index)
    setActiveSetIndex(0)
  }

  function updateBodybuilding(index, patch) {
    const bodybuilding = [...currentLog.bodybuilding]
    bodybuilding[index] = { ...bodybuilding[index], ...patch }
    onLogChange({ ...currentLog, bodybuilding, updatedAt: new Date().toISOString() })
  }

  function updateBodybuildingSet(exerciseIndex, setIndex, patch) {
    const item = currentLog.bodybuilding[exerciseIndex]
    const sets = [...item.sets]
    sets[setIndex] = { ...sets[setIndex], ...patch }
    updateBodybuilding(exerciseIndex, { sets })
  }

  function chooseConditioning(optionId) {
    setSelectedConditioningId(optionId)
    onLogChange({
      ...currentLog,
      updatedAt: new Date().toISOString(),
      conditioning: {
        ...currentLog.conditioning,
        optionId,
        status: currentLog.conditioning?.status === 'completed' ? 'completed' : 'selected'
      }
    })
  }

  function updateConditioning(patch) {
    onLogChange({
      ...currentLog,
      updatedAt: new Date().toISOString(),
      conditioning: { ...currentLog.conditioning, ...patch }
    })
  }

  function completeSession() {
    onLogChange({
      ...currentLog,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <main className="screen runner-screen">
      <header className="runner-header">
        <button onClick={onBack} aria-label="Volver al inicio">Volver</button>
        <div>
          <p className="eyebrow">Sesion en curso</p>
          <h1>Semana {plan.week} Dia {plan.day}</h1>
        </div>
      </header>

      <section className="session-summary">
        <div>
          <span className={`status-pill ${plan.deload ? 'deload' : ''}`}>
            {plan.deload ? 'Deload' : 'RTF'}
          </span>
          <h2>{plan.id}</h2>
        </div>
        <p>
          {plan.deload
            ? 'Single @8 opcional; 5 sets con la carga programada. Sin rep-out.'
            : 'Ultimo set a fallo; las reps registradas mueven el training max.'}
        </p>
      </section>

      <section className="set-flow" aria-labelledby="set-flow-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">Trabajo principal</span>
            <h2 id="set-flow-title">Serie a serie</h2>
          </div>
          <span>{activeLiftIndex + 1}/{plan.lifts.length} lifts</span>
        </div>

        <div className="lift-stepper" aria-label="Lifts de la sesion">
          {plan.lifts.map((lift, index) => {
            const liftLog = currentLog.lifts[lift.slotId] || { sets: [] }
            const done = liftLog.sets.filter((set) => set.done).length
            return (
              <button
                key={lift.slotId}
                className={index === activeLiftIndex ? 'active' : ''}
                onClick={() => selectLift(index)}
                aria-label={`Abrir lift ${lift.name}`}
              >
                <strong>{lift.name}</strong>
                <span>{done}/{liftLog.sets.length}</span>
              </button>
            )
          })}
        </div>

        <article className="set-flow-card">
          <div className="lift-card-head">
            <div>
              <span className="muted">{activeLift.label}</span>
              <h3>{activeLift.name}</h3>
            </div>
            <div className="load-badge">
              <strong>{activeLift.weight ?? '-'}</strong>
              <span>{setup.units}</span>
            </div>
          </div>

          <div className="prescription-grid">
            <div>
              <span>Trabajo</span>
              <strong>
                {plan.deload
                  ? `${activeLift.setGoal}x${activeLift.normalReps}`
                  : `${Math.max(0, activeLift.setGoal - 1)}x${activeLift.normalReps} + 1x${activeLift.repOutTarget}+`}
              </strong>
            </div>
            <div>
              <span>Intensidad</span>
              <strong>{Math.round(activeLift.intensity * 1000) / 10}%</strong>
            </div>
            <div>
              <span>TM</span>
              <strong>{activeLift.projection.trainingMax ?? '-'}</strong>
            </div>
            <div>
              <span>Fuente</span>
              <strong>{sourceLabel(activeLift.projection.source)}</strong>
            </div>
          </div>

          {activeSet && (
            <section className={`focused-set ${activeSetDone ? 'done' : ''}`} aria-labelledby="current-set-title">
              <div>
                <span className="eyebrow">Serie actual</span>
                <h3 id="current-set-title">
                  {activeSet.label}
                  {activeSet.optional ? ' opcional' : ''}
                </h3>
                <p>{setTargetText(activeSet, setup.units)}</p>
              </div>
              <div className="inline-fields">
                <label>
                  Peso
                  <input
                    inputMode="decimal"
                    aria-label={`Peso serie actual ${activeLift.name}`}
                    value={numberInputValue(displaySetWeight(activeSet))}
                    onChange={(event) => updateSet(activeLift.slotId, activeSet.id, { weight: event.target.value })}
                  />
                </label>
                <label>
                  Reps
                  <input
                    inputMode="numeric"
                    aria-label={`Reps serie actual ${activeLift.name}`}
                    value={numberInputValue(displaySetReps(activeSet))}
                    onChange={(event) => updateSet(activeLift.slotId, activeSet.id, { reps: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Notas de serie
                <input
                  value={activeSet.notes || ''}
                  onChange={(event) => updateSet(activeLift.slotId, activeSet.id, { notes: event.target.value })}
                />
              </label>
              <div className="set-actions">
                <button onClick={goPreviousSet} disabled={activeLiftIndex === 0 && activeSetIndex === 0}>
                  Anterior
                </button>
                <button className="primary" disabled={!activeSetHasRequiredReps} onClick={noteActiveSetDone}>
                  {activeSetDone ? 'Serie anotada' : 'Anotar serie'}
                </button>
                {activeSet.optional && (
                  <button onClick={goNextSet}>
                    Saltar
                  </button>
                )}
                <button onClick={goNextSet} disabled={activeLiftIndex === plan.lifts.length - 1 && activeSetIndex === activeSets.length - 1}>
                  Siguiente serie
                </button>
              </div>
            </section>
          )}

          <SessionTimer
            key={plan.id}
            embedded
            title="Descanso"
            context={restTimer?.context || `${activeLift.name} - ${activeSet?.label || ''}`}
            suggested={restTimer?.suggested || setRestPreset(activeSet, activeLift)}
            autoStartKey={restTimer?.key}
          />

          <div className="set-chip-list" aria-label={`Series registradas ${activeLift.name}`}>
            {activeSets.map((set, index) => (
              <button
                className={`set-chip ${index === activeSetIndex ? 'active' : ''} ${set.done ? 'done' : ''} ${set.optional ? 'optional' : ''}`}
                key={set.id}
                onClick={() => setActiveSetIndex(index)}
                aria-label={`Editar ${set.label} ${activeLift.name}, ${compactSetStatus(set).toLowerCase()}, ${compactSetValue(set, setup.units)}`}
              >
                <span>{compactSetLabel(set)}</span>
                <strong>{compactSetValue(set, setup.units)}</strong>
                <small>{compactSetStatus(set)}</small>
              </button>
            ))}
          </div>

          <div className="inline-fields">
            <label>
              Video
              <input
                value={activeLiftLog.video || ''}
                onChange={(event) => updateLift(activeLift.slotId, { video: event.target.value })}
              />
            </label>
            <label>
              Notas del lift
              <textarea
                rows="2"
                value={activeLiftLog.notes || ''}
                onChange={(event) => updateLift(activeLift.slotId, { notes: event.target.value })}
              />
            </label>
          </div>
          {activeLift.projection.delta !== null && (
            <p className="delta-note">
              Ajuste previo: {activeLift.projection.delta > 0 ? '+' : ''}
              {activeLift.projection.delta} reps, {Math.round(activeLift.projection.adjustment * 1000) / 10}%.
            </p>
          )}
        </article>
      </section>

      <section className="panel bodybuilding-card" aria-labelledby="bodybuilding-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">Bloque fijo y progresable</span>
            <h2 id="bodybuilding-title">Asistencia bodybuilding</h2>
          </div>
          <span className={`status-pill ${plan.deload ? 'deload' : ''}`}>
            {plan.deload ? 'Deload: 2 series' : `${currentLog.bodybuilding.length} ejercicios`}
          </span>
        </div>
        <p className="muted">Completa el techo del rango en todas las series para subir carga la proxima vez.</p>
        <div className="bodybuilding-list">
          {currentLog.bodybuilding.map((item, exerciseIndex) => (
            <article className="bodybuilding-exercise" key={`${item.slotKey}:${item.exerciseId}`}>
              <div className="section-title">
                <div>
                  <span className="eyebrow">{item.role === 'back' ? 'Espalda' : item.category.replaceAll('_', ' ')}</span>
                  <h3>{item.name}</h3>
                  <p>{item.targetSets}x{item.repMin}-{item.repMax}</p>
                </div>
                <span className={`progression-badge ${item.progressionAction}`}>
                  {item.deload
                    ? 'Sin progresion'
                    : item.progressionAction === 'increase'
                      ? 'Subir carga'
                      : item.progressionAction === 'repeat'
                        ? 'Repetir carga'
                        : 'Elige carga'}
                </span>
              </div>
              {item.previousSessionId && (
                <p className="muted">Ultima aparicion: {item.previousSessionId} · {item.previousLoad || '-'} {setup.units}</p>
              )}
              <label>
                {item.loadMode === 'added_weight' ? 'Lastre' : 'Carga'}
                <input
                  inputMode="decimal"
                  aria-label={`Carga ${item.name}`}
                  value={item.load ?? ''}
                  onChange={(event) => updateBodybuilding(exerciseIndex, { load: event.target.value })}
                />
              </label>
              <div className="bodybuilding-sets">
                {item.sets.map((set, setIndex) => (
                  <label className={set.done ? 'done' : ''} key={set.id}>
                    <span>S{setIndex + 1}</span>
                    <input
                      inputMode="numeric"
                      aria-label={`Reps serie ${setIndex + 1} ${item.name}`}
                      value={set.reps}
                      onChange={(event) => updateBodybuildingSet(exerciseIndex, setIndex, { reps: event.target.value })}
                    />
                    <input
                      type="checkbox"
                      aria-label={`Completar serie ${setIndex + 1} ${item.name}`}
                      checked={set.done}
                      onChange={(event) => updateBodybuildingSet(exerciseIndex, setIndex, { done: event.target.checked })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Notas
                <input value={item.notes || ''} onChange={(event) => updateBodybuilding(exerciseIndex, { notes: event.target.value })} />
              </label>
            </article>
          ))}
        </div>
      </section>

      <section className="panel conditioning-card" aria-labelledby="conditioning-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">Brian Alsruhe · opcional</span>
            <h2 id="conditioning-title">Conditioning que cubre huecos</h2>
          </div>
          <span className="status-pill">Sin cap de esfuerzo</span>
        </div>
        <div className="conditioning-options">
          {conditioningOptions.map((option) => (
            <button
              className={`template-option ${option.id === selectedConditioningId ? 'active' : ''}`}
              key={option.id}
              onClick={() => chooseConditioning(option.id)}
            >
              <strong>{option.title}</strong>
              <span>{option.shortPrescription}</span>
              <small>{option.matchReason} · {option.sourceLabel}</small>
            </button>
          ))}
        </div>
        {!selectedConditioning && <p className="muted">Elige una opcion si quieres hacer conditioning; puedes guardar la sesion sin seleccionarlo.</p>}
        {selectedConditioning && (
          <>
            <details className="source-raw">
              <summary>Prescripcion completa</summary>
              <pre>{selectedConditioning.prescription}</pre>
            </details>
            <SessionTimer
              embedded
              title="Conditioning"
              context={selectedConditioning.title}
              suggested={selectedConditioning.timerPreset}
            />
            <div className="inline-fields">
              <label>
                Score / resultado
                <input
                  aria-label="Resultado conditioning"
                  value={currentLog.conditioning?.score || ''}
                  onChange={(event) => updateConditioning({ score: event.target.value })}
                />
              </label>
              <label>
                Carga
                <input
                  inputMode="decimal"
                  aria-label="Carga conditioning"
                  value={currentLog.conditioning?.load || ''}
                  onChange={(event) => updateConditioning({ load: event.target.value })}
                />
              </label>
            </div>
            <label>
              Notas de conditioning
              <textarea
                rows="2"
                value={currentLog.conditioning?.notes || ''}
                onChange={(event) => updateConditioning({ notes: event.target.value })}
              />
            </label>
            <div className="dock-actions">
              <button onClick={() => updateConditioning({ status: 'skipped' })}>Omitido</button>
              <button className="primary" onClick={() => updateConditioning({ status: 'completed' })}>Conditioning hecho</button>
            </div>
          </>
        )}
      </section>

      {currentLog.legacyAssistance.length > 0 && (
        <details className="panel legacy-assistance">
          <summary>Asistencia guardada con la version anterior</summary>
          {currentLog.legacyAssistance.map((item, index) => (
            <p key={`${item.name}:${index}`}><strong>{item.name || item.exercise}</strong> · {item.load || '-'} · {item.sets || ''} {item.reps || ''}</p>
          ))}
        </details>
      )}

      <label className="panel">
        Notas de sesion
        <textarea
          rows="3"
          value={currentLog.notes || ''}
          onChange={(event) => onLogChange({ ...currentLog, notes: event.target.value, updatedAt: new Date().toISOString() })}
        />
      </label>

      <section className="panel session-final-actions" aria-labelledby="session-final-title">
        <div>
          <span className="eyebrow">Fin de sesion</span>
          <h2 id="session-final-title">
            {currentLog.status === 'completed' ? 'Sesion completada' : 'Borrador autosavado'}
          </h2>
          <p className="muted">{plan.lifts.length} lifts en esta sesion.</p>
        </div>
        <div className="dock-actions">
          {currentLog.status !== 'completed' && (
            <button className="danger" onClick={() => onDiscard(plan.id)}>
              Descartar
            </button>
          )}
          <button className="primary" onClick={completeSession}>
            {currentLog.status === 'completed' ? 'Sesion guardada' : 'Guardar sesion'}
          </button>
        </div>
      </section>
    </main>
  )
}

function DashboardView({ setup, logs, selected, completionSummary, onDismissSummary, onOpen, onGoPlan, onGoAnalytics }) {
  const draft = Object.values(logs).find((log) => log.status !== 'completed')
  const next = nextSession(template, setup, logs)
  const target = draft ? parseSessionId(draft.id) : next || selected
  const plan = buildSessionPlan(template, setup, logs, target.week, target.day)
  const bodybuilding = bodybuildingForSession(setup, plan, logs)
  const conditioning = conditioningOptionsForSession(plan, bodybuilding, logs)[0]
  const completed = Object.values(logs).filter((log) => log.status === 'completed').length
  const total = listSessions(template, setup).length

  return (
    <main className="screen dashboard-screen">
      {completionSummary && (
        <section className="completion-summary-card" aria-labelledby="completion-summary-title">
          <div className="section-title">
            <div>
              <span className="eyebrow">Sesion completada</span>
              <h2 id="completion-summary-title">{completionSummary.id}</h2>
            </div>
            <button aria-label="Cerrar resumen de sesion" onClick={onDismissSummary}>Cerrar</button>
          </div>
          <div className="completion-summary-stats">
            <div><span>Duracion</span><strong>{formatSummaryDuration(completionSummary.durationSeconds)}</strong></div>
            <div><span>Series</span><strong>{completionSummary.completedSets}/{completionSummary.totalSets}</strong></div>
            <div><span>Ejercicios</span><strong>{completionSummary.exerciseCount}</strong></div>
          </div>
        </section>
      )}
      <section className="current-session-card" aria-labelledby="current-session-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">{draft ? 'Sesion en curso' : 'Proxima sesion'}</span>
            <h2 id="current-session-title">Semana {plan.week} Dia {plan.day}</h2>
          </div>
          <span className={`status-pill ${plan.deload ? 'deload' : ''}`}>{plan.deload ? 'Deload' : 'RTF'}</span>
        </div>
        <div className="active-lift-preview">
          {plan.lifts.slice(0, 4).map((lift) => (
            <div key={lift.slotId}>
              <span>{lift.name}</span>
              <strong>{lift.weight ?? '-'} {setup.units}</strong>
            </div>
          ))}
        </div>
        <button className="primary block" onClick={() => onOpen(plan)}>
          {draft ? 'Continuar sesion' : 'Abrir sesion'}
        </button>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Progreso</span>
          <h2>{completed}/{total} sesiones</h2>
          <p className="muted">{Math.round((completed / total) * 100)}% del ciclo completado.</p>
          <button onClick={onGoAnalytics}>Ver analiticas</button>
        </article>
        <article className="panel">
          <span className="eyebrow">Asistencia + conditioning</span>
          <h2>{bodybuilding.map((item) => item.name).join(' · ')}</h2>
          <p>{conditioning ? `Opcional: ${conditioning.title}` : 'Sin conditioning seleccionado'}</p>
          <button onClick={onGoPlan}>Abrir calendario</button>
        </article>
      </section>
    </main>
  )
}

function formatSummaryDuration(seconds) {
  if (seconds === null || seconds === undefined) return 'Sin datos'
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
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

function PlanView({ setup, logs, onSelect }) {
  const sessions = listSessions(template, setup)
  const weeks = Array.from({ length: template.meta.weeks }, (_, index) => index + 1)
  return (
    <main className="screen">
      {weeks.map((week) => (
        <section className="panel week-panel" key={week} aria-labelledby={`week-${week}`}>
          <h2 id={`week-${week}`}>Semana {week}</h2>
          <div className="day-grid">
            {sessions
              .filter((session) => session.week === week)
              .map((session) => (
                <button
                  key={session.id}
                  className={`day-button ${logs[session.id]?.status === 'completed' ? 'done' : ''}`}
                  onClick={() => onSelect(session)}
                  aria-label={`Abrir ${session.id}`}
                >
                  <strong>D{session.day}</strong>
                  <span>{logs[session.id]?.status === 'completed' ? 'Hecha' : session.deload ? 'Deload' : 'RTF'}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </main>
  )
}

function AnalyticsView({ setup, logs }) {
  const sessions = listSessions(template, setup)
  const completedLogs = Object.values(logs).filter((log) => log.status === 'completed')
  const next = nextSession(template, setup, logs) || sessions[0]
  const slotIds = requiredSlotIds(template, setup)
  const projected = slotIds.map((slotId) => {
    const occurrence = sessions.find((session) => {
      if (session.week < next.week || (session.week === next.week && session.day < next.day)) return false
      const dayLayout = template.layouts[String(setup.frequency)].days.find((day) => day.day === session.day)
      return dayLayout?.lifts.some((lift) => lift.slotId === slotId)
    }) || next
    return {
      slotId,
      name: setup.lifts[slotId].name,
      occurrence,
      projection: projectTrainingMax(template, setup, logs, slotId, occurrence.week, occurrence.day)
    }
  })
  const bodybuildingSessions = Object.values(logs).filter((log) => log.bodybuilding?.length).length
  const readyToIncrease = Object.values(logs).flatMap((log) => log.bodybuilding || []).filter(completedAtTop).length
  const conditioningCompleted = Object.values(logs).filter((log) => log.conditioning?.status === 'completed').length
  const completionPct = Math.round((completedLogs.length / sessions.length) * 100)

  return (
    <main className="screen">
      <section className="analytics-hero">
        <div>
          <span className="eyebrow">Analiticas</span>
          <h2>{completionPct}% completado</h2>
          <p>{completedLogs.length} de {sessions.length} sesiones guardadas.</p>
        </div>
        <div>
          <span className="eyebrow">Bodybuilding</span>
          <h2>{readyToIncrease}</h2>
          <p>ejercicios listos para subir carga · {conditioningCompleted} conditionings hechos.</p>
        </div>
      </section>

      <section className="panel">
        <h2>Training max proyectado</h2>
        <div className="analytics-list">
          {projected.map((item) => (
            <div className="analytics-row" key={item.slotId}>
              <div>
                <strong>{item.name}</strong>
                <span>Proxima aparicion: {item.occurrence.id}</span>
              </div>
              <div>
                <strong>{item.projection.trainingMax ?? '-'}</strong>
                <span>{sourceLabel(item.projection.source)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Ultimas sesiones</h2>
        <div className="analytics-list">
          {completedLogs.slice(-6).reverse().map((log) => (
            <div className="analytics-row" key={log.id}>
              <div>
                <strong>{log.id}</strong>
                <span>{log.bodybuilding?.length ? `${log.bodybuilding.length} accesorios` : 'Sin asistencia nueva'}</span>
              </div>
              <div>
                <strong>{Object.keys(log.lifts || {}).length}</strong>
                <span>lifts</span>
              </div>
            </div>
          ))}
          {!completedLogs.length && <p className="muted">Todavia no hay sesiones completadas.</p>}
        </div>
        {bodybuildingSessions > 0 && <p className="muted">{bodybuildingSessions} sesiones incluyen registro bodybuilding.</p>}
      </section>
    </main>
  )
}

function AdvancedView({ setup, onChange, embedded = false }) {
  const [targetSlot, setTargetSlot] = useState(requiredSlotIds(template, setup)[0])
  const [overrideWeek, setOverrideWeek] = useState(1)
  const slotIds = requiredSlotIds(template, setup)

  function updateAdjustment(slotId, key, value) {
    onChange({
      ...setup,
      adjustments: updateNested(setup.adjustments, slotId, { [key]: value === '' ? '' : Number(value) })
    })
  }

  function updateIntensity(slotId, week, value) {
    onChange({
      ...setup,
      intensityByWeek: updateNested(setup.intensityByWeek, slotId, { [String(week)]: value === '' ? '' : Number(value) })
    })
  }

  function updateTarget(kind, slotId, intensity, value) {
    const tableName = kind === 'normal' ? 'normalSetReps' : 'repOutTargets'
    onChange({
      ...setup,
      [tableName]: updateNested(setup[tableName], slotId, { [String(intensity)]: value === '' ? '' : Number(value) })
    })
  }

  function updateOverride(slotId, value) {
    const key = `${overrideWeek}:${slotId}`
    const next = { ...setup.tmOverrides }
    if (value === '') delete next[key]
    else next[key] = Number(value)
    onChange({ ...setup, tmOverrides: next })
  }

  const Wrapper = embedded ? 'div' : 'main'

  return (
    <Wrapper className={embedded ? 'embedded-section' : 'screen'}>
      <section className="panel">
        <h2>Ajustes RTF</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lift</th>
                <th>Sets</th>
                <th>-2+</th>
                <th>-1</th>
                <th>0</th>
                <th>+1</th>
                <th>+2</th>
                <th>+3</th>
                <th>+4</th>
                <th>+5</th>
              </tr>
            </thead>
            <tbody>
              {slotIds.map((slotId) => {
                const adj = setup.adjustments[slotId]
                return (
                  <tr key={slotId}>
                    <th>{setup.lifts[slotId].name}</th>
                    {[
                      'sets',
                      'belowBy2Plus',
                      'belowBy1',
                      'hit',
                      'beatBy1',
                      'beatBy2',
                      'beatBy3',
                      'beatBy4',
                      'beatBy5Plus'
                    ].map((key) => (
                      <td key={key}>
                        <input
                          inputMode="decimal"
                          aria-label={`${key} ${setup.lifts[slotId].name}`}
                          value={numberInputValue(adj[key])}
                          onChange={(event) => updateAdjustment(slotId, key, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Intensidad semanal</h2>
        {slotIds.map((slotId) => (
          <details key={slotId}>
            <summary>{setup.lifts[slotId].name}</summary>
            <div className="week-input-grid">
              {Array.from({ length: 21 }, (_, index) => index + 1).map((week) => (
                <label key={week}>
                  S{week}
                  <input
                    inputMode="decimal"
                    value={numberInputValue(setup.intensityByWeek[slotId]?.[String(week)])}
                    onChange={(event) => updateIntensity(slotId, week, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section className="panel">
        <h2>Targets por intensidad</h2>
        <label>
          Lift
          <select value={targetSlot} onChange={(event) => setTargetSlot(event.target.value)}>
            {slotIds.map((slotId) => (
              <option key={slotId} value={slotId}>
                {setup.lifts[slotId].name}
              </option>
            ))}
          </select>
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>%</th>
                <th>Normal</th>
                <th>Rep-out</th>
              </tr>
            </thead>
            <tbody>
              {template.meta.targetIntensities.map((intensity) => (
                <tr key={intensity}>
                  <th>{Math.round(intensity * 1000) / 10}%</th>
                  <td>
                    <input
                      inputMode="numeric"
                      value={numberInputValue(setup.normalSetReps[targetSlot]?.[String(intensity)])}
                      onChange={(event) => updateTarget('normal', targetSlot, intensity, event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      inputMode="numeric"
                      value={numberInputValue(setup.repOutTargets[targetSlot]?.[String(intensity)])}
                      onChange={(event) => updateTarget('repout', targetSlot, intensity, event.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>TM manual</h2>
        <label>
          Semana
          <input
            inputMode="numeric"
            min="1"
            max="21"
            value={overrideWeek}
            onChange={(event) => setOverrideWeek(Math.min(21, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <div className="lift-setup-list">
          {slotIds.map((slotId) => (
            <label key={slotId}>
              {setup.lifts[slotId].name}
              <input
                inputMode="decimal"
                aria-label={`TM manual ${setup.lifts[slotId].name}`}
                value={numberInputValue(setup.tmOverrides[`${overrideWeek}:${slotId}`])}
                onChange={(event) => updateOverride(slotId, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>
    </Wrapper>
  )
}

function DataView({ state, onImport, onReset, embedded = false }) {
  const [message, setMessage] = useState('')

  function downloadExport() {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sbs-strength-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      onImport(parseImport(template, text))
      setMessage('Importacion completada')
    } catch (error) {
      setMessage(error.message || 'No se pudo importar')
    } finally {
      event.target.value = ''
    }
  }

  const Wrapper = embedded ? 'div' : 'main'

  return (
    <Wrapper className={embedded ? 'embedded-section' : 'screen'}>
      <section className="panel">
        <h2>Datos locales</h2>
        <div className="data-actions">
          <button className="primary" onClick={downloadExport}>
            Exportar JSON
          </button>
          <label className="file-button">
            Importar JSON
            <input type="file" accept="application/json,.json" onChange={importFile} />
          </label>
          <button className="danger" onClick={onReset}>
            Reset local
          </button>
        </div>
        {message && <p className="notice">{message}</p>}
      </section>
    </Wrapper>
  )
}

function SetupView({ setup, onChange, state, onImport, onReset }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const missing = setupMissingMaxes(template, setup)

  function updateLift(slotId, patch) {
    onChange({
      ...setup,
      lifts: updateNested(setup.lifts, slotId, patch)
    })
  }

  function setUnits(units) {
    onChange({
      ...setup,
      units,
      rounding: units === 'lb' ? 5 : 2.5
    })
  }

  function setFrequency(frequency) {
    onChange({
      ...setup,
      frequency,
      assistanceBlocks: createAssistanceBlocks(template, frequency)
    })
  }

  return (
    <main className="screen">
      <section className="panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">Setup</span>
            <h2>Parametros principales</h2>
          </div>
          <span className="status-pill">{missing.length ? `${missing.length} pendientes` : 'Listo'}</span>
        </div>
        <div className="segmented" aria-label="Unidades">
          <button className={setup.units === 'kg' ? 'active' : ''} onClick={() => setUnits('kg')}>kg</button>
          <button className={setup.units === 'lb' ? 'active' : ''} onClick={() => setUnits('lb')}>lb</button>
        </div>
        <div className="inline-fields">
          <label>
            Redondeo
            <input
              inputMode="decimal"
              value={numberInputValue(setup.rounding)}
              onChange={(event) => onChange({ ...setup, rounding: event.target.value })}
            />
          </label>
          <label>
            Frecuencia
            <select value={setup.frequency} onChange={(event) => setFrequency(Number(event.target.value))}>
              {template.meta.frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>{frequency}x por semana</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <AssistanceBlocksEditor setup={setup} onChange={onChange} />

      <section className="panel">
        <h2>Lifts y maxes</h2>
        <div className="lift-setup-list">
          {template.defaults.liftSlots.map((slot) => {
            const lift = setup.lifts[slot.id]
            return (
              <div className="lift-setup" key={slot.id}>
                <div>
                  <span className="muted">{slot.label}</span>
                  <strong>{slot.kind === 'main' ? 'Main lift' : 'Auxiliary'}</strong>
                </div>
                <label>
                  Ejercicio
                  <input value={lift.name} onChange={(event) => updateLift(slot.id, { name: event.target.value })} />
                </label>
                <label>
                  Training max
                  <input
                    inputMode="decimal"
                    aria-label={`Training max ${lift.name}`}
                    value={numberInputValue(lift.trainingMax)}
                    onChange={(event) => updateLift(slot.id, { trainingMax: event.target.value })}
                  />
                </label>
                <label>
                  Single @8 %
                  <input
                    inputMode="decimal"
                    value={numberInputValue(lift.singleAt8Pct)}
                    onChange={(event) => updateLift(slot.id, { singleAt8Pct: event.target.value })}
                  />
                </label>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Avanzado</h2>
          <button onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? 'Ocultar' : 'Editar tablas'}
          </button>
        </div>
      </section>
      {showAdvanced && <AdvancedView setup={setup} onChange={onChange} embedded />}
      <DataView state={state} onImport={onImport} onReset={onReset} embedded />
    </main>
  )
}

export default function App() {
  const [state, setState] = useState(() => loadState(template))
  const [view, setView] = useState(VIEWS.DASHBOARD)
  const [completionSummary, setCompletionSummary] = useState(null)

  const setup = state.setup || createDefaultSetup(template)
  const setupComplete = isSetupComplete(template, setup)
  const sessions = useMemo(() => listSessions(template, setup), [setup])
  const selected = useMemo(() => {
    const selectedParsed = parseSessionId(state.selectedSessionId)
    if (selectedParsed) return selectedParsed
    const next = nextSession(template, setup, state.logs)
    return next || sessions[0]
  }, [sessions, setup, state.logs, state.selectedSessionId])

  useEffect(() => {
    saveState(state)
  }, [state])

  function updateSetup(nextSetup) {
    setState((current) => ({ ...current, setup: nextSetup }))
  }

  function completeSetup() {
    setState((current) => ({
      ...current,
      setup: { ...setup, completedAt: new Date().toISOString() },
      selectedSessionId: sessionId(1, 1)
    }))
    setView(VIEWS.DASHBOARD)
  }

  function selectSession(session) {
    setCompletionSummary(null)
    setState((current) => ({ ...current, selectedSessionId: session.id }))
    setView(VIEWS.RUNNER)
  }

  function updateLog(log) {
    setState((current) => ({
      ...current,
      logs: {
        ...current.logs,
        [log.id]: log
      }
    }))
  }

  function completeLog(log, summary) {
    setState((current) => {
      const logs = { ...current.logs, [log.id]: log }
      const next = nextSession(template, setup, logs)
      return {
        ...current,
        logs,
        selectedSessionId: next?.id || current.selectedSessionId
      }
    })
    setCompletionSummary(summary)
    setView(VIEWS.DASHBOARD)
  }

  function discardLog(logId) {
    if (!window.confirm('Descartar la sesion en curso? Se perdera el borrador local.')) return
    setState((current) => {
      const logs = { ...current.logs }
      delete logs[logId]
      const next = nextSession(template, setup, logs)
      return {
        ...current,
        logs,
        selectedSessionId: next?.id || current.selectedSessionId
      }
    })
    setView(VIEWS.DASHBOARD)
  }

  function resetLocal() {
    if (!window.confirm('Resetear datos locales de SBS Strength?')) return
    clearStoredState()
    setState(loadState(template))
    setView(VIEWS.DASHBOARD)
  }

  if (!setupComplete) {
    return <Onboarding setup={setup} onChange={updateSetup} onComplete={completeSetup} />
  }

  return (
    <>
      {view !== VIEWS.RUNNER && <AppHeader setup={setup} view={view} setView={setView} />}
      {view === VIEWS.DASHBOARD && (
        <DashboardView
          setup={setup}
          logs={state.logs}
          selected={selected}
          completionSummary={completionSummary}
          onDismissSummary={() => setCompletionSummary(null)}
          onOpen={selectSession}
          onGoPlan={() => setView(VIEWS.PLAN)}
          onGoAnalytics={() => setView(VIEWS.ANALYTICS)}
        />
      )}
      {view === VIEWS.RUNNER && (
        <WorkoutSession
          setup={setup}
          logs={state.logs}
          selected={selected}
          onLogChange={updateLog}
          onDiscard={discardLog}
          onBack={() => setView(VIEWS.DASHBOARD)}
          onComplete={completeLog}
        />
      )}
      {view === VIEWS.PLAN && <PlanView setup={setup} logs={state.logs} onSelect={selectSession} />}
      {view === VIEWS.ANALYTICS && <AnalyticsView setup={setup} logs={state.logs} />}
      {view === VIEWS.SETUP && (
        <SetupView
          setup={setup}
          onChange={updateSetup}
          state={state}
          onImport={(nextState) => setState(nextState)}
          onReset={resetLocal}
        />
      )}
    </>
  )
}
