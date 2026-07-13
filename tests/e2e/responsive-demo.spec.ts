import { expect, test } from '@playwright/test'

test('four objectives and map remain usable on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 8_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(page.getByLabel('Verified mission')).toBeVisible()
  await expect(
    page.getByRole('application', {
      name: /interactive south florida coastal route map/i,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /Show Balanced Mission/i }),
  ).toBeChecked()
  const box = await page.locator('.map-shell').boundingBox()
  expect(box?.height).toBeGreaterThan(500)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'docs/screenshots/navigation-v2-mobile.png',
    fullPage: true,
  })
})
