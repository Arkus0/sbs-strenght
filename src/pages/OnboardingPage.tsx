import { useState } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { createAssistanceBlocks } from '../lib/assistanceProgram.js'
import { requiredSlotIds, setupMissingMaxes } from '../lib/sbsRtf.js'
import { evenlySpacedWeekdays, isoLocalDate } from '../lib/schedule'
import { useAppState } from '../app/AppContext'

export function OnboardingPage(): JSX.Element {
  const { setup, updateSetup, completeSetup, setPreferredWeekdays } = useAppState()
  const [nextDate, setNextDate] = useState(isoLocalDate(new Date()))
  const required = new Set(requiredSlotIds(template, setup))
  const missing = setupMissingMaxes(template, setup)

  function updateLift(slotId: string, patch: Record<string, unknown>): void {
    updateSetup({ ...setup, lifts: { ...setup.lifts, [slotId]: { ...setup.lifts[slotId], ...patch } } })
  }

  function setFrequency(frequency: number): void {
    setPreferredWeekdays(evenlySpacedWeekdays(frequency))
    updateSetup({ ...setup, frequency, assistanceBlocks: createAssistanceBlocks(template, frequency) })
  }

  return (
    <main className="onboarding-v3">
      <section className="onboarding-hero">
        <span className="brand-kicker">SBS Strength</span>
        <h1>Tu ciclo. Tus datos.<br />La progresión del Excel.</h1>
        <p>Configura el programa una vez. Todo queda disponible offline y puedes activar sincronización más adelante.</p>
      </section>
      <section className="setup-card-v3">
        <div className="page-heading"><div><span>Paso 1</span><h2>Base del ciclo</h2></div></div>
        <div className="form-grid-3">
          <label>Unidades<select value={setup.units} onChange={(event) => updateSetup({ ...setup, units: event.target.value, rounding: event.target.value === 'lb' ? 5 : 2.5 })}><option value="kg">kg</option><option value="lb">lb</option></select></label>
          <label>Frecuencia<select value={setup.frequency} onChange={(event) => setFrequency(Number(event.target.value))}>{template.meta.frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}× por semana</option>)}</select></label>
          <label>Primera sesión<input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
        </div>
      </section>
      <section className="setup-card-v3">
        <div className="page-heading"><div><span>Paso 2</span><h2>Training maxes</h2></div><strong>{missing.length ? `${missing.length} pendientes` : 'Listo'}</strong></div>
        <div className="setup-lift-grid">
          {template.defaults.liftSlots.map((slot) => {
            const lift = setup.lifts[slot.id]
            return (
              <article key={slot.id} className={required.has(slot.id) ? 'required' : ''}>
                <span>{slot.label}</span>
                <input aria-label={`Ejercicio ${slot.label}`} value={lift.name} onChange={(event) => updateLift(slot.id, { name: event.target.value })} />
                <label>Training max ({setup.units})<input inputMode="decimal" aria-label={`Training max ${lift.name}`} value={lift.trainingMax ?? ''} onChange={(event) => updateLift(slot.id, { trainingMax: event.target.value })} /></label>
              </article>
            )
          })}
        </div>
      </section>
      <div className="onboarding-dock"><div><strong>{missing.length ? 'Completa los maxes requeridos' : 'Todo preparado'}</strong><span>El motor SBS no se modifica.</span></div><button className="primary" disabled={missing.length > 0} onClick={() => completeSetup(nextDate)}>Crear ciclo</button></div>
    </main>
  )
}
