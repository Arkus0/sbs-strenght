import { expect, test } from '@playwright/test'

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

async function completeOnboarding(page) {
  await page.goto('/')
  for (const [name, value] of Object.entries(maxes)) {
    await page.getByLabel(`Training max ${name}`).fill(value)
  }
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Semana 1 Dia 1' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
})

test('onboarding blocks entry until required maxes exist', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  await page.getByLabel('Training max Squat').fill('490')
  await expect(page.getByText(/maxes pendientes/)).toBeVisible()

  await completeOnboarding(page)
  await expect(page.getByText('342.5')).toBeVisible()
  await page.getByRole('button', { name: 'Abrir sesion' }).click()
  await expect(page.getByRole('heading', { name: 'Serie a serie' })).toBeVisible()
  await expect(page.getByLabel('Preset de timer')).toBeVisible()
  await expect(page.getByText('4x5 + 1x10+')).toBeVisible()
  await expect(page.getByRole('button', { name: /Editar Single.*Squat/ })).toBeVisible()
  await page.getByRole('button', { name: 'Anotar serie' }).click()
  await expect(page.getByRole('heading', { name: 'Serie 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible()
  await page.getByRole('button', { name: 'Pausa' }).click()
  await expect(page.getByRole('button', { name: 'Reanudar' })).toBeVisible()
  const paused = await page.locator('[role="timer"]').textContent()
  await page.waitForTimeout(500)
  await expect(page.locator('[role="timer"]')).toHaveText(paused)
})

test('autosaves an in-progress session and applies single @8 live', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Abrir sesion' }).click()

  await page.getByLabel('Peso serie actual Squat').fill('460')
  await expect(page.getByText('357.5')).toBeVisible()
  await page.getByRole('button', { name: /Editar Serie 5 AMRAP Squat/ }).click()
  await page.getByLabel('Reps serie actual Squat').fill('12')
  await page.getByRole('button', { name: 'Aplicar templates elegidos' }).click()
  await expect(page.locator('section[aria-labelledby="upper-back-title"] select')).toHaveValue(/Rows|Pull|Chin|Rounds|TEMPO|Sandbag/)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Semana 1 Dia 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar sesion' }).click()
  await expect(page.getByLabel('Peso serie actual Squat')).toHaveValue('460')
  await page.getByRole('button', { name: /Editar Serie 5 AMRAP Squat/ }).click()
  await expect(page.getByLabel('Reps serie actual Squat')).toHaveValue('12')
})

test('last-set reps change the next week load for the lift', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Abrir sesion' }).click()

  await page.getByRole('button', { name: /Editar Serie 5 AMRAP Squat/ }).click()
  await page.getByLabel('Reps serie actual Squat').fill('15')
  await page.getByRole('button', { name: 'Guardar sesion' }).click()
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByRole('heading', { name: 'Semana 1 Dia 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir sesion' })).toBeVisible()
  await page.getByRole('button', { name: 'Plan' }).click()
  await page.getByRole('button', { name: 'Abrir W2D1' }).click()

  await expect(page.getByRole('heading', { name: 'Semana 2 Dia 1' })).toBeVisible()
  await expect(page.getByText('377.5')).toBeVisible()
  await expect(page.getByText(/Ajuste previo: \+5 reps, 3%/)).toBeVisible()
})

test('can discard the active draft without completing the session', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Abrir sesion' }).click()

  await page.getByLabel('Peso serie actual Squat').fill('460')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Descartar' }).click()

  await expect(page.getByRole('heading', { name: 'Semana 1 Dia 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir sesion' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar sesion' })).toHaveCount(0)
})

test('advanced edits affect prescriptions and JSON import restores exported data', async ({ page }) => {
  await completeOnboarding(page)

  await page.getByRole('button', { name: 'Setup' }).click()
  await page.getByRole('button', { name: 'Editar tablas' }).click()
  const squatDetails = page.locator('details').filter({ hasText: 'Squat' }).first()
  await squatDetails.locator('summary').click()
  await squatDetails.getByLabel('S1', { exact: true }).fill('0.6')
  await page.getByRole('button', { name: 'Inicio' }).click()
  await expect(page.getByText('295')).toBeVisible()

  await page.getByRole('button', { name: 'Setup' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar JSON' }).click()
  ])
  const exported = await download.path()
  expect(exported).toBeTruthy()

  await page.locator('input[type="file"]').setInputFiles(exported)
  await expect(page.getByText('Importacion completada')).toBeVisible()
})
