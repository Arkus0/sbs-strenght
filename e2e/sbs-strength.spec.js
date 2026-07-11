import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const maxes = {
  Squat: '490',
  'Bench Press': '325',
  Deadlift: '525',
  OHP: '200',
  'Front Squat': '420',
  'Paused Squat': '460',
  'Close Grip Bench': '310',
  'Incline Press': '280',
  'Sumo Deadlift': '500',
  'Push Press': '245'
}

async function clearApp(page) {
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('sbs-strength-v3')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const names = [...db.objectStoreNames]
        if (!names.length) { db.close(); resolve(); return }
        const transaction = db.transaction(names, 'readwrite')
        for (const name of names) transaction.objectStore(name).clear()
        transaction.oncomplete = () => { db.close(); resolve() }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  })
  await page.reload()
}

async function completeOnboarding(page) {
  for (const [name, value] of Object.entries(maxes)) await page.getByLabel(`Training max ${name}`).fill(value)
  await page.getByLabel(/He revisado los training maxes/).check()
  await page.getByRole('button', { name: 'Crear ciclo' }).click()
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Semana 1 · Día 1' })).toBeVisible()
}

async function openNextSession(page) {
  await page.getByRole('link', { name: 'Empezar sesión' }).click()
  await expect(page.getByRole('button', { name: 'Finalizar' })).toBeVisible()
}

async function sessionIdFor(page, code) {
  return page.evaluate(async (wanted) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('sbs-strength-v3')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction('schedule').objectStore('schedule').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return rows.find((row) => row.code === wanted)?.id
  }, code)
}

async function logFor(page, code) {
  return page.evaluate(async (wanted) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('sbs-strength-v3')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('logs').objectStore('logs').get(wanted)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return value
  }, code)
}

test.beforeEach(async ({ page }) => clearApp(page))

test('dev server renders meaningful content without browser errors', async ({ page }) => {
  const browserErrors = []
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /Tu ciclo/ })).toBeVisible()
  await expect(page.locator('vite-error-overlay, .vite-error-overlay, #webpack-dev-server-client-overlay')).toHaveCount(0)
  expect(browserErrors).toEqual([])
})

test('onboarding protects the Excel prescription and opens the runner', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Crear ciclo' })).toBeDisabled()
  await completeOnboarding(page)
  await expect(page.getByText('342.5 kg')).toBeVisible()
  await openNextSession(page)
  await expect(page.getByLabel('Duracion de la sesion')).toBeVisible()
  await expect(page.getByText('4x5 + 1x10+')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Completar Single @8 Squat' })).toBeVisible()
})

