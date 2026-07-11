import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import template from '../data/sbsRtfTemplate.json'
import { buildSessionPlan, isSetupComplete, listSessions, parseSessionId } from '../lib/sbsRtf.js'
import { loadStateV3, resetV3, saveStateV3 } from '../lib/repository'
import { generateSchedule, isoLocalDate, reprogramSession, redistributeFutureSessions } from '../lib/schedule'
import { makeId, parseStateImport } from '../lib/stateV3'
import type { AppStateV3, CompletionSummary, Measurement, ScheduledSession } from '../types/domain'

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
  addBodyweight: (value: number) => void
  dismissSummary: () => void
  importState: (text: string) => void
  resetAll: () => Promise<void>
  setTheme: (theme: AppStateV3['profile']['theme']) => void
  setPreferredWeekdays: (weekdays: number[]) => void
  replaceState: (state: AppStateV3) => void
  patchSync: (patch: Partial<AppStateV3['sync']>) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppStateProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AppStateV3 | null>(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    loadStateV3().then((loaded) => {
      if (active) setState(loaded)
    }).catch((error) => {
      console.error('No se pudo iniciar SBS Strength', error)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!state) return undefined
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveStateV3(state).catch((error) => console.error('Error de autoguardado', error))
    }, 180)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state])

  const theme = state?.profile.theme
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
  }, [theme])

  const value = useMemo<AppContextValue | null>(() => {
    if (!state) return null
    const activeProgram = state.programs[state.activeProgramId]
    const setup = activeProgram.setup

    function updateSetup(nextSetup: Record<string, any>): void {
      setState((current) => {
        if (!current) return current
        const program = current.programs[current.activeProgramId]
        return {
          ...current,
          profile: {
            ...current.profile,
            units: nextSetup.units === 'lb' ? 'lb' : 'kg',
            rounding: Number(nextSetup.rounding) || current.profile.rounding,
            updatedAt: new Date().toISOString(),
            version: current.profile.version + 1
          },
          programs: {
            ...current.programs,
            [program.id]: { ...program, setup: nextSetup, updatedAt: new Date().toISOString(), version: program.version + 1 }
          },
          schedule: current.schedule.map((session) => ({ ...session, prescriptionSnapshot: null }))
        }
      })
    }

    function completeSetup(nextDate = isoLocalDate(new Date())): void {
      setState((current) => {
        if (!current) return current
        const program = current.programs[current.activeProgramId]
        const completedAt = new Date().toISOString()
        const completedSetup = { ...program.setup, completedAt, singlePctReviewRequired: false, singlePctReviewedAt: completedAt }
        const next: AppStateV3 = {
          ...current,
          programs: {
            ...current.programs,
            [program.id]: { ...program, setup: completedSetup, updatedAt: new Date().toISOString(), version: program.version + 1 }
          },
          schedule: generateSchedule(listSessions(template, completedSetup), program.id, nextDate, current.profile.preferredWeekdays),
          selectedSessionId: 'W1D1'
        }
        void saveStateV3(next)
        return next
      })
    }

    function updateLog(log: any): void {
      setState((current) => {
        if (!current) return current
        const parsed = parseSessionId(log.id)
        const scheduled = current.schedule.find((session) => session.code === log.id)
        let snapshot = scheduled?.prescriptionSnapshot
        if (!current.logs[log.id] && parsed && !snapshot) {
          snapshot = structuredClone(buildSessionPlan(template, setup, current.logs, parsed.week, parsed.day))
        }
        return {
          ...current,
          logs: { ...current.logs, [log.id]: log },
          schedule: current.schedule.map((session) => session.code === log.id
            ? {
                ...session,
                status: log.status === 'completed' ? 'completed' : 'draft',
                prescriptionSnapshot: snapshot || session.prescriptionSnapshot,
                updatedAt: log.updatedAt || new Date().toISOString(),
                version: session.version + 1
              }
            : session)
        }
      })
    }

    async function completeLog(log: any, summary: CompletionSummary): Promise<void> {
      const enriched = { ...log, completionSummary: summary, activeSeconds: log.activeSeconds ?? summary.durationSeconds }
      const current = state as AppStateV3
      const schedule = current.schedule.map((session) => session.code === log.id
          ? { ...session, status: 'completed' as const, updatedAt: log.completedAt, version: session.version + 1 }
          : session)
      const next = schedule.find((session) => session.status !== 'completed' && session.status !== 'skipped')
      const nextState: AppStateV3 = {
        ...current,
        logs: { ...current.logs, [log.id]: enriched },
        schedule,
        selectedSessionId: next?.code || current.selectedSessionId,
        completionSummary: summary
      }
      await saveStateV3(nextState)
      setState(nextState)
    }

    async function discardLog(code: string): Promise<void> {
      const current = state as AppStateV3
      const logs = { ...current.logs }
      delete logs[code]
      const nextState: AppStateV3 = {
        ...current,
        logs,
        schedule: current.schedule.map((session) => session.code === code
          ? { ...session, status: 'planned' as const, prescriptionSnapshot: null, updatedAt: new Date().toISOString(), version: session.version + 1 }
          : session)
      }
      await saveStateV3(nextState)
      setState(nextState)
    }

    function addBodyweight(value: number): void {
      if (!(value > 0)) return
      const now = new Date().toISOString()
      const measurement: Measurement = {
        id: makeId(), kind: 'bodyweight', value, unit: setup.units === 'lb' ? 'lb' : 'kg', measuredAt: now,
        createdAt: now, updatedAt: now, version: 1
      }
      setState((current) => current ? { ...current, measurements: [...current.measurements, measurement] } : current)
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
        setState((current) => {
          if (!current) return current
          const next = { ...current, schedule: reprogramSession(current.schedule, id, date) }
          void saveStateV3(next)
          return next
        })
      },
      redistribute(fromSequence, date, weekdays = state.profile.preferredWeekdays) {
        setState((current) => current ? { ...current, schedule: redistributeFutureSessions(current.schedule, fromSequence, date, weekdays) } : current)
      },
      skipSession(id, reason) {
        setState((current) => current ? {
          ...current,
          schedule: current.schedule.map((session) => session.id === id
            ? { ...session, status: 'skipped' as const, skippedReason: reason || 'Omitida', updatedAt: new Date().toISOString(), version: session.version + 1 }
            : session)
        } : current)
      },
      addBodyweight,
      dismissSummary() { setState((current) => current ? { ...current, completionSummary: null } : current) },
      importState(text) { setState(parseStateImport(text)) },
      async resetAll() { setState(await resetV3()) },
      setTheme(theme) {
        setState((current) => current ? { ...current, profile: { ...current.profile, theme, updatedAt: new Date().toISOString(), version: current.profile.version + 1 } } : current)
      },
      setPreferredWeekdays(weekdays) {
        setState((current) => current ? { ...current, profile: { ...current.profile, preferredWeekdays: weekdays, updatedAt: new Date().toISOString(), version: current.profile.version + 1 } } : current)
      },
      replaceState(nextState) { setState(nextState) },
      patchSync(patch) { setState((current) => current ? { ...current, sync: { ...current.sync, ...patch } } : current) }
    }
  }, [state])

  if (!state || !value) return <main className="boot-screen"><span className="boot-mark">SBS</span><p>Cargando tu entrenamiento…</p></main>
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useAppState debe usarse dentro de AppStateProvider')
  return value
}
