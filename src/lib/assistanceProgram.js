import {
  ACCESSORY_EXERCISES,
  BACK_EXERCISES,
  bodybuildingExercise
} from '../data/bodybuildingCatalog.js'
import { alsruheConditioningCatalog, timerFromConditioning } from '../data/specimenAssistance.js'

export const ASSISTANCE_BLOCKS = [
  { id: 'block-1', label: 'Bloque 1', workWeeks: [1, 2, 3, 4, 5, 6], deloadWeek: 7 },
  { id: 'block-2', label: 'Bloque 2', workWeeks: [8, 9, 10, 11, 12, 13], deloadWeek: 14 },
  { id: 'block-3', label: 'Bloque 3', workWeeks: [15, 16, 17, 18, 19, 20], deloadWeek: 21 }
]

const SLOT_FOCUS = {
  main_1: 'squat',
  aux_1: 'squat',
  aux_2: 'squat',
  main_3: 'hinge',
  aux_5: 'hinge',
  main_2: 'press',
  aux_3: 'press',
  aux_4: 'press',
  main_4: 'overhead',
  aux_6: 'overhead'
}

const FOCUS_CATEGORIES = {
  squat: ['quads', 'hamstrings', 'calves'],
  hinge: ['hamstrings', 'glutes', 'core'],
  press: ['triceps', 'chest', 'rear_delts'],
  overhead: ['lateral_delts', 'triceps', 'rear_delts']
}

const BALANCE_CATEGORIES = [
  'biceps',
  'lateral_delts',
  'rear_delts',
  'hamstrings',
  'quads',
  'triceps',
  'core',
  'calves',
  'chest',
  'glutes'
]

const HIGH_VALUE_CONDITIONING_TAGS = ['sandbag', 'grip', 'carry', 'calisthenics', 'core', 'locomotion']

function unique(items) {
  return [...new Set(items)]
}

function focusForSlot(slotId) {
  return SLOT_FOCUS[slotId] || 'general'
}

function poolForCategory(category) {
  return ACCESSORY_EXERCISES.filter((exercise) => exercise.category === category)
}

function deterministicPick(pool, seed) {
  if (!pool.length) return null
  return pool[Math.abs(seed) % pool.length]
}

export function assistanceBlockForWeek(week) {
  const numericWeek = Number(week)
  return ASSISTANCE_BLOCKS.find((block) => block.workWeeks.includes(numericWeek) || block.deloadWeek === numericWeek) || ASSISTANCE_BLOCKS[0]
}

export function accessoryCountForLiftCount(liftCount) {
  return Math.min(3, Math.max(1, 5 - Number(liftCount || 0)))
}

export function createAssistanceBlocks(template, frequency) {
  const numericFrequency = Number(frequency || 3)
  const layout = template.layouts[String(numericFrequency)] || template.layouts['3']

  return Object.fromEntries(ASSISTANCE_BLOCKS.map((block, blockIndex) => {
    const categoryUse = {}
    const days = {}

    for (const [dayIndex, day] of layout.days.entries()) {
      const focuses = unique(day.lifts.map((lift) => focusForSlot(lift.slotId)))
      const wantsVertical = (dayIndex + blockIndex) % 2 === 1
      const backPool = wantsVertical
        ? BACK_EXERCISES.filter((exercise) => exercise.category === 'vertical_pull')
        : BACK_EXERCISES.filter((exercise) => exercise.category === 'horizontal_pull' && exercise.tags.includes('supported'))
      const backExercise = deterministicPick(backPool, blockIndex + dayIndex)
      const count = accessoryCountForLiftCount(day.lifts.length)
      const relevantCategories = unique([
        ...focuses.flatMap((focus) => FOCUS_CATEGORIES[focus] || []),
        ...BALANCE_CATEGORIES
      ])
      const selectedCategories = []
      const accessoryExerciseIds = []

      for (let slot = 0; slot < count; slot += 1) {
        const category = relevantCategories
          .filter((candidate) => !selectedCategories.includes(candidate) && poolForCategory(candidate).length)
          .sort((a, b) => (categoryUse[a] || 0) - (categoryUse[b] || 0) || relevantCategories.indexOf(a) - relevantCategories.indexOf(b))[0]
        if (!category) break
        const pool = poolForCategory(category)
        const exercise = deterministicPick(pool, blockIndex * 7 + dayIndex + slot)
        selectedCategories.push(category)
        categoryUse[category] = (categoryUse[category] || 0) + 1
        if (exercise) accessoryExerciseIds.push(exercise.id)
      }

      days[String(day.day)] = {
        day: day.day,
        focus: focuses,
        backExerciseId: backExercise?.id || BACK_EXERCISES[0].id,
        accessoryExerciseIds
      }
    }

    return [block.id, {
      ...block,
      frequency: numericFrequency,
      days
    }]
  }))
}

export function ensureAssistanceBlocks(template, setup) {
  const current = setup?.assistanceBlocks
  const valid = current && ASSISTANCE_BLOCKS.every((block) => current[block.id]?.frequency === Number(setup.frequency))
  return valid ? current : createAssistanceBlocks(template, setup?.frequency || 3)
}

