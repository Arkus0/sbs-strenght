import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { buildSessionPlan, isSetupComplete, listSessions, parseSessionId } from '../lib/sbsRtf.js'
import {
  deleteSessionState,
  flushPendingWrites,
  loadStateV3,
  queueProfileUpdate,
  queueProgramUpdate,
  queueSessionDraft,
  resetV3,
  saveMetaState,
  saveScheduleUpdates,
  saveSessionState,
  saveStateV3
} from '../lib/repository'
import { generateSchedule, isoLocalDate, reprogramSession, redistributeFutureSessions } from '../lib/schedule'
import { parseStateImport } from '../lib/stateV3'
import { deriveCompletionImpact } from '../lib/sessionImpact'
import type { AppStateV3, CompletionSummary, TimerPreferences } from '../types/domain'

interface AppContextValue {
  state: AppStateV3
  setup: Record<string, any>
  activeProgram: AppStateV3['programs'][string]
  setupComplete: boolean
  updateSetup: (setup: Record<string, any>) => void
  completeSetup: (nextDate?: string) => void
  updateLog: (log: any) => void
  completeLog: (log: any, summary: CompletionSummary) => Promise<void>
  discardLog: (code: string) => Promise<void>
  reprogram: (id: string, date: string) => void
  redistribute: (fromSequence: number, date: string, weekdays?: number[]) => void
  skipSession: (id: string, reason: string) => void
  dismissSummary: () => void
  importState: (text: string) => void
  resetAll: () => Promise<void>
  setTheme: (theme: AppStateV3['profile']['theme']) => void
  setTimerPreferences: (preferences: TimerPreferences) => void
  setPreferredWeekdays: (weekdays: number[]) => void
  replaceState: (state: AppStateV3) => void
  patchSync: (patch: Partial<AppStateV3['sync']>) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function reportPersistence(promise: Promise<void>, context: string): void {
  void promise.catch((error) => console.error(`Error guardando ${context}`, error))
}

export function AppStateProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AppStateV3 | null>(null)
  const stateRef = useRef<AppStateV3 | null>(null)

  useEffect(() => {
    let active = true
    loadStateV3().then((loaded) => {
      if (!active) return
      stateRef.current = loaded
      setState(loaded)
    }).catch((error) => {
      console.error('No se pudo iniciar SBS Strength', error)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const flush = (): void => { reportPersistence(flushPendingWrites(), 'cambios pendientes') }
    const visibilityChanged = (): void => { if (document.hidden) flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', visibilityChanged)
      flush()
    }
  }, [])

  const theme = state?.profile.theme
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
  }, [theme])

  const applyState = useCallback((
    transform: (current: AppStateV3) => AppStateV3,
    persist?: (next: AppStateV3, previous: AppStateV3) => void
  ): void => {
    const current = stateRef.current
    if (!current) return
    const next = transform(current)
    stateRef.current = next
    setState(next)
    persist?.(next, current)
  }, [])

