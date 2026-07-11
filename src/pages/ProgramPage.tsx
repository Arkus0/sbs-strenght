import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAppState } from '../app/AppContext'

export function ProgramPage(): JSX.Element {
  const { id } = useParams()
  const { state, activeProgram } = useAppState()
  if (id !== activeProgram.id) return <Navigate to={`/programa/${activeProgram.id}`} replace />
  return (
    <main className="page-v3 roadmap-page">
      <header className="page-heading"><div><span>Ciclo completo</span><h1>Roadmap · 21 semanas</h1></div><Link to="/calendario"><ArrowLeft size={18} />Calendario</Link></header>
      <section className="roadmap-grid">
        {Array.from({ length: 21 }, (_, index) => index + 1).map((week) => {
          const sessions = state.schedule.filter((session) => session.week === week)
          return <article key={week} className={sessions[0]?.deload ? 'deload' : ''}><header><span>Semana</span><strong>{week}</strong>{sessions[0]?.deload && <small>DELOAD</small>}</header><div>{sessions.map((session) => <Link key={session.id} to={`/sesion/${session.id}`} className={session.status}><b>D{session.day}</b><span>{session.status === 'completed' ? '✓' : session.status === 'skipped' ? '—' : session.scheduledDate.slice(5)}</span></Link>)}</div></article>
        })}
      </section>
    </main>
  )
}
