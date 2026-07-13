import { expect, test } from '@playwright/test'

test('mission controls and dominant map remain usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByLabel('Verified mission')).toBeVisible()
  await expect(page.getByRole('application', { name: /interactive south florida coastal route map/i })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /environmental a\*/i })).toBeChecked()
  const box = await page.locator('.map-shell').boundingBox()
  expect(box?.height).toBeGreaterThan(500)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
