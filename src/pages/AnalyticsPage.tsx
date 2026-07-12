import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppState } from '../app/AppContext'
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

      <section className="tm-overview-grid" aria-label="Training maxes actuales">
        {overviews.map((lift) => (
          <button
            className={`tm-card ${selected?.slotId === lift.slotId ? 'active' : ''}`}
            key={lift.slotId}
            aria-label={`Ver histórico de ${lift.name}`}
            aria-pressed={selected?.slotId === lift.slotId}
            onClick={() => setSelectedSlotId(lift.slotId)}
          >
            <span>{lift.label}</span>
            <h2>{lift.name}</h2>
            <strong>{formatTrainingMax(lift.currentTrainingMax)} <small>{setup.units}</small></strong>
            <small>{lift.currentSessionId ? `Próxima aparición · ${lift.currentSessionId}` : 'TM al cierre del ciclo'}</small>
          </button>
        ))}
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
            <div className="tm-chart" role="img" aria-label={`Gráfica del histórico de TM de ${selected.name}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sessionId" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="trainingMax" name={`TM (${setup.units})`} stroke="#0f766e" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
