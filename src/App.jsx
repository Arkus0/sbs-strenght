import { useEffect, useMemo, useState } from 'react'
import template from './data/sbsRtfTemplate.json'
import { specimenTemplateForSession } from './data/specimenAssistance.js'
import SessionTimer from './components/SessionTimer.jsx'
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
            onChange={(event) => onChange({ ...setup, frequency: Number(event.target.value) })}
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

function SessionRunner({ setup, logs, selected, onLogChange, onDiscard, onBack }) {
  const plan = buildSessionPlan(template, setup, logs, selected.week, selected.day)
  const currentLog = normalizeSessionLogForPlan(plan, logs[plan.id] || createEmptySessionLog(plan))
  const [activeLiftIndex, setActiveLiftIndex] = useState(0)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const specimen = useMemo(
    () => specimenTemplateForSession({
      week: plan.week,
      day: plan.day,
      frequency: plan.frequency,
      deload: plan.deload,
      lifts: plan.lifts
    }),
    [plan.day, plan.deload, plan.frequency, plan.lifts, plan.week]
  )
  const [selectedUpperBackId, setSelectedUpperBackId] = useState('')
  const [selectedAssistanceId, setSelectedAssistanceId] = useState('')
  const latestAccessory = useMemo(() => {
    const entries = Object.values(logs)
      .filter((log) => log.id !== plan.id)
      .sort((a, b) => {
        if (a.week !== b.week) return b.week - a.week
        return b.day - a.day
      })
    return entries.find((log) => log.upperBack?.exercise || log.accessories?.some((item) => item.name))
  }, [logs, plan.id])

  useEffect(() => {
    if (!logs[plan.id]) onLogChange(currentLog)
  }, [currentLog, logs, onLogChange, plan.id])

  useEffect(() => {
    setActiveLiftIndex(0)
    setActiveSetIndex(0)
    setSelectedUpperBackId(currentLog.specimenSelection?.upperBackId || specimen.upperBack.id)
    setSelectedAssistanceId(currentLog.specimenSelection?.assistanceId || specimen.assistance.id)
  }, [plan.id])

  const activeLift = plan.lifts[activeLiftIndex] || plan.lifts[0]
  const activeLiftLog = currentLog.lifts[activeLift.slotId] || { sets: [] }
  const activeSets = activeLiftLog.sets || []
  const activeSet = activeSets[activeSetIndex] || activeSets[0]
  const activeSetDone = Boolean(activeSet?.done)
  const activeSetNeedsReps = activeSet?.kind === 'amrap'
  const activeSetHasRequiredReps = !activeSetNeedsReps || Number(displaySetReps(activeSet)) > 0
  const selectedUpperBack = specimen.upperBackOptions.find((option) => option.id === selectedUpperBackId) || specimen.upperBack
  const selectedAssistance = specimen.assistanceOptions.find((option) => option.id === selectedAssistanceId) || specimen.assistance

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
    const patch = {
      done: true,
      weight: displaySetWeight(activeSet),
      reps: displaySetReps(activeSet)
    }
    updateSet(activeLift.slotId, activeSet.id, patch)
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

  function updateAccessory(index, patch) {
    const accessories = [...currentLog.accessories]
    accessories[index] = { ...accessories[index], ...patch }
    onLogChange({ ...currentLog, accessories, updatedAt: new Date().toISOString() })
  }

  function completeSession() {
    onLogChange({
      ...currentLog,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  function applySpecimenTemplate() {
    const accessories = [...currentLog.accessories]
    accessories[0] = {
      ...(accessories[0] || {}),
      name: selectedAssistance.title,
      sets: selectedAssistance.timer?.rounds ? `${selectedAssistance.timer.rounds}` : accessories[0]?.sets || '',
      reps: selectedAssistance.shortPrescription,
      notes: `${selectedAssistance.prescription}\n\n${selectedAssistance.notes}`
    }
    onLogChange({
      ...currentLog,
      updatedAt: new Date().toISOString(),
      specimenAccepted: true,
      specimenSelection: {
        upperBackId: selectedUpperBack.id,
        assistanceId: selectedAssistance.id
      },
      upperBack: {
        ...currentLog.upperBack,
        exercise: selectedUpperBack.title,
        reps: selectedUpperBack.shortPrescription,
        notes: `${selectedUpperBack.prescription}\n\n${selectedUpperBack.notes}`
      },
      accessories
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
            key={`${plan.id}:${activeLift.slotId}:${activeSet?.id || 'set'}`}
            embedded
            title="Descanso"
            context={`${activeLift.name} - ${activeSet?.label || ''}`}
            suggested={setRestPreset(activeSet, activeLift)}
          />

          <div className="set-log-table" aria-label={`Series registradas ${activeLift.name}`}>
            {activeSets.map((set, index) => (
              <div className={`set-row ${index === activeSetIndex ? 'active' : ''} ${set.done ? 'done' : ''}`} key={set.id}>
                <button onClick={() => setActiveSetIndex(index)} aria-label={`Editar ${set.label} ${activeLift.name}`}>
                  <strong>{set.label}</strong>
                  <span>{set.optional ? 'Opcional' : set.kind === 'amrap' ? `${set.targetReps}+` : `${set.targetReps} reps`}</span>
                </button>
                <label>
                  Peso
                  <input
                    inputMode="decimal"
                    aria-label={`Peso ${set.label} ${activeLift.name}`}
                    value={numberInputValue(displaySetWeight(set))}
                    onChange={(event) => updateSet(activeLift.slotId, set.id, { weight: event.target.value })}
                  />
                </label>
                <label>
                  Reps
                  <input
                    inputMode="numeric"
                    aria-label={`Reps ${set.label} ${activeLift.name}`}
                    value={numberInputValue(displaySetReps(set))}
                    onChange={(event) => updateSet(activeLift.slotId, set.id, { reps: event.target.value })}
                  />
                </label>
                <label className="done-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(set.done)}
                    onChange={(event) => updateSet(activeLift.slotId, set.id, { done: event.target.checked })}
                  />
                  Hecha
                </label>
              </div>
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

      <section className="specimen-card" aria-labelledby="specimen-title">
        <div className="section-title">
          <div>
            <span className="eyebrow">Template Brian Alsruhe</span>
            <h2 id="specimen-title">{specimen.title}</h2>
          </div>
          <span className="status-pill">Dosis {specimen.density}</span>
        </div>
        <div className="template-picker">
          <div className="template-column">
            <span className="muted">Upper back</span>
            {specimen.upperBackOptions.map((option) => (
              <button
                className={`template-option ${option.id === selectedUpperBack.id ? 'active' : ''}`}
                key={option.id}
                onClick={() => setSelectedUpperBackId(option.id)}
              >
                <strong>{option.title}</strong>
                <span>{option.shortPrescription}</span>
                <small>{option.sourceLabel}</small>
              </button>
            ))}
          </div>
          <div className="template-column">
            <span className="muted">Asistencia / conditioning</span>
            {specimen.assistanceOptions.map((option) => (
              <button
                className={`template-option ${option.id === selectedAssistance.id ? 'active' : ''}`}
                key={option.id}
                onClick={() => setSelectedAssistanceId(option.id)}
              >
                <strong>{option.title}</strong>
                <span>{option.shortPrescription}</span>
                <small>{option.sourceLabel}</small>
              </button>
            ))}
          </div>
        </div>
        <details className="source-raw">
          <summary>Prescripcion completa seleccionada</summary>
          <pre>{selectedAssistance.prescription}</pre>
        </details>
        <p className="delta-note">{specimen.rationale.join(' ')}</p>
        <button className="primary" onClick={applySpecimenTemplate}>
          Aplicar templates elegidos
        </button>
      </section>

      <section className="panel" aria-labelledby="upper-back-title">
        <div className="section-title">
          <h2 id="upper-back-title">Upper back</h2>
          {latestAccessory?.upperBack?.exercise && <span>Ultimo: {latestAccessory.upperBack.exercise}</span>}
        </div>
        <div className="inline-fields">
          <label>
            Ejercicio
            <select
              value={currentLog.upperBack?.exercise || ''}
              onChange={(event) =>
                onLogChange({ ...currentLog, upperBack: { ...currentLog.upperBack, exercise: event.target.value } })
              }
            >
              <option value="">Sin seleccionar</option>
              {currentLog.upperBack?.exercise && !setup.backExercises.includes(currentLog.upperBack.exercise) && (
                <option value={currentLog.upperBack.exercise}>{currentLog.upperBack.exercise}</option>
              )}
              {setup.backExercises.map((exercise) => (
                <option key={exercise} value={exercise}>
                  {exercise}
                </option>
              ))}
            </select>
          </label>
          <label>
            Carga
            <input
              inputMode="decimal"
              value={currentLog.upperBack?.load || ''}
              onChange={(event) =>
                onLogChange({ ...currentLog, upperBack: { ...currentLog.upperBack, load: event.target.value } })
              }
            />
          </label>
          <label>
            Series x reps
            <input
              value={currentLog.upperBack?.reps || ''}
              onChange={(event) =>
                onLogChange({ ...currentLog, upperBack: { ...currentLog.upperBack, reps: event.target.value } })
              }
            />
          </label>
          <label>
            Notas
            <textarea
              rows="3"
              value={currentLog.upperBack?.notes || ''}
              onChange={(event) =>
                onLogChange({ ...currentLog, upperBack: { ...currentLog.upperBack, notes: event.target.value } })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel" aria-labelledby="accessory-title">
        <div className="section-title">
          <h2 id="accessory-title">Accesorios</h2>
          {latestAccessory?.id && <span>Arrastre desde {latestAccessory.id}</span>}
        </div>
        <div className="accessory-list">
          {currentLog.accessories.map((item, index) => (
            <div className="accessory-row" key={index}>
              <label>
                Ejercicio {index + 1}
                <input value={item.name || ''} onChange={(event) => updateAccessory(index, { name: event.target.value })} />
              </label>
              <div className="inline-fields">
                <label>
                  Carga
                  <input inputMode="decimal" value={item.load || ''} onChange={(event) => updateAccessory(index, { load: event.target.value })} />
                </label>
                <label>
                  Series
                  <input inputMode="numeric" value={item.sets || ''} onChange={(event) => updateAccessory(index, { sets: event.target.value })} />
                </label>
                <label>
                  Reps
                  <input value={item.reps || ''} onChange={(event) => updateAccessory(index, { reps: event.target.value })} />
                </label>
              </div>
              <label className="accessory-notes">
                Notas
                <textarea
                  rows="3"
                  value={item.notes || ''}
                  onChange={(event) => updateAccessory(index, { notes: event.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

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

function DashboardView({ setup, logs, selected, onOpen, onGoPlan, onGoAnalytics }) {
  const draft = Object.values(logs).find((log) => log.status !== 'completed')
  const next = nextSession(template, setup, logs)
  const target = draft ? parseSessionId(draft.id) : next || selected
  const plan = buildSessionPlan(template, setup, logs, target.week, target.day)
  const specimen = specimenTemplateForSession({
    week: plan.week,
    day: plan.day,
    frequency: plan.frequency,
    deload: plan.deload,
    lifts: plan.lifts
  })
  const completed = Object.values(logs).filter((log) => log.status === 'completed').length
  const total = listSessions(template, setup).length

  return (
    <main className="screen dashboard-screen">
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
          <span className="eyebrow">Specimen</span>
          <h2>{specimen.assistance.title}</h2>
          <p>{specimen.assistance.emphasis}</p>
          <button onClick={onGoPlan}>Abrir calendario</button>
        </article>
      </section>
    </main>
  )
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
  const specimenAccepted = Object.values(logs).filter((log) => log.specimenAccepted).length
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
          <span className="eyebrow">Specimen</span>
          <h2>{specimenAccepted}</h2>
          <p>sesiones con template de asistencia aplicado.</p>
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
                <span>{log.specimenAccepted ? 'Specimen aplicado' : 'Sin template specimen'}</span>
              </div>
              <div>
                <strong>{Object.keys(log.lifts || {}).length}</strong>
                <span>lifts</span>
              </div>
            </div>
          ))}
          {!completedLogs.length && <p className="muted">Todavia no hay sesiones completadas.</p>}
        </div>
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
            <select value={setup.frequency} onChange={(event) => onChange({ ...setup, frequency: Number(event.target.value) })}>
              {template.meta.frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>{frequency}x por semana</option>
              ))}
            </select>
          </label>
        </div>
      </section>

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
          onOpen={selectSession}
          onGoPlan={() => setView(VIEWS.PLAN)}
          onGoAnalytics={() => setView(VIEWS.ANALYTICS)}
        />
      )}
      {view === VIEWS.RUNNER && (
        <SessionRunner
          setup={setup}
          logs={state.logs}
          selected={selected}
          onLogChange={updateLog}
          onDiscard={discardLog}
          onBack={() => setView(VIEWS.DASHBOARD)}
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
