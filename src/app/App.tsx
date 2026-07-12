import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import template from '../data/sbsRtfTemplate.json'
import WorkoutSession from '../components/WorkoutSession.jsx'
import { parseSessionId } from '../lib/sbsRtf.js'
import { AppLayout } from './AppLayout'
import { useAppState } from './AppContext'
import { OnboardingPage } from '../pages/OnboardingPage'
import { TodayPage } from '../pages/TodayPage'

const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const CalendarPage = lazy(() => import('../pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const ProgramPage = lazy(() => import('../pages/ProgramPage').then((module) => ({ default: module.ProgramPage })))
const SessionSummaryPage = lazy(() => import('../pages/SessionSummaryPage').then((module) => ({ default: module.SessionSummaryPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function LoadingPage(): JSX.Element {
  return <main className="page-v3"><p>Cargando…</p></main>
}

function RouteScrollReset(): null {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [pathname])
  return null
}

function WorkoutRoute(): JSX.Element {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const { state, setup, updateLog, completeLog, discardLog } = useAppState()
  const scheduled = state.schedule.find((session) => session.id === sessionId || session.code === sessionId)
  const selected = parseSessionId(scheduled?.code || '')
  if (!scheduled || !selected) return <Navigate to="/calendario" replace />
  if (scheduled.status === 'completed') return <Navigate to={`/resumen/${scheduled.id}`} replace />
  if (setup.singlePctReviewRequired) return <Navigate to="/ajustes" replace />
  return (
    <WorkoutSession
      setup={setup}
      logs={state.logs}
      selected={selected}
      onLogChange={updateLog}
      onDiscard={async (code: string) => {
        if (!window.confirm('¿Descartar la sesión en curso? Se perderá el borrador local.')) return
        navigate('/hoy')
        await discardLog(code)
      }}
      onBack={() => navigate('/hoy')}
      onComplete={async (log: any, summary: any) => { await completeLog(log, summary); navigate(`/resumen/${scheduled.id}`) }}
    />
  )
}

export function App(): JSX.Element {
  const { setupComplete } = useAppState()
  if (!setupComplete) return <OnboardingPage />
  return (
    <><RouteScrollReset /><Routes>
      <Route element={<AppLayout />}>
        <Route path="/hoy" element={<TodayPage />} />
        <Route path="/calendario" element={<Suspense fallback={<LoadingPage />}><CalendarPage /></Suspense>} />
        <Route path="/programa/:id" element={<Suspense fallback={<LoadingPage />}><ProgramPage /></Suspense>} />
        <Route path="/analiticas" element={<Suspense fallback={<LoadingPage />}><AnalyticsPage /></Suspense>} />
        <Route path="/ajustes" element={<Suspense fallback={<LoadingPage />}><SettingsPage /></Suspense>} />
        <Route path="/resumen/:sessionId" element={<Suspense fallback={<LoadingPage />}><SessionSummaryPage /></Suspense>} />
      </Route>
      <Route path="/sesion/:sessionId" element={<WorkoutRoute />} />
      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes></>
  )
}

export { template }
