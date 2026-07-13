import { useMemo, useState } from 'react'
import { useAppState } from '../app/AppContext'
import { TrainingMaxChart } from '../components/TrainingMaxChart'
import template from '../data/sbsRtfTemplate.json'
import { deriveTrainingMaxOverview, trainingMaxHistoryDisplayMode } from '../lib/analytics'

function formatTrainingMax(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(value)
}

export function AnalyticsPage(): JSX.Element {
  const { state, setup } = useAppState()
  const overviews = useMemo(() => deriveTrainingMaxOverview({
    template,
    setup,
    schedule: state.schedule,
    logs: state.logs
  }), [setup, state.logs, state.schedule])
  const [selectedSlotId, setSelectedSlotId] = useState(overviews[0]?.slotId || '')
  const selected = overviews.find((lift) => lift.slotId === selectedSlotId) || overviews[0]
  const historyMode = trainingMaxHistoryDisplayMode(selected?.history.length || 0)

  return (
    <main className="page-v3 analytics-page-v3">
      <header className="page-heading">
        <div><span>Training max</span><h1>Analíticas</h1></div>
      </header>

      <section className="tm-picker-card" aria-label="Training max actual">
        <label>
          Seleccionar lift
          <select value={selected?.slotId || ''} onChange={(event) => setSelectedSlotId(event.target.value)}>
            {overviews.map((lift) => <option key={lift.slotId} value={lift.slotId}>{lift.name}</option>)}
          </select>
        </label>
        {selected && (
          <div className="tm-current-value">
            <div><span>{selected.label}</span><h2>{selected.name}</h2></div>
            <strong>{formatTrainingMax(selected.currentTrainingMax)} <small>{setup.units}</small></strong>
            <small>{selected.currentSessionId ? `Próxima aparición · ${selected.currentSessionId}` : 'TM al cierre del ciclo'}</small>
          </div>
        )}
      </section>

      {selected && (
        <section className="tm-history-card">
          <header>
            <div><span>Histórico de TM</span><h2>{selected.name}</h2></div>
            <strong>{selected.history.length} {selected.history.length === 1 ? 'sesión' : 'sesiones'}</strong>
          </header>

          {historyMode === 'empty' && <div className="tm-history-empty">Completa la primera sesión de este lift para crear su histórico.</div>}

          {historyMode === 'list' && (
            <div className="tm-history-list">
              {[...selected.history].reverse().map((point) => (
                <article key={point.sessionId}>
                  <div><strong>{point.sessionId}</strong><span>Semana {point.week} · Día {point.day}</span></div>
                  <strong>{formatTrainingMax(point.trainingMax)} <small>{setup.units}</small></strong>
                </article>
              ))}
            </div>
          )}

          {historyMode === 'chart' && (
            <TrainingMaxChart history={selected.history} liftName={selected.name} units={setup.units} />
          )}
        </section>
      )}
    </main>
  )
}
