import { expect, test } from '@playwright/test'

test('mission controls and map remain usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByLabel('Mission pair')).toBeVisible()
  await expect(page.getByLabel('Interactive coastal map comparing distance and environmental routes')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /environmental a\*/i })).toBeChecked()
})
