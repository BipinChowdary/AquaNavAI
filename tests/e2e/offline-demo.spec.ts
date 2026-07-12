import { expect, test } from '@playwright/test'

test('the professor demo loads without external network dependencies', async ({ page }) => {
  const externalRequests: string[] = []
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue()
    else {
      externalRequests.push(url.href)
      await route.abort()
    }
  })
  await page.goto('/')
  await expect(page.getByText('South Florida Atlantic Shelf')).toBeVisible()
  await expect(page.getByText('Route outcome')).toBeVisible()
  await expect(page.getByText('Research use only')).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  expect(externalRequests).toEqual([])
  expect(consoleErrors).toEqual([])
})
