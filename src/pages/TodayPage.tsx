import { ArrowRight, CalendarClock, Scale, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/AppContext'
import { bodybuildingForSession, conditioningOptionsForSession } from '../lib/assistanceProgram.js'
import { deriveAnalytics } from '../lib/analytics'
import { buildSessionPlan, parseSessionId } from '../lib/sbsRtf.js'
import { isoLocalDate, sameIsoWeek } from '../lib/schedule'
import template from '../data/sbsRtfTemplate.json'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function TodayPage(): JSX.Element {
  const { state, setup, addBodyweight, dismissSummary } = useAppState()
  const [weight, setWeight] = useState('')
  const today = isoLocalDate(new Date())
  const target = state.schedule.find((session) => session.status === 'draft') || state.schedule.find((session) => session.status === 'planned')
  const parsed = target ? parseSessionId(target.code) : null
  const plan = parsed ? buildSessionPlan(template, setup, state.logs, parsed.week, parsed.day) : null
  const bodybuilding = plan ? bodybuildingForSession(setup, plan, state.logs) : []
  const conditioning = plan ? conditioningOptionsForSession(plan, bodybuilding, state.logs)[0] : null
  const overdue = state.schedule.filter((session) => ['planned', 'draft'].includes(session.status) && session.scheduledDate < today)
  const thisWeek = state.schedule.filter((session) => sameIsoWeek(session.scheduledDate, today))
  const analytics = deriveAnalytics({ schedule: state.schedule, logs: state.logs, measurements: state.measurements, liftNames: Object.fromEntries(Object.entries<any>(setup.lifts).map(([id, lift]) => [id, lift.name])) })
  const pendingProgressions = bodybuilding.filter((item: any) => ['increase', 'reduce'].includes(item.progressionAction))
  const latestRecord = analytics.records[0]

  return (
    <main className="page-v3 today-page">
      <header className="page-heading hero-heading">
        <div><span>{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><h1>Hoy</h1></div>
        {overdue.length > 0 && <Link className="alert-chip" to="/calendario"><CalendarClock size={16} />{overdue.length} atrasada{overdue.length > 1 ? 's' : ''}</Link>}
      </header>

      {state.completionSummary && (
        <section className="result-banner">
          <div><span>Sesión completada</span><h2>{state.completionSummary.id}</h2></div>
          <div className="result-stats"><strong>{formatDuration(state.completionSummary.durationSeconds)}</strong><span>{state.completionSummary.completedSets}/{state.completionSummary.totalSets} series</span></div>
          <button aria-label="Cerrar resumen" onClick={dismissSummary}>Cerrar</button>
        </section>
      )}

      {setup.singlePctReviewRequired && (
        <section className="result-banner setup-review-banner">
          <div><span>Configuración SBS</span><h2>Revisa los porcentajes @8</h2><p>La versión anterior aplicaba 90% sin mostrarlo durante el alta.</p></div>
          <Link className="primary-link" to="/ajustes">Revisar ahora</Link>
        </section>
      )}

      {plan && target ? (
        <section className="next-workout-card">
          <div className="next-workout-top"><div><span>{target.status === 'draft' ? 'Sesión en curso' : target.scheduledDate === today ? 'Entrenamiento de hoy' : `Programada · ${target.scheduledDate}`}</span><h2>Semana {plan.week} · Día {plan.day}</h2></div><span className={plan.deload ? 'phase deload' : 'phase'}>{plan.deload ? 'Deload' : 'RTF'}</span></div>
          <div className="workout-preview-grid">
            {plan.lifts.map((lift: any) => <div key={lift.slotId}><span>{lift.name}</span><strong>{lift.weight ?? '—'} {setup.units}</strong><small>{Math.max(0, lift.setGoal - 1)}×{lift.normalReps} + AMRAP</small></div>)}
          </div>
          <div className="next-assistance"><span>{bodybuilding.map((item: any) => item.name).join(' · ')}</span>{conditioning && <small>Opcional: {conditioning.title}</small>}</div>
          {setup.singlePctReviewRequired
            ? <Link className="primary-link" to="/ajustes">Revisar porcentajes antes de entrenar<ArrowRight size={20} /></Link>
            : <Link className="primary-link" to={`/sesion/${target.id}`}>{target.status === 'draft' ? 'Continuar sesión' : 'Empezar sesión'}<ArrowRight size={20} /></Link>}
        </section>
      ) : <section className="empty-state"><Trophy size={34} /><h2>Ciclo completado</h2><p>Todas las sesiones están finalizadas u omitidas.</p></section>}

      <section className="today-grid">
        <article className="metric-card"><span>Esta semana</span><strong>{thisWeek.filter((session) => state.logs[session.code]?.status === 'completed').length}/{thisWeek.length}</strong><small>sesiones completadas</small><div className="mini-progress"><i style={{ width: `${thisWeek.length ? thisWeek.filter((session) => state.logs[session.code]?.status === 'completed').length / thisWeek.length * 100 : 0}%` }} /></div></article>
        <article className="metric-card"><span>Adherencia</span><strong>{analytics.adherencePct}%</strong><small>{analytics.completedSessions} sesiones del ciclo</small></article>
        <article className="metric-card"><span>Duración mediana</span><strong>{formatDuration(analytics.medianActiveSeconds)}</strong><small>sólo tiempos v3 fiables</small></article>
      </section>

      <section className="action-grid">
        <article className="action-card"><div className="icon-tile"><Sparkles size={20} /></div><div><span>Próximas progresiones</span><h3>{pendingProgressions.length ? pendingProgressions.map((item: any) => item.name).join(' · ') : 'Sin cambios de carga pendientes'}</h3><p>{pendingProgressions[0]?.recommendation?.reason || 'Las recomendaciones aparecerán cuando haya historial válido.'}</p></div></article>
        <article className="action-card"><div className="icon-tile"><Trophy size={20} /></div><div><span>Último logro</span><h3>{latestRecord ? `${latestRecord.exercise} · ${latestRecord.value}` : 'Aún no hay récords'}</h3><p>{latestRecord ? `${latestRecord.kind.toUpperCase()} en ${latestRecord.sessionId}` : 'Completa sesiones para construir tu historial.'}</p></div></article>
      </section>

      <section className="quick-entry-card"><div className="icon-tile"><Scale size={20} /></div><div><h2>Peso corporal</h2><p>Opcional · ayuda a contextualizar el progreso.</p></div><label><span className="sr-only">Peso corporal</span><input inputMode="decimal" placeholder={`Peso (${setup.units})`} value={weight} onChange={(event) => setWeight(event.target.value)} /></label><button onClick={() => { addBodyweight(Number(weight)); setWeight('') }} disabled={!(Number(weight) > 0)}>Guardar</button></section>
    </main>
  )
}
