import { useState } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { createAssistanceBlocks } from '../lib/assistanceProgram.js'
import { requiredSlotIds, setupMissingMaxes } from '../lib/sbsRtf.js'
import { evenlySpacedWeekdays, isoLocalDate } from '../lib/schedule'
import { useAppState } from '../app/AppContext'

export function OnboardingPage(): JSX.Element {
  const { setup, updateSetup, completeSetup, setPreferredWeekdays } = useAppState()
  const [nextDate, setNextDate] = useState(isoLocalDate(new Date()))
  const [reviewed, setReviewed] = useState(false)
  const required = new Set(requiredSlotIds(template, setup))
  const missing = setupMissingMaxes(template, setup)
  const invalidPercentages = template.defaults.liftSlots.filter((slot) => {
    if (!required.has(slot.id)) return false
    const value = Number(setup.lifts[slot.id]?.singleAt8Pct)
    return !(value > 0 && value <= 1)
  })

  function updateLift(slotId: string, patch: Record<string, unknown>): void {
    setReviewed(false)
    updateSetup({ ...setup, lifts: { ...setup.lifts, [slotId]: { ...setup.lifts[slotId], ...patch } } })
  }

  function percentageValue(value: unknown): string {
    if (value === '' || value === undefined || value === null) return ''
    const number = Number(value)
    return Number.isFinite(number) ? String(Math.round(number * 10000) / 100) : ''
  }

  function setFrequency(frequency: number): void {
    setReviewed(false)
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
          <label>Unidades<select value={setup.units} onChange={(event) => { setReviewed(false); updateSetup({ ...setup, units: event.target.value, rounding: event.target.value === 'lb' ? 5 : 2.5 }) }}><option value="kg">kg</option><option value="lb">lb</option></select></label>
          <label>Frecuencia<select value={setup.frequency} onChange={(event) => setFrequency(Number(event.target.value))}>{template.meta.frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}× por semana</option>)}</select></label>
          <label>Redondeo<input inputMode="decimal" aria-label="Redondeo de cargas" value={setup.rounding} onChange={(event) => { setReviewed(false); updateSetup({ ...setup, rounding: event.target.value }) }} /></label>
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
                <label>Single @8 (%)<input inputMode="decimal" aria-label={`Single @8 porcentaje ${lift.name}`} value={percentageValue(lift.singleAt8Pct)} onChange={(event) => updateLift(slot.id, { singleAt8Pct: event.target.value === '' ? '' : Number(event.target.value) / 100 })} /></label>
              </article>
            )
          })}
        </div>
      </section>
      <section className="setup-card-v3 setup-review-card">
        <div className="page-heading"><div><span>Paso 3</span><h2>Revisión SBS</h2></div></div>
        <div className="setup-review-grid">
          {[...required].map((slotId) => {
            const lift = setup.lifts[slotId]
            return <div key={slotId}><strong>{lift.name}</strong><span>TM {lift.trainingMax || '—'} {setup.units}</span><span>Single @8 {percentageValue(lift.singleAt8Pct)}%</span></div>
          })}
        </div>
        <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> He revisado los training maxes, el redondeo y el porcentaje @8 de cada lift.</label>
      </section>
      <div className="onboarding-dock"><div><strong>{missing.length ? 'Completa los maxes requeridos' : invalidPercentages.length ? 'Revisa los porcentajes @8' : reviewed ? 'Todo preparado' : 'Confirma la revisión SBS'}</strong><span>Estos valores reproducen Quick Setup.</span></div><button className="primary" disabled={missing.length > 0 || invalidPercentages.length > 0 || !reviewed} onClick={() => completeSetup(nextDate)}>Crear ciclo</button></div>
    </main>
  )
}
