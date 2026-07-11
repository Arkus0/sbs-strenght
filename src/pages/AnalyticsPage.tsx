import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppState } from '../app/AppContext'
import template from '../data/sbsRtfTemplate.json'
import { deriveAnalytics } from '../lib/analytics'
import { buildSessionPlan, parseSessionId, requiredSlotIds } from '../lib/sbsRtf.js'

function duration(seconds: number | null): string {
  if (!seconds) return 'Sin datos v3'
  return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`
}

export function AnalyticsPage(): JSX.Element {
  const { state, setup } = useAppState()
  const slotIds = requiredSlotIds(template, setup)
  const [slotId, setSlotId] = useState(slotIds[0])
  const [accessoryId, setAccessoryId] = useState('')
  const analytics = useMemo(() => {
    const enrichedLogs = structuredClone(state.logs)
    for (const session of state.schedule) {
      const parsed = parseSessionId(session.code)
      const log = enrichedLogs[session.code]
      if (!parsed || !log) continue
      const plan = buildSessionPlan(template, setup, state.logs, parsed.week, parsed.day)
      if (!plan) continue
      for (const lift of plan.lifts) {
        if (log.lifts?.[lift.slotId]) log.lifts[lift.slotId].projection = lift.projection
      }
    }
    return deriveAnalytics({
      schedule: state.schedule,
      logs: enrichedLogs,
      measurements: state.measurements,
      liftNames: Object.fromEntries(Object.entries<any>(setup.lifts).map(([id, lift]) => [id, lift.name]))
    })
  }, [setup, state.logs, state.measurements, state.schedule])
  const strengthData = analytics.liftSeries[slotId] || []
  const accessoryEntries = Object.entries(analytics.accessorySeries)
  const selectedAccessoryId = accessoryId || accessoryEntries[0]?.[0] || ''
  const accessoryData = analytics.accessorySeries[selectedAccessoryId] || []

  return (
    <main className="page-v3 analytics-page-v3">
      <header className="page-heading"><div><span>Decisiones con contexto</span><h1>Analíticas</h1></div></header>
      <section className="analytics-kpis">
        <article><span>Ciclo</span><strong>{analytics.completionPct}%</strong><small>{analytics.completedSessions}/{state.schedule.length} sesiones</small></article>
        <article><span>Adherencia</span><strong>{analytics.adherencePct}%</strong><small>{analytics.scheduledToDate} programadas hasta hoy</small></article>
        <article><span>Series</span><strong>{analytics.completedSets}</strong><small>series registradas como hechas</small></article>
        <article><span>Duración mediana</span><strong>{duration(analytics.medianActiveSeconds)}</strong><small>excluye tiempos heredados</small></article>
      </section>

      <section className="analytics-grid-v3">
        <article className="chart-card wide">
          <header><div><span>Fuerza</span><h2>Training max y e1RM estimado</h2></div><select aria-label="Lift para analíticas" value={slotId} onChange={(event) => setSlotId(event.target.value)}>{slotIds.map((id: string) => <option key={id} value={id}>{setup.lifts[id].name}</option>)}</select></header>
          {strengthData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={strengthData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="sessionId" /><YAxis domain={['auto', 'auto']} /><Tooltip /><Line type="monotone" dataKey="tm" name="TM" stroke="#0f766e" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="e1rm" name="e1RM Epley" stroke="#d69e1d" strokeWidth={2} connectNulls /></LineChart></ResponsiveContainer></div> : <div className="chart-empty">Completa AMRAPs para ver la tendencia.</div>}
          <p className="chart-note">e1RM usa Epley y es una estimación, no una modificación del motor SBS.</p>
        </article>

        <article className="chart-card">
          <header><div><span>Carga semanal</span><h2>Tonelaje registrado</h2></div></header>
          {analytics.weekly.length ? <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.weekly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" /><YAxis /><Tooltip /><Bar dataKey="tonnage" name={`Tonelaje (${setup.units})`} fill="#d69e1d" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Sin volumen completado.</div>}
        </article>

        <article className="chart-card">
          <header><div><span>Consistencia</span><h2>Sesiones por semana</h2></div></header>
          {analytics.weekly.length ? <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.weekly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" /><YAxis allowDecimals={false} /><Tooltip /><Area type="step" dataKey="sessions" name="Sesiones" stroke="#0f766e" fill="#a7d6c8" /></AreaChart></ResponsiveContainer></div> : <div className="chart-empty">Aún no hay semanas completadas.</div>}
        </article>

        <article className="chart-card wide">
          <header><div><span>Accesorios</span><h2>Carga y repeticiones</h2></div>{accessoryEntries.length > 0 && <select aria-label="Accesorio para analíticas" value={selectedAccessoryId} onChange={(event) => setAccessoryId(event.target.value)}>{accessoryEntries.map(([id, values]) => <option key={id} value={id}>{values[0]?.name || id}</option>)}</select>}</header>
          {accessoryData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={accessoryData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="sessionId" /><YAxis /><Tooltip /><Line type="monotone" dataKey="load" name={`Carga (${setup.units})`} stroke="#0f766e" strokeWidth={3} connectNulls /><Line type="monotone" dataKey="totalReps" name="Reps totales" stroke="#d69e1d" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="chart-empty">Registra accesorios para ver su progresión.</div>}
        </article>
      </section>

      <section className="records-card"><header><span>Récords recientes</span><h2>Mejores marcas registradas</h2></header><div>{analytics.records.slice(0, 8).map((record) => <article key={record.id}><div><strong>{record.exercise}</strong><span>{record.sessionId}</span></div><div><strong>{record.value}</strong><span>{record.kind === 'e1rm' ? 'e1RM estimado' : record.kind === 'load' ? `carga ${setup.units}` : 'reps'}</span></div></article>)}{!analytics.records.length && <p>Los récords aparecerán al completar series con peso y repeticiones.</p>}</div></section>
    </main>
  )
}
