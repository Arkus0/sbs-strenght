import { CalendarRange, ChevronLeft, ChevronRight, Download, List, Map } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/AppContext'
import { addLocalDays, isoLocalDate, parseLocalDate, startOfIsoWeek } from '../lib/schedule'
import type { ScheduledSession } from '../types/domain'

function statusLabel(session: ScheduledSession): string {
  return { completed: 'Hecha', draft: 'En curso', skipped: 'Omitida', planned: session.deload ? 'Deload' : 'RTF' }[session.status]
}

function downloadIcs(schedule: ScheduledSession[]): void {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SBS Strength//RTF//ES', 'CALSCALE:GREGORIAN']
  for (const session of schedule.filter((item) => item.status === 'planned' || item.status === 'draft')) {
    const date = session.scheduledDate.replaceAll('-', '')
    lines.push('BEGIN:VEVENT', `UID:${session.id}@sbs-strength`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:SBS Strength ${session.code}${session.deload ? ' · Deload' : ''}`, `DESCRIPTION:Semana ${session.week} Día ${session.day}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'sbs-strength-calendario.ics'
  anchor.click()
  URL.revokeObjectURL(url)
}

function SessionCalendarCard({ session }: { session: ScheduledSession }): JSX.Element {
  const { reprogram, skipSession } = useAppState()
  const [date, setDate] = useState(session.scheduledDate)
  const [reason, setReason] = useState('Viaje o agenda')
  return (
    <article className={`calendar-session ${session.status} ${session.scheduledDate === isoLocalDate(new Date()) ? 'today' : ''}`}>
      <Link to={`/sesion/${session.id}`} className="calendar-session-main"><span>{session.code}</span><strong>Semana {session.week} · D{session.day}</strong><small>{statusLabel(session)} · {session.scheduledDate}</small></Link>
      {session.status !== 'completed' && session.status !== 'skipped' && (
        <details><summary>Programar</summary><label>Nueva fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button onClick={() => reprogram(session.id, date)}>Mover sesión</button><label>Motivo al omitir<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Viaje o agenda</option><option>Enfermedad</option><option>Dolor o lesión</option><option>Recuperación insuficiente</option></select></label><button className="text-danger" onClick={() => skipSession(session.id, reason)}>Marcar omitida</button></details>
      )}
    </article>
  )
}

export function CalendarPage(): JSX.Element {
  const { state, activeProgram } = useAppState()
  const today = isoLocalDate(new Date())
  const [weekStart, setWeekStart] = useState(startOfIsoWeek(today))
  const [mode, setMode] = useState<'agenda' | 'month'>('agenda')
  const weekEnd = addLocalDays(weekStart, 6)
  const agenda = state.schedule.filter((session) => session.scheduledDate >= weekStart && session.scheduledDate <= weekEnd)
  const monthCells = useMemo(() => {
    const month = parseLocalDate(weekStart)
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
    const start = startOfIsoWeek(isoLocalDate(first))
    return Array.from({ length: 42 }, (_, index) => addLocalDays(start, index))
  }, [weekStart])

  return (
    <main className="page-v3 calendar-page-v3">
      <header className="page-heading"><div><span>Plan flexible</span><h1>Calendario</h1></div><div className="heading-actions"><button aria-label="Vista agenda" className={mode === 'agenda' ? 'active' : ''} onClick={() => setMode('agenda')}><List size={18} /></button><button aria-label="Vista mensual" className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}><CalendarRange size={18} /></button><Link aria-label="Roadmap del programa" to={`/programa/${activeProgram.id}`}><Map size={18} /></Link><button aria-label="Exportar calendario" onClick={() => downloadIcs(state.schedule)}><Download size={18} /></button></div></header>
      <div className="calendar-toolbar"><button aria-label="Semana anterior" onClick={() => setWeekStart(addLocalDays(weekStart, -7))}><ChevronLeft size={18} /></button><div><strong>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(parseLocalDate(weekStart))}</strong><span>— {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(parseLocalDate(weekEnd))}</span></div><button aria-label="Semana siguiente" onClick={() => setWeekStart(addLocalDays(weekStart, 7))}><ChevronRight size={18} /></button><button onClick={() => setWeekStart(startOfIsoWeek(today))}>Hoy</button></div>

      {mode === 'agenda' ? (
        <section className="agenda-list">
          {Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index)).map((date) => {
            const sessions = agenda.filter((session) => session.scheduledDate === date)
            return <div className={`agenda-day ${date === today ? 'today' : ''}`} key={date}><header><span>{new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(parseLocalDate(date))}</span><strong>{parseLocalDate(date).getDate()}</strong></header><div>{sessions.map((session) => <SessionCalendarCard key={session.id} session={session} />)}{!sessions.length && <span className="rest-day">Descanso</span>}</div></div>
          })}
        </section>
      ) : (
        <section className="month-grid-v3">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <strong key={day}>{day}</strong>)}
          {monthCells.map((date) => <div key={date} className={date === today ? 'today' : ''}><span>{parseLocalDate(date).getDate()}</span>{state.schedule.filter((session) => session.scheduledDate === date).map((session) => <Link key={session.id} to={`/sesion/${session.id}`} className={session.status}>{session.code}</Link>)}</div>)}
        </section>
      )}
    </main>
  )
}
