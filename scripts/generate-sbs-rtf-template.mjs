import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import ExcelJS from 'exceljs'

const DEFAULT_SOURCE = 'C:\\Users\\Usuario\\Downloads\\SBS Strength Program reps to failure.xlsx'
const source = process.argv[2] || DEFAULT_SOURCE
const outFile = path.resolve('src/data/sbsRtfTemplate.json')

function cell(sheet, address) {
  const value = sheet.getCell(address).value
  if (value && typeof value === 'object' && 'result' in value) return value.result ?? null
  return value ?? null
}

function formula(sheet, row, column) {
  const value = sheet.getCell(row, column).value
  return value && typeof value === 'object' && 'formula' in value ? value.formula : null
}

function number(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : fallback
}

function quickCell(sheet, colIndex, row) {
  const value = sheet.getCell(row, colIndex + 1).value
  if (value && typeof value === 'object' && 'result' in value) return value.result ?? null
  return value ?? null
}

function setupSlotFromFormula(formula) {
  const match = String(formula || '').match(/Setup!\$?A\$?(\d+)/i)
  if (!match) return null
  const row = Number(match[1])
  if (row >= 3 && row <= 6) return `main_${row - 2}`
  if (row >= 9 && row <= 14) return `aux_${row - 8}`
  return null
}

function extractLiftSlots(qs) {
  const mains = [5, 6, 7, 8].map((row, index) => ({
    id: `main_${index + 1}`,
    kind: 'main',
    label: cell(qs, `B${row}`) || `Main lift ${index + 1}`,
    defaultName: cell(qs, `C${row}`) || '',
    defaultTrainingMax: number(cell(qs, `D${row}`)),
    singleAt8Pct: number(cell(qs, `E${row}`), 0.9)
  }))

  const auxiliaries = [11, 12, 13, 14, 15, 16].map((row, index) => ({
    id: `aux_${index + 1}`,
    kind: 'auxiliary',
    label: cell(qs, `B${row}`) || `Auxiliary ${index + 1}`,
    defaultName: cell(qs, `C${row}`) || '',
    defaultTrainingMax: number(cell(qs, `D${row}`)),
    singleAt8Pct: number(cell(qs, `E${row}`), 0.9)
  }))

  return [...mains, ...auxiliaries]
}

function extractAdjustments(qs) {
  const rows = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  return Object.fromEntries(
    rows.map((row, index) => {
      const id = index < 4 ? `main_${index + 1}` : `aux_${index - 3}`
      return [
        id,
        {
          sets: number(cell(qs, `H${row}`), 5),
          belowBy2Plus: number(cell(qs, `I${row}`), -0.05),
          belowBy1: number(cell(qs, `J${row}`), -0.02),
          hit: number(cell(qs, `K${row}`), 0),
          beatBy1: number(cell(qs, `L${row}`), 0.005),
          beatBy2: number(cell(qs, `M${row}`), 0.01),
          beatBy3: number(cell(qs, `N${row}`), 0.015),
          beatBy4: number(cell(qs, `O${row}`), 0.02),
          beatBy5Plus: number(cell(qs, `P${row}`), 0.03)
        }
      ]
    })
  )
}

function extractTargetTable(qs, headerRow, firstLiftRow) {
  const intensities = []
  for (let col = 2; col <= 22; col += 1) {
    intensities.push(number(quickCell(qs, col, headerRow)))
  }
  const table = {}
  for (let i = 0; i < 10; i += 1) {
    const id = i < 4 ? `main_${i + 1}` : `aux_${i - 3}`
    table[id] = Object.fromEntries(
      intensities.map((intensity, offset) => [
        String(intensity),
        number(quickCell(qs, 2 + offset, firstLiftRow + i))
      ])
    )
  }
  return { intensities, table }
}

function extractIntensityByWeek(qs) {
  const weeks = []
  for (let col = 2; col <= 22; col += 1) {
    weeks.push(number(quickCell(qs, col, 59)))
  }
  const bySlot = {}
  for (let i = 0; i < 10; i += 1) {
    const id = i < 4 ? `main_${i + 1}` : `aux_${i - 3}`
    bySlot[id] = Object.fromEntries(
      weeks.map((week, offset) => [
        String(week),
        number(quickCell(qs, 2 + offset, 60 + i))
      ])
    )
  }
  return { weeks, bySlot }
}

const SETUP_ROWS = {
  main_1: 3,
  main_2: 4,
  main_3: 5,
  main_4: 6,
  aux_1: 9,
  aux_2: 10,
  aux_3: 11,
  aux_4: 12,
  aux_5: 13,
  aux_6: 14
}