function parseLogPosition(log) {
  const match = String(log?.id || '').match(/^W(\d+)D(\d+)$/)
  return match ? { week: Number(match[1]), day: Number(match[2]) } : null
}

function beforePlan(log, plan) {
  const position = parseLogPosition(log)
  if (!position) return false
  return position.week < plan.week || (position.week === plan.week && position.day < plan.day)
}

export function previousBodybuildingLog(logs, exerciseId, plan) {
  return Object.values(logs || {})
    .filter((log) => beforePlan(log, plan))
    .sort((a, b) => {
      const aa = parseLogPosition(a)
      const bb = parseLogPosition(b)
      return bb.week - aa.week || bb.day - aa.day
    })
    .flatMap((log) => (log.bodybuilding || []).map((item) => ({ ...item, sessionId: log.id })))
    .find((item) => item.exerciseId === exerciseId) || null
}

export function completedAtTop(item) {
  if (!item || item.deload || !Array.isArray(item.sets) || !item.sets.length) return false
  return item.sets.every((set) => set.done && Number(set.reps) >= Number(item.repMax))
}

export function bodybuildingForSession(setup, plan, logs = {}) {
  const blocks = setup?.assistanceBlocks || {}
  const blockId = assistanceBlockForWeek(plan.week).id
  const dayPlan = blocks?.[blockId]?.days?.[String(plan.day)]
  if (!dayPlan) return []
  const ids = [dayPlan.backExerciseId, ...(dayPlan.accessoryExerciseIds || [])]

  return ids.map((exerciseId, index) => {
    const exercise = bodybuildingExercise(exerciseId)
    if (!exercise) return null
    const previous = previousBodybuildingLog(logs, exerciseId, plan)
    const readyToIncrease = completedAtTop(previous)
    return {
      slotKey: index === 0 ? 'back' : `accessory-${index}`,
      role: index === 0 ? 'back' : 'accessory',
      exerciseId,
      name: exercise.name,
      category: exercise.category,
      tags: exercise.tags,
      repMin: exercise.repMin,
      repMax: exercise.repMax,
      loadMode: exercise.loadMode,
      targetSets: plan.deload ? 2 : 3,
      deload: plan.deload,
      previousLoad: previous?.load ?? '',
      previousSessionId: previous?.sessionId || '',
      progressionAction: readyToIncrease ? 'increase' : previous ? 'repeat' : 'choose'
    }
  }).filter(Boolean)
}

export function normalizeBodybuildingItems(prescription, existing = []) {
  return prescription.map((item) => {
    const prior = existing.find((entry) => entry.slotKey === item.slotKey && entry.exerciseId === item.exerciseId) || {}
    const sets = Array.from({ length: item.targetSets }, (_, index) => ({
      id: `${item.slotKey}:${index + 1}`,
      reps: prior.sets?.[index]?.reps ?? '',
      done: Boolean(prior.sets?.[index]?.done)
    }))
    return {
      ...item,
      load: prior.load ?? item.previousLoad ?? '',
      notes: prior.notes || '',
      sets
    }
  })
}

function liftCoverage(plan) {
  const tags = []
  for (const lift of plan.lifts || []) {
    const focus = focusForSlot(lift.slotId)
    tags.push(focus)
    if (focus === 'squat') tags.push('legs')
    if (focus === 'hinge') tags.push('legs', 'grip')
    if (focus === 'press' || focus === 'overhead') tags.push('press')
  }
  return tags
}

function recentConditioningIds(logs, plan) {
  return Object.values(logs || {})
    .filter((log) => beforePlan(log, plan) && log.conditioning?.optionId)
    .sort((a, b) => {
      const aa = parseLogPosition(a)
      const bb = parseLogPosition(b)
      return bb.week - aa.week || bb.day - aa.day
    })
    .slice(0, 2)
    .map((log) => log.conditioning.optionId)
}

export function conditioningOptionsForSession(plan, bodybuilding, logs = {}, count = 3) {
  const coverage = new Set([
    ...liftCoverage(plan),
    ...bodybuilding.flatMap((item) => item.tags || [])
  ])
  const recent = recentConditioningIds(logs, plan)

  return alsruheConditioningCatalog()
    .map((block) => {
      let score = 0
      const fills = []
      for (const tag of block.tags || []) {
        if (HIGH_VALUE_CONDITIONING_TAGS.includes(tag)) {
          score += coverage.has(tag) ? 4 : 18
          if (!coverage.has(tag)) fills.push(tag)
        } else if (!coverage.has(tag)) {
          score += 3
        }
      }
      if (recent[0] === block.id) score -= 100
      else if (recent.includes(block.id)) score -= 20
      return {
        ...block,
        score,
        fills: unique(fills),
        matchReason: fills.length ? `Cubre ${unique(fills).join(', ')}` : 'Variedad de conditioning',
        timerPreset: timerFromConditioning(block)
      }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, count)
}
