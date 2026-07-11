import { openDB, type IDBPDatabase } from 'idb'
import type { AppStateV3 } from '../types/domain'
import { appStateV3Schema, createFreshState, migrateLegacyState, V3_DB_NAME } from './stateV3'

const DB_VERSION = 1
let databasePromise: Promise<IDBPDatabase> | null = null

function database(): Promise<IDBPDatabase> {
  databasePromise ||= openDB(V3_DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const store of ['meta', 'profiles', 'programs', 'schedule', 'logs', 'measurements', 'backups', 'syncQueue']) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
      }
    }
  })
  return databasePromise
}

export async function saveStateV3(state: AppStateV3): Promise<void> {
  const valid = appStateV3Schema.parse(state)
  const db = await database()
  const tx = db.transaction(['meta', 'profiles', 'programs', 'schedule', 'logs', 'measurements'], 'readwrite')
  const stores = {
    meta: tx.objectStore('meta'),
    profiles: tx.objectStore('profiles'),
    programs: tx.objectStore('programs'),
    schedule: tx.objectStore('schedule'),
    logs: tx.objectStore('logs'),
    measurements: tx.objectStore('measurements')
  }
  await Promise.all([stores.profiles.clear(), stores.programs.clear(), stores.schedule.clear(), stores.logs.clear(), stores.measurements.clear()])
  await stores.meta.put({
    schemaVersion: 3,
    activeProgramId: valid.activeProgramId,
    selectedSessionId: valid.selectedSessionId,
    completionSummary: valid.completionSummary,
    migrationCompletedAt: valid.migrationCompletedAt,
    sync: valid.sync
  }, 'app')
  await stores.profiles.put(valid.profile, valid.profile.id)
  await Promise.all(Object.values(valid.programs).map((program) => stores.programs.put(program, program.id)))
  await Promise.all(valid.schedule.map((session) => stores.schedule.put(session, session.id)))
  await Promise.all(Object.entries(valid.logs).map(([code, log]) => stores.logs.put(log, code)))
  await Promise.all(valid.measurements.map((measurement) => stores.measurements.put(measurement, measurement.id)))
  await tx.done
}

async function readV3(): Promise<AppStateV3 | null> {
  const db = await database()
  const meta = await db.get('meta', 'app')
  if (meta?.schemaVersion !== 3) return null
  const [profiles, programs, schedule, logKeys, logValues, measurements] = await Promise.all([
    db.getAll('profiles'),
    db.getAll('programs'),
    db.getAll('schedule'),
    db.getAllKeys('logs'),
    db.getAll('logs'),
    db.getAll('measurements')
  ])
  const logs = Object.fromEntries(logKeys.map((key, index) => [String(key), logValues[index]]))
  return appStateV3Schema.parse({
    schemaVersion: 3,
    profile: profiles[0],
    programs: Object.fromEntries(programs.map((program: any) => [program.id, program])),
    activeProgramId: meta.activeProgramId,
    schedule: schedule.sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex),
    logs,
    measurements,
    selectedSessionId: meta.selectedSessionId,
    completionSummary: meta.completionSummary,
    migrationCompletedAt: meta.migrationCompletedAt,
    sync: meta.sync
  })
}

export async function loadStateV3(): Promise<AppStateV3> {
  try {
    const existing = await readV3()
    if (existing) return existing
  } catch (error) {
    console.warn('No se pudo leer el estado v3; se intentará migrar el backup local.', error)
  }

  let raw: unknown = null
  if (typeof localStorage !== 'undefined') {
    const text = localStorage.getItem('sbs_strength_state_v2') || localStorage.getItem('sbs_strength_state_v1')
    if (text) {
      raw = JSON.parse(text)
      const db = await database()
      await db.put('backups', { source: 'localStorage', savedAt: new Date().toISOString(), raw: text }, `legacy-${Date.now()}`)
    }
  }
  const state = raw ? migrateLegacyState(raw) : createFreshState()
  await saveStateV3(state)
  return state
}

export async function resetV3(): Promise<AppStateV3> {
  const db = await database()
  const tx = db.transaction(['meta', 'profiles', 'programs', 'schedule', 'logs', 'measurements', 'syncQueue'], 'readwrite')
  await Promise.all([...tx.objectStoreNames].map((name) => tx.objectStore(name).clear()))
  await tx.done
  const fresh = createFreshState()
  await saveStateV3(fresh)
  return fresh
}
