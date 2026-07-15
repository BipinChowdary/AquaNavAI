import { expect, test } from '@playwright/test'

test('a 10.5-second cold delay remains recoverable and reaches ready', async ({
  page,
}) => {
  await page.route('**/scenarios/index.json*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 10_500))
    await route.continue()
  })
  await page.goto('/?resilience=slow')
  await expect(page.getByText(/still making progress/i)).toBeVisible({
    timeout: 12_000,
  })
  await expect(page.locator('[data-init-stage="failed"]')).toHaveCount(0)
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
})

test('a transient index failure exposes retry and recovers cleanly', async ({
  page,
}) => {
  let first = true
  await page.route('**/scenarios/index.json*', async (route) => {
    if (first) {
      first = false
      await route.fulfill({ status: 503, body: 'temporary outage' })
      return
    }
    await route.continue()
  })
  await page.goto('/?resilience=retry')
  await expect(page.locator('[data-init-stage="failed"]')).toBeVisible()
  await expect(page.getByText(/HTTP 503/i)).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
})

test('the deterministic proxy fallback is checksum-validated and clearly bounded', async ({
  page,
}) => {
  let first = true
  await page.route('**/scenarios/index.json*', async (route) => {
    if (first) {
      first = false
      await route.fulfill({ status: 503, body: 'temporary outage' })
      return
    }
    await route.continue()
  })
  await page.goto('/?resilience=proxy-fallback')
  await page
    .getByRole('button', { name: 'Load deterministic proxy fixture' })
    .click()
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText(/Deterministic proxy fixture; not a NOAA/i),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Static fallback' }),
  ).toBeVisible()
  await expect(page.locator('[data-route-metric]')).toHaveCount(2)
  await expect(page.getByText(/Legacy proxy evaluation/i)).toBeVisible()
  await expect(
    page.getByText(/proxy values are not NOAA results/i),
  ).toBeVisible()
})

test('five cache-disabled cold reloads complete without terminal errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.setCacheDisabled', { cacheDisabled: true })
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.goto(`/?cold-reload=${attempt}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
      timeout: 15_000,
    })
  }
  expect(errors).toEqual([])
})
