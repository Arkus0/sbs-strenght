import type { User } from '@supabase/supabase-js'
import type { AppStateV3, Program, ScheduledSession } from '../types/domain'
import { appStateV3Schema } from '../lib/stateV3'
import { supabase } from './supabaseClient'

interface RemoteRow {
  id?: string
  user_id: string
  payload: any
  version: number
  change_version?: number
  updated_at: string
  deleted_at?: string | null
  program_id?: string
}

export interface SyncResult {
  state: AppStateV3
  conflicts: Array<{ entity: string; id: string; local: any; remote: any }>
}

function newer(local: { version?: number; updatedAt?: string }, remote: RemoteRow): boolean {
  return remote.version > Number(local.version || 0)
}

export async function sendEmailOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado en este despliegue.')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyEmailOtp(email: string, token: string): Promise<User> {
  if (!supabase) throw new Error('Supabase no está configurado en este despliegue.')
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  if (!data.user) throw new Error('No se pudo iniciar la sesión.')
  return data.user
}

async function fetchRows(table: string, cursor: number): Promise<RemoteRow[]> {
  if (!supabase) return []
  let query = supabase.from(table).select('*').order('change_version', { ascending: true })
  if (cursor > 0) query = query.gt('change_version', cursor)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as RemoteRow[]
}

async function upsertRows(table: string, rows: RemoteRow[]): Promise<void> {
  if (!supabase || !rows.length) return
  const { error } = await supabase.from(table).upsert(rows, { onConflict: table === 'profiles' ? 'user_id' : 'id' })
  if (error) throw error
}

export async function synchronize(localState: AppStateV3, user: User): Promise<SyncResult> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const state = structuredClone(localState)
  const cursor = state.sync.cursor || 0
  const [profileRows, programRows, sessionRows, measurementRows] = await Promise.all([
    fetchRows('profiles', cursor), fetchRows('programs', cursor), fetchRows('sessions', cursor), fetchRows('measurements', cursor)
  ])
  const conflicts: SyncResult['conflicts'] = []
  let maxCursor = cursor
  for (const row of [...profileRows, ...programRows, ...sessionRows, ...measurementRows]) maxCursor = Math.max(maxCursor, Number(row.change_version || 0))

  const profileRow = profileRows.find((row) => row.user_id === user.id && !row.deleted_at)
  if (profileRow && newer(state.profile, profileRow)) state.profile = profileRow.payload

  for (const row of programRows.filter((item) => !item.deleted_at)) {
    const local = state.programs[row.id!]
    if (!local) state.programs[row.id!] = row.payload as Program
    else if (newer(local, row)) conflicts.push({ entity: 'program', id: row.id!, local, remote: row.payload })
  }

  for (const row of sessionRows.filter((item) => !item.deleted_at)) {
    const remote = row.payload as { schedule: ScheduledSession; log?: any }
    const localSchedule = state.schedule.find((session) => session.id === row.id)
    if (!localSchedule) {
      state.schedule.push(remote.schedule)
      if (remote.log) state.logs[remote.schedule.code] = remote.log
      continue
    }
    const localLog = state.logs[localSchedule.code]
    if (remote.log?.status === 'completed' && localLog?.status !== 'completed') {
      state.schedule = state.schedule.map((session) => session.id === row.id ? remote.schedule : session)
      state.logs[remote.schedule.code] = remote.log
    } else if (newer(localSchedule, row)) {
      conflicts.push({ entity: 'session', id: row.id!, local: { schedule: localSchedule, log: localLog }, remote })
    }
  }

  for (const row of measurementRows.filter((item) => !item.deleted_at)) {
    const local = state.measurements.find((measurement) => measurement.id === row.id)
    if (!local) state.measurements.push(row.payload)
    else if (newer(local, row)) conflicts.push({ entity: 'measurement', id: row.id!, local, remote: row.payload })
  }

  const now = new Date().toISOString()
  const merged = appStateV3Schema.parse({
    ...state,
    schedule: state.schedule.sort((a, b) => a.sequenceIndex - b.sequenceIndex),
    sync: { ...state.sync, enabled: true, userId: user.id, email: user.email || null, cursor: maxCursor, status: conflicts.length ? 'conflict' : 'idle', lastSyncedAt: now, error: null }
  })

  await Promise.all([
    upsertRows('profiles', [{ user_id: user.id, payload: merged.profile, version: merged.profile.version, updated_at: merged.profile.updatedAt }]),
    upsertRows('programs', Object.values(merged.programs).map((program) => ({ id: program.id, user_id: user.id, payload: program, version: program.version, updated_at: program.updatedAt })))
  ])
  await Promise.all([
    upsertRows('sessions', merged.schedule.map((session) => ({ id: session.id, user_id: user.id, program_id: session.programId, payload: { schedule: session, log: merged.logs[session.code] || null }, version: session.version, updated_at: session.updatedAt }))),
    upsertRows('measurements', merged.measurements.map((measurement) => ({ id: measurement.id, user_id: user.id, payload: measurement, version: measurement.version, updated_at: measurement.updatedAt })))
  ])
  return { state: merged, conflicts }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
