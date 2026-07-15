import { expect, test, type Page } from '@playwright/test'

const marker = async (page: Page) =>
  page.locator('.asv-marker').evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      lng: Number((element as HTMLElement).dataset.lng),
      lat: Number((element as HTMLElement).dataset.lat),
      progress: Number((element as HTMLElement).dataset.progress),
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }
  })

test('offline Navigation V2 proves four routes, exact-route movement, and custom routing', async ({
  page,
}) => {
  const externalRequests: string[] = []
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_FAILED'))
      browserErrors.push(
        `network: ${request.url()} ${request.failure()?.errorText}`,
      )
  })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      await route.continue()
    else {
      externalRequests.push(url.href)
      await route.abort()
    }
  })
  await page.goto('/')
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 8_000,
  })
  await expect(page.locator('.loading-ring')).toHaveCount(0)
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(page.locator('.asv-marker')).toBeVisible()
  await expect(
    page.getByRole('radio', { name: /Shortest Distance/i }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('radio', { name: /Fastest Arrival/i }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('radio', { name: /Lowest Modelled Energy/i }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('radio', { name: /Balanced Mission/i }),
  ).toHaveCount(1)
  const releasedRoutes = await page.evaluate(async () => {
    const artifact = await (
      await fetch('/scenarios/south-florida-noaa-v1/routes.geojson')
    ).json()
    return artifact.features.map(
      (feature: {
        properties: { algorithm: string }
        geometry: { coordinates: unknown[] }
      }) => ({
        algorithm: feature.properties.algorithm,
        points: feature.geometry.coordinates.length,
      }),
    )
  })
  expect(new Set(releasedRoutes.map((route) => route.algorithm))).toEqual(
    new Set(['shortest', 'fastest', 'energy', 'balanced']),
  )
  expect(releasedRoutes.every((route) => route.points > 2)).toBe(true)
  await page.screenshot({
    path: 'artifacts/screenshots/navigation-v2-ready.png',
    fullPage: true,
  })

  const start = await marker(page)
  const initialMapBox = await page.locator('.map-shell').boundingBox()
  if (!initialMapBox)
    throw new Error('Map shell did not expose a bounding box.')
  expect(start.x).toBeGreaterThanOrEqual(initialMapBox.x)
  expect(start.y).toBeGreaterThanOrEqual(initialMapBox.y)
  expect(start.x + start.width).toBeLessThanOrEqual(
    initialMapBox.x + initialMapBox.width,
  )
  expect(start.y + start.height).toBeLessThanOrEqual(
    initialMapBox.y + initialMapBox.height,
  )
  await page.getByRole('button', { name: 'Play ASV' }).click()
  await page.waitForTimeout(1_200)
  const moving = await marker(page)
  expect(
    Math.hypot(moving.lng - start.lng, moving.lat - start.lat),
  ).toBeGreaterThan(0.0001)
  expect(Math.hypot(moving.x - start.x, moving.y - start.y)).toBeGreaterThan(3)
  await page.getByRole('button', { name: 'Pause ASV' }).click()
  const paused = await marker(page)
  await page.waitForTimeout(700)
  expect((await marker(page)).progress).toBeCloseTo(paused.progress, 3)
  await page.getByRole('button', { name: 'Resume ASV' }).click()
  await page.waitForTimeout(700)
  expect((await marker(page)).progress).toBeGreaterThan(paused.progress)

  const slider = page.getByRole('slider', { name: 'Animation progress' })
  await slider.fill('25')
  const quarter = await marker(page)
  await page.screenshot({
    path: 'artifacts/screenshots/navigation-v2-progress-25.png',
  })
  await slider.fill('50')
  const halfway = await marker(page)
  await page.screenshot({
    path: 'artifacts/screenshots/navigation-v2-progress-50.png',
  })
  expect(
    Math.hypot(halfway.lng - quarter.lng, halfway.lat - quarter.lat),
  ).toBeGreaterThan(0.001)
  await slider.fill('75')
  const threeQuarter = await marker(page)
  expect(
    Math.hypot(threeQuarter.lng - halfway.lng, threeQuarter.lat - halfway.lat),
  ).toBeGreaterThan(0.001)
  await slider.fill('100')
  const end = await marker(page)
  expect(end.progress).toBe(1)
  await page.screenshot({
    path: 'artifacts/screenshots/navigation-v2-complete.png',
  })
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  const reset = await marker(page)
  expect(reset.lng).toBeCloseTo(start.lng, 5)
  expect(reset.lat).toBeCloseTo(start.lat, 5)

  const mapBox = await page.locator('.coastal-map').boundingBox()
  if (!mapBox) throw new Error('Map did not expose a bounding box.')
  await page.locator('.coastal-map').click({
    position: {
      x: quarter.x + quarter.width / 2 - mapBox.x,
      y: quarter.y + quarter.height / 2 - mapBox.y,
    },
  })
  await expect(page.getByRole('alert')).toContainText('Start selected')
  expect(await page.locator('[data-init-stage="ready"]').count()).toBe(1)
  await page.locator('.coastal-map').click({
    position: {
      x: halfway.x + halfway.width / 2 - mapBox.x,
      y: halfway.y + halfway.height / 2 - mapBox.y,
    },
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('option', { name: 'Custom map selection' }),
  ).toBeAttached()
  await page.screenshot({
    path: 'artifacts/screenshots/navigation-v2-custom-route.png',
    fullPage: true,
  })

  await page.getByRole('radio', { name: /Fastest Arrival/i }).click()
  await expect(page.locator('.asv-marker')).toHaveAttribute(
    'data-progress',
    '0.0000',
  )
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 8_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Play ASV' }).click()
  await page.waitForTimeout(300)
  await page.getByLabel('Verified mission').selectOption({ index: 1 })
  await expect(page.locator('.asv-marker')).toHaveAttribute(
    'data-progress',
    '0.0000',
  )
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await page.getByLabel('Select forecast cycle').fill('1')
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })

  const invalidMap = page.locator('.coastal-map')
  const invalidBox = await invalidMap.boundingBox()
  if (!invalidBox)
    throw new Error('Map did not expose a bounding box after reload.')
  await invalidMap.click({
    position: { x: invalidBox.width * 0.08, y: invalidBox.height * 0.5 },
  })
  await invalidMap.click({
    position: { x: invalidBox.width * 0.72, y: invalidBox.height * 0.5 },
  })
  await expect(page.getByRole('alert')).toContainText(
    /land|shallow|navigable|outside/i,
    { timeout: 15_000 },
  )
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible()

  for (const [x, y] of [
    [0.7, 0.68],
    [0.74, 0.35],
    [0.69, 0.62],
    [0.76, 0.42],
  ])
    await invalidMap.click({
      position: { x: invalidBox.width * x, y: invalidBox.height * y },
    })
  await expect(page.getByTestId('worker-status')).toHaveText(/ready/i, {
    timeout: 15_000,
  })
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible()
  expect(externalRequests).toEqual([])
  expect(browserErrors).toEqual([])
})