test('autosaves main lifts, bodybuilding and conditioning in IndexedDB', async ({ page }) => {
  await completeOnboarding(page)
  await openNextSession(page)
  await page.getByLabel('Peso Single @8 Squat').fill('460')
  await page.getByRole('button', { name: 'Completar Single @8 Squat' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Usar esta single para autorregular Squat').check()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  await expect(page.getByText('357.5')).toBeVisible()
  await page.getByLabel('Reps Serie 5 AMRAP Squat').fill('12')
  const firstAssistance = page.locator('.bodybuilding-exercise-card').first()
  await firstAssistance.getByLabel(/Carga|Lastre/).fill('50')
  await firstAssistance.getByLabel(/Reps serie 1/).fill('12')
  await firstAssistance.getByRole('button', { name: /Completar serie 1/ }).click()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByLabel('Resultado conditioning').fill('5 rondas')
  await page.getByRole('button', { name: 'Completar', exact: true }).click()
  await page.waitForTimeout(350)
  await page.reload()
  await expect(page.getByLabel('Peso Single @8 Squat')).toHaveValue('460')
  await expect(page.getByLabel('Reps Serie 5 AMRAP Squat')).toHaveValue('12')
  await expect(page.locator('.bodybuilding-exercise-card').first().getByLabel(/Carga|Lastre/)).toHaveValue('50')
  await expect(page.getByLabel('Resultado conditioning')).toHaveValue('5 rondas')
})

test('accessory engine explains and applies an increase after reaching the top', async ({ page }) => {
  await completeOnboarding(page)
  await openNextSession(page)
  const firstAssistance = page.locator('.bodybuilding-exercise-card').first()
  await firstAssistance.getByLabel(/Carga|Lastre/).fill('50')
  for (let set = 1; set <= 3; set += 1) {
    await firstAssistance.getByLabel(`Reps serie ${set} Chest-supported row`).fill('12')
    await firstAssistance.getByRole('button', { name: `Completar serie ${set} Chest-supported row` }).click()
    await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  }
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finalizar' }).click()
  const id = await sessionIdFor(page, 'W2D1')
  await page.goto(`/sesion/${id}`)
  await expect(page.locator('.bodybuilding-exercise-card').first().getByText('Subir carga')).toBeVisible()
  await expect(page.locator('.bodybuilding-exercise-card').first().getByText(/Todas las series alcanzaron/)).toBeVisible()
  await expect(page.locator('.bodybuilding-exercise-card').first().getByLabel(/Carga|Lastre/)).toHaveValue('52.5')
})

test('Excel AMRAP progression remains identical in week two', async ({ page }) => {
  await completeOnboarding(page)
  await openNextSession(page)
  await page.getByLabel('Reps Serie 5 AMRAP Squat').fill('15')
  await page.getByRole('button', { name: 'Completar Serie 5 AMRAP Squat' }).click()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finalizar' }).click()
  const id = await sessionIdFor(page, 'W2D1')
  await page.goto(`/sesion/${id}`)
  await expect(page.getByRole('heading', { name: 'Semana 2 · D1' })).toBeVisible()
  await expect(page.getByText('377.5')).toBeVisible()
  const squatCard = page.locator('.main-exercise-card').filter({ has: page.getByRole('heading', { name: 'Squat' }) })
  await squatCard.getByText('Detalles y notas').click()
  await expect(squatCard.getByText(/\+5 reps.*3%/)).toBeVisible()
})

test('94 percent single reproduces the Excel weeks 1 to 3', async ({ page }) => {
  for (const [name, value] of Object.entries(maxes)) await page.getByLabel(`Training max ${name}`).fill(name === 'Squat' ? '100' : value)
  await page.getByLabel('Single @8 porcentaje Squat').fill('94')
  await page.getByLabel('Redondeo de cargas').fill('2')
  await page.getByLabel(/He revisado los training maxes/).check()
  await page.getByRole('button', { name: 'Crear ciclo' }).click()
  await openNextSession(page)

  const squat = page.locator('.main-exercise-card').filter({ has: page.getByRole('heading', { name: 'Squat' }) })
  await expect(squat.getByText(/70 kg/)).toBeVisible()
  await page.getByLabel('Peso Single @8 Squat').fill('94')
  await page.getByRole('button', { name: 'Completar Single @8 Squat' }).click()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  await page.getByLabel('Usar esta single para autorregular Squat').check()
  await expect(squat.getByText(/70 kg/)).toBeVisible()
  await page.getByLabel('Reps Serie 5 AMRAP Squat').fill('13')
  await page.getByRole('button', { name: 'Completar Serie 5 AMRAP Squat' }).click()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finalizar' }).click()

  const week2Id = await sessionIdFor(page, 'W2D1')
  await page.goto(`/sesion/${week2Id}`)
  const squat2 = page.locator('.main-exercise-card').filter({ has: page.getByRole('heading', { name: 'Squat' }) })
  await expect(squat2.getByText(/76 kg/)).toBeVisible()
  await page.getByLabel('Reps Serie 5 AMRAP Squat').fill('12')
  await page.getByRole('button', { name: 'Completar Serie 5 AMRAP Squat' }).click()
  await page.getByLabel('Descanso activo').getByRole('button', { name: 'Omitir' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finalizar' }).click()

  const week3Id = await sessionIdFor(page, 'W3D1')
  await page.goto(`/sesion/${week3Id}`)
  const squat3 = page.locator('.main-exercise-card').filter({ has: page.getByRole('heading', { name: 'Squat' }) })
  await expect(squat3.getByText(/82 kg/)).toBeVisible()
})

test('discard removes a draft without recreating it on unmount', async ({ page }) => {
  await completeOnboarding(page)
  await openNextSession(page)
  await page.getByLabel('Peso Single @8 Squat').fill('460')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Descartar sesion' }).click()
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  await page.waitForTimeout(300)
  expect(await logFor(page, 'W1D1')).toBeUndefined()
})

test('completion stores reliable active time and a persistent summary', async ({ page }) => {
  await completeOnboarding(page)
  await openNextSession(page)
  await page.waitForTimeout(1100)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page.getByText('Sesión completada')).toBeVisible()
  await expect(page.getByText('0/24 series')).toBeVisible()
  const log = await logFor(page, 'W1D1')
  expect(log.status).toBe('completed')
  expect(log.activeSeconds).toBeGreaterThanOrEqual(1)
  expect(log.activeSeconds).toBeLessThan(30)
})

test('calendar reprograms without changing the SBS code and exports ICS', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('link', { name: 'Calendario' }).click()
  await page.getByRole('button', { name: 'Semana siguiente' }).click()
  const card = page.locator('.calendar-session').first()
  await card.locator('summary').click()
  await card.getByLabel('Nueva fecha').fill('2026-08-10')
  await card.getByRole('button', { name: 'Mover sesión' }).click()
  await page.waitForTimeout(250)
  const id = await sessionIdFor(page, 'W1D1')
  expect(id).toBeTruthy()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar calendario' }).click()
  await expect(await download).toBeTruthy()
})

test('analytics and protected settings are reachable by persistent routes', async ({ page }) => {
  await completeOnboarding(page)
  await page.goto('/analiticas')
  await expect(page.getByRole('heading', { name: 'Analíticas' })).toBeVisible()
  await expect(page.getByText('e1RM usa Epley')).toBeVisible()
  await page.goto('/ajustes')
  await expect(page.getByText('Motor Excel protegido')).toBeVisible()
  await expect(page.getByText(/intensidades, targets, buckets, deloads y fórmulas/)).toBeVisible()
  await expect(page.getByText('Modo local activo')).toBeVisible()
})

test('Today has no serious or critical accessibility violations', async ({ page }) => {
  await completeOnboarding(page)
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''))
  expect(blocking).toEqual([])
})
