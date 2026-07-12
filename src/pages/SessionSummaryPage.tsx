import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAppState } from '../app/AppContext'
import { parseLocalDate } from '../lib/schedule'
import type { BodybuildingImpact, CompletionSummary, TrainingMaxImpact } from '../types/domain'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min ${String(remainder).padStart(2, '0')} s`
  return `${minutes} min ${String(remainder).padStart(2, '0')} s`
}

function formatLoad(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(value)
}

function formatDelta(value: number | null): string {
  if (value === null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatLoad(value)}`
}

function nextAppearance(code: string | null, scheduledDate: string | null): string {
  if (!code) return 'TM al cierre del ciclo'
  if (!scheduledDate) return code
  const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(parseLocalDate(scheduledDate))
  return `${code} · ${date}`
}

function directionLabel(impact: TrainingMaxImpact): string {
  if (impact.direction === 'increase') return 'Sube'
  if (impact.direction === 'decrease') return 'Baja'
  return 'Se mantiene'
}

function TrainingMaxRow({ impact, units }: { impact: TrainingMaxImpact; units: string }): JSX.Element {
  return (
    <article className={`impact-row ${impact.direction}`}>
      <div className="impact-description">
        <span>{impact.label || 'Training max'}</span>
        <h3>{impact.name}</h3>
        <small>{nextAppearance(impact.nextSessionCode, impact.nextScheduledDate)}</small>
      </div>
      <div className="impact-values" aria-label={`${impact.name}: ${formatLoad(impact.before)} a ${formatLoad(impact.after)} ${units}`}>
        <span>{formatLoad(impact.before)}</span>
        <ArrowRight size={18} aria-hidden="true" />
        <strong>{formatLoad(impact.after)} <small>{units}</small></strong>
      </div>
      <strong className={`impact-delta ${impact.direction}`}>{directionLabel(impact)} · {formatDelta(impact.delta)} {units}</strong>
    </article>
  )
}

function BodybuildingRow({ impact, units }: { impact: BodybuildingImpact; units: string }): JSX.Element {
  return (
    <article className={`impact-row ${impact.action === 'increase' ? 'increase' : 'decrease'}`}>
      <div className="impact-description">
        <span>Bodybuilding</span>
        <h3>{impact.name}</h3>
        <small>{nextAppearance(impact.nextSessionCode, impact.nextScheduledDate)}</small>
      </div>
      <div className="impact-values" aria-label={`${impact.name}: ${formatLoad(impact.before)} a ${formatLoad(impact.after)} ${units}`}>
        <span>{formatLoad(impact.before)}</span>
        <ArrowRight size={18} aria-hidden="true" />
        <strong>{formatLoad(impact.after)} <small>{units}</small></strong>
      </div>
      <strong className={`impact-delta ${impact.action === 'increase' ? 'increase' : 'decrease'}`}>
        {impact.action === 'increase' ? 'Sube' : 'Baja'} · {formatDelta(impact.delta)} {units}
      </strong>
    </article>
  )
}

export function SessionSummaryPage(): JSX.Element {
  const { sessionId = '' } = useParams()
  const { state, setup } = useAppState()
  const scheduled = state.schedule.find((session) => session.id === sessionId || session.code === sessionId)
  const log = scheduled ? state.logs[scheduled.code] : null
  if (!scheduled || log?.status !== 'completed') return <Navigate to="/calendario" replace />

  const summary = log.completionSummary as CompletionSummary | undefined
  const trainingMaxImpact = summary?.trainingMaxImpact || []
  const bodybuildingImpact = summary?.bodybuildingImpact || []

  return (
    <main className="page-v3 session-summary-page">
      <header className="page-heading summary-heading">
        <div><span>Sesión completada</span><h1>{scheduled.code} · impacto futuro</h1></div>
        <Link to="/hoy"><ArrowLeft size={18} aria-hidden="true" />Volver a Hoy</Link>
      </header>

      <section className="summary-hero" aria-label="Resumen de la sesión">
        <div><span>Duración activa</span><strong>{formatDuration(summary?.durationSeconds ?? log.activeSeconds ?? null)}</strong></div>
        <div><span>Series completadas</span><strong>{summary ? `${summary.completedSets}/${summary.totalSets}` : '—'}</strong></div>
        <div><span>Ejercicios</span><strong>{summary?.exerciseCount ?? '—'}</strong></div>
      </section>

      {summary?.impactVersion === 1 ? (
        <>
          <section className="impact-section" aria-labelledby="tm-impact-title">
            <header><div><span>SBS RTF</span><h2 id="tm-impact-title">Próximos training maxes</h2></div><small>TM usado → TM futuro</small></header>
            <div className="impact-list">
              {trainingMaxImpact.map((impact) => <TrainingMaxRow key={impact.slotId} impact={impact} units={setup.units} />)}
              {!trainingMaxImpact.length && <p className="impact-empty">Esta sesión no contenía ejercicios SBS con un TM calculable.</p>}
            </div>
          </section>

          <section className="impact-section" aria-labelledby="bodybuilding-impact-title">
            <header><div><span>Bodybuilding</span><h2 id="bodybuilding-impact-title">Cambios de carga</h2></div><small>Próxima sesión de trabajo</small></header>
            <div className="impact-list">
              {bodybuildingImpact.map((impact) => <BodybuildingRow key={`${impact.slotKey}:${impact.exerciseId}`} impact={impact} units={setup.units} />)}
              {!bodybuildingImpact.length && <p className="impact-empty">Sin subidas ni bajadas de carga para la próxima exposición.</p>}
            </div>
          </section>
        </>
      ) : (
        <section className="impact-section legacy-summary">
          <span>Sesión anterior</span>
          <h2>Impacto detallado no disponible</h2>
          <p>Esta sesión se completó antes de que la app guardara la evolución futura de TM y bodybuilding.</p>
        </section>
      )}

      <Link className="summary-primary-link" to="/hoy"><ArrowLeft size={18} aria-hidden="true" />Volver a Hoy</Link>
    </main>
  )
}
