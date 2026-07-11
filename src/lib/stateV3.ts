import { z } from 'zod'
import template from '../data/sbsRtfTemplate.json'
import { createDefaultSetup, listSessions, normalizeImportedSetup } from './sbsRtf.js'
import { evenlySpacedWeekdays, generateSchedule, isoLocalDate } from './schedule'
import type { AppStateV3, Profile, Program, ScheduledSession } from '../types/domain'

export const V3_DB_NAME = 'sbs-strength-v3'
export const V3_SCHEMA_VERSION = 3 as const

const syncSchema = z.object({
  enabled: z.boolean(),
  userId: z.string().nullable(),
  email: z.string().nullable(),
  cursor: z.number(),
  lastSyncedAt: z.string().nullable(),
  status: z.enum(['local', 'idle', 'syncing', 'offline', 'conflict', 'error']),
  error: z.string().nullable()
})

export const appStateV3Schema = z.object({
  schemaVersion: z.literal(3),
  profile: z.object({
    id: z.string(),
    units: z.enum(['kg', 'lb']),
    rounding: z.number(),
    timezone: z.string(),
    weekStartsOn: z.literal(1),
    theme: z.enum(['system', 'light', 'dark']),
    preferredWeekdays: z.array(z.number().int().min(0).max(6)),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.number().int().positive()
  }),
  programs: z.record(z.string(), z.object({
    id: z.string(),
    templateId: z.literal('sbs-rtf'),
    name: z.string(),
    status: z.enum(['active', 'archived']),
    setup: z.record(z.string(), z.any()),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.number().int().positive()
  })),
  activeProgramId: z.string(),
  schedule: z.array(z.object({
    id: z.string(),
    programId: z.string(),
    code: z.string(),
    sequenceIndex: z.number().int().nonnegative(),
    week: z.number().int().positive(),
    day: z.number().int().positive(),
    scheduledDate: z.string(),
    status: z.enum(['planned', 'draft', 'completed', 'skipped']),
    deload: z.boolean(),
    skippedReason: z.string().optional(),
    prescriptionSnapshot: z.record(z.string(), z.any()).nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.number().int().positive()
  })),
  logs: z.record(z.string(), z.any()),
  measurements: z.array(z.object({
    id: z.string(),
    kind: z.literal('bodyweight'),
    value: z.number().positive(),
    unit: z.enum(['kg', 'lb']),
    measuredAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    version: z.number().int().positive()
  })),
  selectedSessionId: z.string().nullable(),
  completionSummary: z.any().nullable(),
  migrationCompletedAt: z.string(),
  sync: syncSchema
})

export function makeId(): string {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  } catch {
    return 'Europe/Madrid'
  }
}

function baseSync(): AppStateV3['sync'] {
  return {
    enabled: false,
    userId: null,
    email: null,
    cursor: 0,
    lastSyncedAt: null,
    status: 'local',
    error: null
  }
}

export function createFreshState(): AppStateV3 {
  const now = new Date().toISOString()
  const setup = createDefaultSetup(template)
  const programId = makeId()
  const preferredWeekdays = evenlySpacedWeekdays(Number(setup.frequency))
  const profile: Profile = {
    id: makeId(),
    units: setup.units === 'lb' ? 'lb' : 'kg',
    rounding: Number(setup.rounding),
    timezone: timezone(),
    weekStartsOn: 1,
    theme: 'system',
    preferredWeekdays,
    createdAt: now,
    updatedAt: now,
    version: 1
  }
  const program: Program = {
    id: programId,
    templateId: 'sbs-rtf',
    name: 'SBS Strength RTF',
    status: 'active',
    setup,
    createdAt: now,
    updatedAt: now,
    version: 1
  }
  return {
    schemaVersion: 3,
    profile,
    programs: { [programId]: program },
    activeProgramId: programId,
    schedule: generateSchedule(listSessions(template, setup), programId, isoLocalDate(new Date()), preferredWeekdays),
    logs: {},
    measurements: [],
    selectedSessionId: 'W1D1',
    completionSummary: null,
    migrationCompletedAt: now,
    sync: baseSync()
  }
}

function historicalDate(log: any): string | null {
  const timestamp = log?.completedAt || log?.startedAt
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null
  return isoLocalDate(new Date(timestamp))
}

export function migrateLegacyState(input: unknown): AppStateV3 {
  const exported = input && typeof input === 'object' && 'state' in input ? (input as any).state : input
  if (!exported || typeof exported !== 'object' || !(exported as any).setup) return createFreshState()

  const now = new Date().toISOString()
  const legacy = exported as any
  const setup = normalizeImportedSetup(template, legacy.setup)
  const logs = legacy.logs && typeof legacy.logs === 'object' ? structuredClone(legacy.logs) : {}
  const programId = makeId()
  const preferredWeekdays = evenlySpacedWeekdays(Number(setup.frequency))
  const generated = generateSchedule(listSessions(template, setup), programId, isoLocalDate(new Date()), preferredWeekdays)
  const schedule: ScheduledSession[] = generated.map((session) => {
    const log = logs[session.code]
    const status = log?.status === 'completed' ? 'completed' : log ? 'draft' : 'planned'
    return {
      ...session,
      scheduledDate: historicalDate(log) || session.scheduledDate,
      status,
      updatedAt: log?.updatedAt || session.updatedAt
    }
  })

  for (const log of Object.values<any>(logs)) {
    if (log?.status === 'completed' && log.activeSeconds === undefined) log.legacyDuration = true
  }

  const profile: Profile = {
    id: makeId(),
    units: setup.units === 'lb' ? 'lb' : 'kg',
    rounding: Number(setup.rounding) || (setup.units === 'lb' ? 5 : 2.5),
    timezone: timezone(),
    weekStartsOn: 1,
    theme: 'system',
    preferredWeekdays,
    createdAt: now,
    updatedAt: now,
    version: 1
  }
  const program: Program = {
    id: programId,
    templateId: 'sbs-rtf',
    name: 'SBS Strength RTF',
    status: 'active',
    setup,
    createdAt: setup.completedAt || now,
    updatedAt: now,
    version: 1
  }
  return appStateV3Schema.parse({
    schemaVersion: 3,
    profile,
    programs: { [programId]: program },
    activeProgramId: programId,
    schedule,
    logs,
    measurements: [],
    selectedSessionId: legacy.selectedSessionId || schedule.find((session) => session.status !== 'completed')?.code || schedule.at(-1)?.code || null,
    completionSummary: null,
    migrationCompletedAt: now,
    sync: baseSync()
  })
}

export function normalizeV3State(input: unknown): AppStateV3 {
  return appStateV3Schema.parse(input)
}

export function exportV3State(state: AppStateV3): string {
  return JSON.stringify({ app: 'sbs-strength', version: 3, exportedAt: new Date().toISOString(), state }, null, 2)
}

export function parseStateImport(text: string): AppStateV3 {
  const parsed = JSON.parse(text)
  if (parsed?.version === 3 || parsed?.state?.schemaVersion === 3) return normalizeV3State(parsed.state || parsed)
  return migrateLegacyState(parsed)
}
