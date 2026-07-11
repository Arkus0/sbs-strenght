import { Cloud, Database, Download, ShieldCheck, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { ACCESSORY_EXERCISES, BACK_EXERCISES } from '../data/bodybuildingCatalog.js'
import { ASSISTANCE_BLOCKS } from '../lib/assistanceProgram.js'
import { exportV3State } from '../lib/stateV3'
import { useAppState } from '../app/AppContext'
import { SyncSettings } from '../sync/SyncSettings'

const weekdayOptions = [
  { value: 1, label: 'L' }, { value: 2, label: 'M' }, { value: 3, label: 'X' },
  { value: 4, label: 'J' }, { value: 5, label: 'V' }, { value: 6, label: 'S' }, { value: 0, label: 'D' }
]

function downloadJson(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `sbs-strength-v3-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage(): JSX.Element {
  const { state, setup, updateSetup, importState, resetAll, setTheme, setPreferredWeekdays } = useAppState()
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hasHistory = Object.keys(state.logs).length > 0

  function updateLift(slotId: string, patch: Record<string, unknown>): void {
    updateSetup({ ...setup, lifts: { ...setup.lifts, [slotId]: { ...setup.lifts[slotId], ...patch } } })
  }

  function updateAssistance(blockId: string, dayId: string, role: 'back' | 'accessory', index: number, exerciseId: string): void {
    const block = setup.assistanceBlocks[blockId]
    const day = block.days[dayId]
    const nextDay = role === 'back' ? { ...day, backExerciseId: exerciseId } : { ...day, accessoryExerciseIds: day.accessoryExerciseIds.map((id: string, itemIndex: number) => itemIndex === index ? exerciseId : id) }
    updateSetup({ ...setup, assistanceBlocks: { ...setup.assistanceBlocks, [blockId]: { ...block, days: { ...block.days, [dayId]: nextDay } } } })
  }

  async function importFile(file: File): Promise<void> {
    try { importState(await file.text()); setMessage('Importación completada.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Archivo no válido.') }
  }

  return (
    <main className="page-v3 settings-page-v3">
      <header className="page-heading"><div><span>Control local</span><h1>Ajustes</h1></div></header>

      <section className="settings-section"><header><div><span>Perfil</span><h2>Experiencia</h2></div></header><div className="settings-form-grid"><label>Tema<select value={state.profile.theme} onChange={(event) => setTheme(event.target.value as any)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><label>Unidades<select value={setup.units} disabled={hasHistory} onChange={(event) => updateSetup({ ...setup, units: event.target.value, rounding: event.target.value === 'lb' ? 5 : 2.5 })}><option value="kg">kg</option><option value="lb">lb</option></select>{hasHistory && <small>Bloqueado durante un ciclo con historial.</small>}</label><label>Redondeo<input inputMode="decimal" value={setup.rounding} onChange={(event) => updateSetup({ ...setup, rounding: event.target.value })} /></label></div></section>

      <section className="settings-section"><header><div><span>Calendario</span><h2>Días preferidos</h2></div><strong>{state.profile.preferredWeekdays.length}/{setup.frequency}</strong></header><div className="weekday-picker">{weekdayOptions.map((day) => { const active = state.profile.preferredWeekdays.includes(day.value); return <button key={day.value} className={active ? 'active' : ''} aria-pressed={active} onClick={() => { const next = active ? state.profile.preferredWeekdays.filter((value) => value !== day.value) : [...state.profile.preferredWeekdays, day.value]; if (next.length <= Number(setup.frequency)) setPreferredWeekdays(next) }}>{day.label}</button> })}</div><p>Estos días se usan al redistribuir sesiones futuras; cambiar la selección no mueve sesiones automáticamente.</p></section>

      <section className="settings-section"><header><div><span>SBS RTF</span><h2>Lifts y training maxes</h2></div><span className="protected-badge"><ShieldCheck size={16} />Motor Excel protegido</span></header><div className="settings-lift-list">{template.defaults.liftSlots.map((slot) => { const lift = setup.lifts[slot.id]; return <article key={slot.id}><div><span>{slot.label}</span><input aria-label={`Nombre ${slot.label}`} value={lift.name} onChange={(event) => updateLift(slot.id, { name: event.target.value })} /></div><label>Training max<input inputMode="decimal" aria-label={`Training max ${lift.name}`} value={lift.trainingMax ?? ''} onChange={(event) => updateLift(slot.id, { trainingMax: event.target.value })} /></label><label>Single @8 %<input inputMode="decimal" value={lift.singleAt8Pct} onChange={(event) => updateLift(slot.id, { singleAt8Pct: event.target.value })} /></label></article> })}</div><p className="protected-note">Las intensidades, targets, buckets, deloads y fórmulas procedentes del Excel no son editables desde esta versión.</p></section>

      <section className="settings-section"><header><div><span>Bodybuilding</span><h2>Ejercicios por bloque</h2></div></header><div className="assistance-settings">{ASSISTANCE_BLOCKS.map((definition: any) => { const block = setup.assistanceBlocks?.[definition.id]; if (!block) return null; return <details key={definition.id}><summary>{definition.label} · semanas {definition.workWeeks[0]}–{definition.workWeeks.at(-1)}</summary>{Object.values<any>(block.days).map((day) => <article key={day.day}><h3>Día {day.day}</h3><label>Espalda<select value={day.backExerciseId} onChange={(event) => updateAssistance(definition.id, String(day.day), 'back', 0, event.target.value)}>{BACK_EXERCISES.map((exercise: any) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>{day.accessoryExerciseIds.map((exerciseId: string, index: number) => <label key={`${day.day}:${index}`}>Accesorio {index + 1}<select value={exerciseId} onChange={(event) => updateAssistance(definition.id, String(day.day), 'accessory', index, event.target.value)}>{ACCESSORY_EXERCISES.map((exercise: any) => <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.repMin}–{exercise.repMax}</option>)}</select></label>)}</article>)}</details> })}</div></section>

      <section className="settings-section"><header><div><span>Sincronización opcional</span><h2>Cuenta y dispositivos</h2></div><Cloud size={20} /></header><SyncSettings /></section>

      <section className="settings-section"><header><div><span>Datos</span><h2>Backup e importación</h2></div><Database size={20} /></header><div className="data-buttons-v3"><button onClick={() => downloadJson(exportV3State(state))}><Download size={18} />Exportar JSON v3</button><button onClick={() => inputRef.current?.click()}><Upload size={18} />Importar JSON</button><input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file) }} /><button className="danger-outline" onClick={() => { if (window.confirm('¿Borrar todos los datos locales de SBS Strength?')) void resetAll() }}>Restablecer app</button></div>{message && <p className="notice">{message}</p>}<p>El backup legacy de localStorage se conserva después de la migración v3.</p></section>
    </main>
  )
}
