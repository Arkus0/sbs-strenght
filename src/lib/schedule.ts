import type { ScheduledSession } from '../types/domain'

const DAY_MS = 86_400_000

export function isoLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function addLocalDays(value: string, days: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return isoLocalDate(date)
}

export function evenlySpacedWeekdays(frequency: number): number[] {
  const defaults: Record<number, number[]> = {
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6]
  }
  return defaults[frequency] || defaults[3]
}

function nextMatchingDate(start: string, weekdays: Set<number>): string {
  let cursor = start
  for (let offset = 0; offset < 8; offset += 1) {
    const day = parseLocalDate(cursor).getDay()
    if (weekdays.has(day)) return cursor
    cursor = addLocalDays(cursor, 1)
  }
  return start
}

export function generateSchedule(
  sessions: Array<{ id: string; week: number; day: number; deload: boolean }>,
  programId: string,
  startDate: string,
  preferredWeekdays: number[],
  idFactory: () => string = () => crypto.randomUUID()
): ScheduledSession[] {
  const weekdays = new Set(preferredWeekdays)
  let cursor = nextMatchingDate(startDate, weekdays)
  const now = new Date().toISOString()
  return sessions.map((session, sequenceIndex) => {
    if (sequenceIndex > 0) cursor = nextMatchingDate(addLocalDays(cursor, 1), weekdays)
    return {
      id: idFactory(),
      programId,
      code: session.id,
      sequenceIndex,
      week: session.week,
      day: session.day,
      scheduledDate: cursor,
      status: 'planned',
      deload: session.deload,
      prescriptionSnapshot: null,
      createdAt: now,
      updatedAt: now,
      version: 1
    }
  })
}

export function reprogramSession(schedule: ScheduledSession[], id: string, scheduledDate: string): ScheduledSession[] {
  return schedule.map((session) => session.id === id
    ? { ...session, scheduledDate, updatedAt: new Date().toISOString(), version: session.version + 1 }
    : session)
}

export function redistributeFutureSessions(
  schedule: ScheduledSession[],
  fromSequence: number,
  startDate: string,
  weekdays: number[]
): ScheduledSession[] {
  const fixed = schedule.filter((session) => session.sequenceIndex < fromSequence)
  const future = schedule.filter((session) => session.sequenceIndex >= fromSequence)
  const regenerated = generateSchedule(future, future[0]?.programId || '', startDate, weekdays, () => '')
  const now = new Date().toISOString()
  return [...fixed, ...future.map((session, index) => ({
    ...session,
    scheduledDate: regenerated[index].scheduledDate,
    updatedAt: now,
    version: session.version + 1
  }))].sort((a, b) => a.sequenceIndex - b.sequenceIndex)
}

export function startOfIsoWeek(value: string): string {
  const date = parseLocalDate(value)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return isoLocalDate(date)
}

export function sameIsoWeek(a: string, b: string): boolean {
  return startOfIsoWeek(a) === startOfIsoWeek(b)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / DAY_MS)
}
