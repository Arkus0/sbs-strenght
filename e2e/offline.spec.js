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

test('all application routes remain available after installation without network', async ({ context, page }) => {
  await page.goto('/')
  for (const [name, value] of Object.entries(maxes)) await page.getByLabel(`Training max ${name}`).fill(value)
  await page.getByLabel(/He revisado los training maxes/).check()
  await page.getByRole('button', { name: 'Crear ciclo' }).click()
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()

  const sessionId = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('sbs-strength-v3')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const sessions = await new Promise((resolve, reject) => {
      const request = db.transaction('schedule').objectStore('schedule').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return sessions.find((session) => session.code === 'W1D1')?.id
  })

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
  })
  await context.setOffline(true)

  await page.goto('/hoy')
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  await page.goto('/calendario')
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()
  await page.goto('/analiticas')
  await expect(page.getByRole('heading', { name: 'Analíticas' })).toBeVisible()
  await page.goto('/ajustes')
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  await page.getByRole('button', { name: /Datos/ }).click()
  await expect(page.getByText('Modo local activo')).toBeVisible()
  await page.goto(`/sesion/${sessionId}`)
  await expect(page.getByRole('button', { name: 'Finalizar' })).toBeVisible()
})