function extractWeeklyParameters(workbook) {
  const setup = workbook.getWorksheet('Setup')
  if (!setup) throw new Error('No se encontro la hoja Setup')

  return Object.fromEntries(
    Object.entries(SETUP_ROWS).map(([slotId, row]) => [
      slotId,
      Object.fromEntries(
        Array.from({ length: 21 }, (_, index) => {
          const week = index + 1
          const firstColumn = 2 + index * 12
          return [
            String(week),
            {
              intensity: number(quickCell(setup, firstColumn - 1, row)),
              normalReps: number(quickCell(setup, firstColumn, row)),
              repOutTarget: number(quickCell(setup, firstColumn + 1, row)),
              sets: number(quickCell(setup, firstColumn + 2, row), 5),
              adjustments: {
                belowBy2Plus: number(quickCell(setup, firstColumn + 3, row), -0.05),
                belowBy1: number(quickCell(setup, firstColumn + 4, row), -0.02),
                hit: number(quickCell(setup, firstColumn + 5, row), 0),
                beatBy1: number(quickCell(setup, firstColumn + 6, row), 0.005),
                beatBy2: number(quickCell(setup, firstColumn + 7, row), 0.01),
                beatBy3: number(quickCell(setup, firstColumn + 8, row), 0.015),
                beatBy4: number(quickCell(setup, firstColumn + 9, row), 0.02),
                beatBy5Plus: number(quickCell(setup, firstColumn + 10, row), 0.03)
              }
            }
          ]
        })
      )
    ])
  )
}

function extractFrequencyLayout(workbook, sheetName) {
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) throw new Error(`No se encontró la hoja ${sheetName}`)
  const days = []
  let current = null

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const value = sheet.getCell(r, 1).value
    if (typeof value === 'string' && /^Day\s+\d+/i.test(value)) {
      current = { day: Number(value.match(/\d+/)?.[0]), lifts: [] }
      days.push(current)
      continue
    }
    if (!current) continue
    if (value === 'Accessories') {
      current.accessorySlots = 3
      current = null
      continue
    }
    const slotId = setupSlotFromFormula(formula(sheet, r, 1))
    const weightFormula = formula(sheet, r, 2)
    if (slotId && weightFormula && /mround/i.test(weightFormula)) {
      current.lifts.push({ slotId })
    }
  }

  return { frequency: Number(sheetName.replace('x', '')), days }
}

function formulaDigest(workbook) {
  const formulas = []
  for (const sheetName of ['Setup', '2x', '3x', '4x', '5x', '6x']) {
    const sheet = workbook.getWorksheet(sheetName)
    sheet.eachRow((row) => row.eachCell((cell) => {
      const value = cell.value
      if (value && typeof value === 'object' && 'formula' in value) formulas.push(`${sheetName}!${cell.address}=${value.formula}`)
    }))
  }
  return crypto.createHash('sha256').update(formulas.join('\n')).digest('hex')
}

if (!fs.existsSync(source)) {
  throw new Error(`No existe el Excel fuente: ${source}`)
}

const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(source)
const qs = workbook.getWorksheet('Quick Setup')
if (!qs) throw new Error('No se encontro la hoja Quick Setup')
const sourceStats = fs.statSync(source)

const normal = extractTargetTable(qs, 31, 32)
const repOut = extractTargetTable(qs, 45, 46)
const intensity = extractIntensityByWeek(qs)

const template = {
  id: 'sbs-rtf',
  name: 'SBS Strength Program Reps To Failure',
  source: {
    fileName: path.basename(source),
    sourceModifiedAt: sourceStats.mtime.toISOString(),
    formulaDigest: formulaDigest(workbook),
    notes: 'Generado desde Quick Setup y hojas 2x-6x. El Excel fuente no se copia al repo.'
  },
  defaults: {
    units: 'kg',
    rounding: number(cell(qs, 'A2'), 2.5),
    deloadWeeks: [7, 14, 21],
    liftSlots: extractLiftSlots(qs),
    backExercises: Array.from({ length: 8 }, (_, index) => cell(qs, `B${19 + index}`)).filter(Boolean),
    adjustments: extractAdjustments(qs),
    normalSetReps: normal.table,
    repOutTargets: repOut.table,
    intensityByWeek: intensity.bySlot,
    weeklyParameters: extractWeeklyParameters(workbook)
  },
  meta: {
    weeks: 21,
    frequencies: [2, 3, 4, 5, 6],
    targetIntensities: normal.intensities,
    intensityWeeks: intensity.weeks
  },
  layouts: Object.fromEntries(
    ['2x', '3x', '4x', '5x', '6x'].map((sheetName) => {
      const layout = extractFrequencyLayout(workbook, sheetName)
      return [String(layout.frequency), layout]
    })
  )
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(template, null, 2)}\n`)
console.log(`Generated ${outFile}`)
