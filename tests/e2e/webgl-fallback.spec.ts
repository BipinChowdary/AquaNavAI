import { expect, test } from '@playwright/test'

test('simplified renderer preserves routing, controls, attribution, and ASV motion', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?renderer=webgl-disabled')
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('[data-map-mode="simplified"]')).toBeVisible()
  await expect(
    page.getByText(/Interactive WebGL map unavailable.*simplified 2D map/i),
  ).toBeVisible()
  await expect(page.locator('[data-route-algorithm]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(
    page.getByText(/NOAA CUDEM.*NOAA RTOFS.*NOAA NDBC/),
  ).toBeVisible()
  const marker = page.locator('.asv-marker')
  await expect(marker).toBeVisible()
  const before = await marker.getAttribute('data-lng')
  await page.getByRole('button', { name: 'Play ASV' }).click()
  await page.waitForTimeout(1_000)
  expect(await marker.getAttribute('data-lng')).not.toBe(before)
  await page.getByRole('button', { name: 'Pause ASV' }).click()
  const paused = Number(await marker.getAttribute('data-progress'))
  await page.waitForTimeout(500)
  expect(Number(await marker.getAttribute('data-progress'))).toBeCloseTo(
    paused,
    3,
  )
  await page.getByLabel('Speed').selectOption('10')
  await page.getByRole('button', { name: 'Resume ASV' }).click()
  await page.waitForTimeout(500)
  expect(Number(await marker.getAttribute('data-progress'))).toBeGreaterThan(
    paused,
  )
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(marker).toHaveAttribute('data-progress', '0.0000')
  const balanced = page.getByRole('checkbox', {
    name: /Show Balanced Mission/i,
  })
  await balanced.uncheck()
  await expect(page.locator('[data-route-algorithm="balanced"]')).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain(
    'webglcontextcreationerror',
  )
  expect(errors).toEqual([])
})
