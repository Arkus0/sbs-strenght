import { openDB, type IDBPDatabase } from 'idb'
import type { AppStateV3, Profile, Program, ScheduledSession } from '../types/domain'
import { appStateV3Schema, createFreshState, migrateLegacyState, upgradeProgressionState, V3_DB_NAME } from './stateV3'

const DB_VERSION = 1
let databasePromise: Promise<IDBPDatabase> | null = null
let writeQueue: Promise<void> = Promise.resolve()

interface PendingDraft {
  code: string
  log: any
  session: ScheduledSession
  timer: ReturnType<typeof setTimeout>
}

interface PendingEntityWrite {
  timer: ReturnType<typeof setTimeout>
  write: () => Promise<void>
}

const pendingDrafts = new Map<string, PendingDraft>()
const pendingEntityWrites = new Map<string, PendingEntityWrite>()

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

function appMeta(state: AppStateV3): Record<string, unknown> {
  return {
    schemaVersion: 3,
    activeProgramId: state.activeProgramId,
    selectedSessionId: state.selectedSessionId,
    completionSummary: state.completionSummary,
    migrationCompletedAt: state.migrationCompletedAt,
    sync: state.sync
  }
}

function enqueueWrite(write: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(write)
  return writeQueue
}

async function writeFullState(state: AppStateV3): Promise<void> {
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
  await stores.meta.put(appMeta(valid), 'app')
  await stores.profiles.put(valid.profile, valid.profile.id)
  await Promise.all(Object.values(valid.programs).map((program) => stores.programs.put(program, program.id)))
  await Promise.all(valid.schedule.map((session) => stores.schedule.put(session, session.id)))
  await Promise.all(Object.entries(valid.logs).map(([code, log]) => stores.logs.put(log, code)))
  await Promise.all(valid.measurements.map((measurement) => stores.measurements.put(measurement, measurement.id)))
  await tx.done
}

async function writeDraft({ code, log, session }: Omit<PendingDraft, 'timer'>): Promise<void> {
  const db = await database()
  const tx = db.transaction(['logs', 'schedule'], 'readwrite')
  await Promise.all([
    tx.objectStore('logs').put(log, code),
    tx.objectStore('schedule').put(session, session.id)
  ])
  await tx.done
}

async function flushDraft(code: string): Promise<void> {
  const pending = pendingDrafts.get(code)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingDrafts.delete(code)
  await enqueueWrite(() => writeDraft(pending))
}

function queueEntityWrite(key: string, write: () => Promise<void>, delayMs: number): void {
  const previous = pendingEntityWrites.get(key)
  if (previous) clearTimeout(previous.timer)
  const timer = setTimeout(() => {
    const pending = pendingEntityWrites.get(key)
    if (!pending) return
    pendingEntityWrites.delete(key)
    void enqueueWrite(pending.write)
  }, delayMs)
  pendingEntityWrites.set(key, { timer, write })
}

async function flushEntityWrite(key: string): Promise<void> {
  const pending = pendingEntityWrites.get(key)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingEntityWrites.delete(key)
  await enqueueWrite(pending.write)
}

export function queueSessionDraft(log: any, session: ScheduledSession, delayMs = 180): void {
  const code = String(log.id || session.code)
  const previous = pendingDrafts.get(code)
  if (previous) clearTimeout(previous.timer)
  const timer = setTimeout(() => {
    const pending = pendingDrafts.get(code)
    if (!pending) return
    pendingDrafts.delete(code)
    void enqueueWrite(() => writeDraft(pending))
  }, delayMs)
  pendingDrafts.set(code, { code, log, session, timer })
}

export async function flushPendingWrites(): Promise<void> {
  const codes = [...pendingDrafts.keys()]
  for (const code of codes) await flushDraft(code)
  const entityKeys = [...pendingEntityWrites.keys()]
  for (const key of entityKeys) await flushEntityWrite(key)
  await writeQueue
}

export async function saveStateV3(state: AppStateV3): Promise<void> {
  await flushPendingWrites()
  await enqueueWrite(() => writeFullState(state))
}

export function queueProfileUpdate(profile: Profile, delayMs = 180): void {
  queueEntityWrite('profile', async () => {
    const db = await database()
    await db.put('profiles', profile, profile.id)
  }, delayMs)
}

export function queueProgramUpdate(profile: Profile, program: Program, sessions: ScheduledSession[], delayMs = 180): void {
  queueEntityWrite(`program:${program.id}`, async () => {
    const db = await database()
    const tx = db.transaction(['profiles', 'programs', 'schedule'], 'readwrite')
    await Promise.all([
      tx.objectStore('profiles').put(profile, profile.id),
      tx.objectStore('programs').put(program, program.id),
      ...sessions.map((session) => tx.objectStore('schedule').put(session, session.id))
    ])
    await tx.done
  }, delayMs)
}

export function saveScheduleUpdates(sessions: ScheduledSession[]): Promise<void> {
  if (!sessions.length) return writeQueue
  return enqueueWrite(async () => {
    const db = await database()
    const tx = db.transaction('schedule', 'readwrite')
    await Promise.all(sessions.map((session) => tx.store.put(session, session.id)))
    await tx.done
  })
}

export function saveMetaState(state: AppStateV3): Promise<void> {
  return enqueueWrite(async () => {
    const db = await database()
    await db.put('meta', appMeta(state), 'app')
  })
}

export async function saveSessionState(state: AppStateV3, code: string): Promise<void> {
  await flushDraft(code)
  const valid = appStateV3Schema.parse(state)
  const session = valid.schedule.find((item) => item.code === code)
  const log = valid.logs[code]
  if (!session || !log) throw new Error(`No se pudo persistir la sesion ${code}.`)
  await enqueueWrite(async () => {
    const db = await database()
    const tx = db.transaction(['meta', 'schedule', 'logs'], 'readwrite')
    await Promise.all([
      tx.objectStore('meta').put(appMeta(valid), 'app'),
      tx.objectStore('schedule').put(session, session.id),
      tx.objectStore('logs').put(log, code)
    ])
    await tx.done
  })
}

export async function deleteSessionState(state: AppStateV3, code: string): Promise<void> {
  await flushDraft(code)
  const session = state.schedule.find((item) => item.code === code)
  if (!session) throw new Error(`No se pudo descartar la sesion ${code}.`)
  await enqueueWrite(async () => {
    const db = await database()
    const tx = db.transaction(['meta', 'schedule', 'logs'], 'readwrite')
    await Promise.all([
      tx.objectStore('meta').put(appMeta(state), 'app'),
      tx.objectStore('schedule').put(session, session.id),
      tx.objectStore('logs').delete(code)
    ])
    await tx.done
  })
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
  return upgradeProgressionState(appStateV3Schema.parse({
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
  }))
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
  await flushPendingWrites()
  const fresh = createFreshState()
  await enqueueWrite(async () => {
    const db = await database()
    const tx = db.transaction(['meta', 'profiles', 'programs', 'schedule', 'logs', 'measurements', 'syncQueue'], 'readwrite')
    await Promise.all([...tx.objectStoreNames].map((name) => tx.objectStore(name).clear()))
    await tx.done
    await writeFullState(fresh)
  })
  return fresh
}
