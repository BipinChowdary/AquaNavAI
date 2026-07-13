import { expect, test } from '@playwright/test'

test('verified NOAA demo, worker routing, and animation work with external networking blocked', async ({ page }) => {
  const externalRequests: string[] = [], consoleErrors: string[] = [], failedFirstParty: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('response', (response) => { const url = new URL(response.url()); if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && response.status() >= 400) failedFirstParty.push(`${response.status()} ${url.pathname}`) })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue()
    else { externalRequests.push(url.href); await route.abort() }
  })
  await page.goto('/')
  await expect(page.getByText('NOAA South Florida Atlantic Shelf')).toBeVisible()
  await expect(page.getByText(/Verified NOAA-derived environmental snapshot/).first()).toBeVisible()
  await expect(page.getByText('Route outcome')).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Calculate routes in browser' }).click()
  await expect(page.getByRole('button', { name: 'Calculate routes in browser' })).toBeEnabled({ timeout: 5_000 })
  await expect(page.getByText(/min elapsed/)).toBeVisible()
  await page.getByRole('button', { name: 'Play ASV' }).click()
  await expect(page.getByRole('button', { name: 'Pause ASV' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('NOAA South Florida Atlantic Shelf')).toBeVisible()
  expect(externalRequests).toEqual([])
  expect(failedFirstParty).toEqual([])
  expect(consoleErrors).toEqual([])
})