  const value = useMemo<AppContextValue | null>(() => {
    if (!state) return null
    const activeProgram = state.programs[state.activeProgramId]
    const setup = activeProgram.setup

    function updateSetup(nextSetup: Record<string, any>): void {
      applyState((current) => {
        const program = current.programs[current.activeProgramId]
        const now = new Date().toISOString()
        const profile = {
          ...current.profile,
          units: nextSetup.units === 'lb' ? 'lb' as const : 'kg' as const,
          rounding: Number(nextSetup.rounding) || current.profile.rounding,
          updatedAt: now,
          version: current.profile.version + 1
        }
        const nextProgram = { ...program, setup: nextSetup, updatedAt: now, version: program.version + 1 }
        return {
          ...current,
          profile,
          programs: { ...current.programs, [program.id]: nextProgram },
          schedule: current.schedule.map((session) => session.prescriptionSnapshot
            ? { ...session, prescriptionSnapshot: null }
            : session)
        }
      }, (next) => {
        const program = next.programs[next.activeProgramId]
        queueProgramUpdate(next.profile, program, next.schedule)
      })
    }

    function completeSetup(nextDate = isoLocalDate(new Date())): void {
      applyState((current) => {
        const program = current.programs[current.activeProgramId]
        const completedAt = new Date().toISOString()
        const completedSetup = { ...program.setup, completedAt, singlePctReviewRequired: false, singlePctReviewedAt: completedAt }
        return {
          ...current,
          programs: {
            ...current.programs,
            [program.id]: { ...program, setup: completedSetup, updatedAt: completedAt, version: program.version + 1 }
          },
          schedule: generateSchedule(listSessions(template, completedSetup), program.id, nextDate, current.profile.preferredWeekdays),
          selectedSessionId: 'W1D1'
        }
      }, (next) => reportPersistence(saveStateV3(next), 'el ciclo'))
    }

    function updateLog(log: any): void {
      applyState((current) => {
        const currentSetup = current.programs[current.activeProgramId].setup
        const parsed = parseSessionId(log.id)
        const scheduled = current.schedule.find((session) => session.code === log.id)
        let snapshot = scheduled?.prescriptionSnapshot
        if (!current.logs[log.id] && parsed && !snapshot) {
          snapshot = structuredClone(buildSessionPlan(template, currentSetup, current.logs, parsed.week, parsed.day))
        }
        const updatedSession = scheduled ? {
          ...scheduled,
          status: log.status === 'completed' ? 'completed' as const : 'draft' as const,
          prescriptionSnapshot: snapshot || scheduled.prescriptionSnapshot,
          updatedAt: log.updatedAt || new Date().toISOString(),
          version: scheduled.version + 1
        } : null
        return {
          ...current,
          logs: { ...current.logs, [log.id]: log },
          schedule: updatedSession
            ? current.schedule.map((session) => session.id === updatedSession.id ? updatedSession : session)
            : current.schedule
        }
      }, (next) => {
        const session = next.schedule.find((item) => item.code === log.id)
        if (session) queueSessionDraft(log, session)
      })
    }

    async function completeLog(log: any, summary: CompletionSummary): Promise<void> {
      const current = stateRef.current
      if (!current) return
      const currentSetup = current.programs[current.activeProgramId].setup
      const completedLog = { ...log, activeSeconds: log.activeSeconds ?? summary.durationSeconds }
      const completionSummary = deriveCompletionImpact({
        template,
        setup: currentSetup,
        schedule: current.schedule,
        logs: current.logs,
        completedLog,
        summary
      })
      const enriched = { ...completedLog, completionSummary }
      const schedule = current.schedule.map((session) => session.code === log.id
        ? { ...session, status: 'completed' as const, updatedAt: log.completedAt, version: session.version + 1 }
        : session)
      const next = schedule.find((session) => session.status !== 'completed' && session.status !== 'skipped')
      const nextState: AppStateV3 = {
        ...current,
        logs: { ...current.logs, [log.id]: enriched },
        schedule,
        selectedSessionId: next?.code || current.selectedSessionId,
        completionSummary
      }
      await saveSessionState(nextState, log.id)
      stateRef.current = nextState
      setState(nextState)
    }

    async function discardLog(code: string): Promise<void> {
      const current = stateRef.current
      if (!current) return
      const logs = { ...current.logs }
      delete logs[code]
      const nextState: AppStateV3 = {
        ...current,
        logs,
        schedule: current.schedule.map((session) => session.code === code
          ? { ...session, status: 'planned' as const, prescriptionSnapshot: null, updatedAt: new Date().toISOString(), version: session.version + 1 }
          : session)
      }
      await deleteSessionState(nextState, code)
      stateRef.current = nextState
      setState(nextState)
    }

    return {
      state,
      setup,
      activeProgram,
      setupComplete: isSetupComplete(template, setup),
      updateSetup,
      completeSetup,
      updateLog,
      completeLog,
      discardLog,
      reprogram(id, date) {
        applyState((current) => ({ ...current, schedule: reprogramSession(current.schedule, id, date) }), (next, previous) => {
          const changed = next.schedule.filter((session, index) => session !== previous.schedule[index])
          reportPersistence(saveScheduleUpdates(changed), 'el calendario')
        })
      },
      redistribute(fromSequence, date, weekdays = state.profile.preferredWeekdays) {
        applyState((current) => ({ ...current, schedule: redistributeFutureSessions(current.schedule, fromSequence, date, weekdays) }), (next, previous) => {
          const changed = next.schedule.filter((session, index) => session !== previous.schedule[index])
          reportPersistence(saveScheduleUpdates(changed), 'la redistribucion')
        })
      },
      skipSession(id, reason) {
        applyState((current) => ({
          ...current,
          schedule: current.schedule.map((session) => session.id === id
            ? { ...session, status: 'skipped' as const, skippedReason: reason || 'Omitida', updatedAt: new Date().toISOString(), version: session.version + 1 }
            : session)
        }), (next, previous) => {
          const changed = next.schedule.filter((session, index) => session !== previous.schedule[index])
          reportPersistence(saveScheduleUpdates(changed), 'la sesion omitida')
        })
      },
      dismissSummary() {
        applyState((current) => ({ ...current, completionSummary: null }), (next) => reportPersistence(saveMetaState(next), 'el resumen'))
      },
      importState(text) {
        const imported = parseStateImport(text)
        stateRef.current = imported
        setState(imported)
        reportPersistence(saveStateV3(imported), 'la importacion')
      },
      async resetAll() {
        const fresh = await resetV3()
        stateRef.current = fresh
        setState(fresh)
      },
      setTheme(theme) {
        applyState((current) => ({
          ...current,
          profile: { ...current.profile, theme, updatedAt: new Date().toISOString(), version: current.profile.version + 1 }
        }), (next) => queueProfileUpdate(next.profile))
      },
      setTimerPreferences(timerPreferences) {
        applyState((current) => ({
          ...current,
          profile: {
            ...current.profile,
            timerPreferences,
            updatedAt: new Date().toISOString(),
            version: current.profile.version + 1
          }
        }), (next) => queueProfileUpdate(next.profile))
      },
      setPreferredWeekdays(weekdays) {
        applyState((current) => ({
          ...current,
          profile: { ...current.profile, preferredWeekdays: weekdays, updatedAt: new Date().toISOString(), version: current.profile.version + 1 }
        }), (next) => queueProfileUpdate(next.profile))
      },
      replaceState(nextState) {
        stateRef.current = nextState
        setState(nextState)
        reportPersistence(saveStateV3(nextState), 'la sincronizacion')
      },
      patchSync(patch) {
        applyState((current) => ({ ...current, sync: { ...current.sync, ...patch } }), (next) => reportPersistence(saveMetaState(next), 'el estado de sincronizacion'))
      }
    }
  }, [applyState, state])

  if (!state || !value) return <main className="boot-screen"><span className="boot-mark">SBS</span><p>Cargando tu entrenamiento...</p></main>
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useAppState debe usarse dentro de AppStateProvider')
  return value
}
