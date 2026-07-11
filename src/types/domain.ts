export type ThemePreference = 'system' | 'light' | 'dark'
export type SessionStatus = 'planned' | 'draft' | 'completed' | 'skipped'

export interface Profile {
  id: string
  units: 'kg' | 'lb'
  rounding: number
  timezone: string
  weekStartsOn: 1
  theme: ThemePreference
  preferredWeekdays: number[]
  createdAt: string
  updatedAt: string
  version: number
}

export interface Program {
  id: string
  templateId: 'sbs-rtf'
  name: string
  status: 'active' | 'archived'
  setup: Record<string, any>
  createdAt: string
  updatedAt: string
  version: number
}

export interface ScheduledSession {
  id: string
  programId: string
  code: string
  sequenceIndex: number
  week: number
  day: number
  scheduledDate: string
  status: SessionStatus
  deload: boolean
  skippedReason?: string
  prescriptionSnapshot?: Record<string, any> | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface Measurement {
  id: string
  kind: 'bodyweight'
  value: number
  unit: 'kg' | 'lb'
  measuredAt: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface CompletionSummary {
  id: string
  durationSeconds: number | null
  completedSets: number
  totalSets: number
  exerciseCount: number
}

export interface SyncState {
  enabled: boolean
  userId: string | null
  email: string | null
  cursor: number
  lastSyncedAt: string | null
  status: 'local' | 'idle' | 'syncing' | 'offline' | 'conflict' | 'error'
  error: string | null
}

export interface AppStateV3 {
  schemaVersion: 3
  profile: Profile
  programs: Record<string, Program>
  activeProgramId: string
  schedule: ScheduledSession[]
  logs: Record<string, any>
  measurements: Measurement[]
  selectedSessionId: string | null
  completionSummary: CompletionSummary | null
  migrationCompletedAt: string
  sync: SyncState
}

export interface AccessoryHistoryEntry {
  sessionId: string
  load: number | null
  repMin: number
  repMax: number
  deload: boolean
  status: 'performed' | 'unavailable' | 'pain' | 'skipped'
  sets: Array<{ done: boolean; reps: number | null }>
}

export interface AccessoryRecommendation {
  action: 'choose' | 'increase' | 'repeat' | 'reduce' | 'deload'
  recommendedLoad: number | null
  targetTotalReps: number | null
  reason: string
  sourceSessionIds: string[]
}

export interface AnalyticsSnapshot {
  completionPct: number
  adherencePct: number
  completedSessions: number
  scheduledToDate: number
  conditioningCompleted: number
  completedSets: number
  medianActiveSeconds: number | null
  weekly: Array<{ week: number; sessions: number; tonnage: number; sets: number }>
  liftSeries: Record<string, Array<{ sessionId: string; week: number; tm: number | null; e1rm: number | null; weight: number | null }>>
  accessorySeries: Record<string, Array<{ sessionId: string; name: string; load: number | null; totalReps: number; atTop: boolean }>>
  records: Array<{ id: string; kind: 'e1rm' | 'load' | 'reps'; exercise: string; value: number; sessionId: string }>
}
