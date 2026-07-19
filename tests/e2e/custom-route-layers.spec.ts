import { expect, test, type Page } from '@playwright/test'

async function markerPositionInMap(page: Page) {
  return page.evaluate(() => {
    const marker = document
      .querySelector('.asv-marker')
      ?.getBoundingClientRect()
    const map = document.querySelector('.coastal-map')?.getBoundingClientRect()
    if (!marker || !map) throw new Error('Map marker geometry is unavailable.')
    return {
      x: (marker.x + marker.width / 2 - map.x) / map.width,
      y: (marker.y + marker.height / 2 - map.y) / map.height,
    }
  })
}

test('custom routing keeps four independent objective sources and controls', async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')
  await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
    timeout: 8_000,
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })

  const map = page.locator('.coastal-map')
  await expect(map).toHaveAttribute(
    'data-route-source-ids',
    'shortest-route-source,fastest-route-source,energy-route-source,balanced-route-source',
  )
  await expect(map).toHaveAttribute(
    'data-route-layer-ids',
    'shortest-route,fastest-route,energy-route,balanced-route',
  )

  const slider = page.getByRole('slider', { name: 'Animation progress' })
  await slider.fill('25')
  const start = await markerPositionInMap(page)
  await slider.fill('60')
  const goal = await markerPositionInMap(page)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()

  const mapBox = await map.boundingBox()
  if (!mapBox) throw new Error('The coastal map did not expose a bounding box.')
  await map.click({
    position: { x: start.x * mapBox.width, y: start.y * mapBox.height },
  })
  await expect(page.getByRole('alert')).toContainText('Start selected')
  await expect(map).toHaveAttribute('data-route-algorithms', '')

  await map.click({
    position: { x: goal.x * mapBox.width, y: goal.y * mapBox.height },
  })
  await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
    timeout: 15_000,
  })
  await expect(map).toHaveAttribute(
    'data-route-algorithms',
    'shortest,fastest,energy,balanced',
  )
  await expect(
    page.getByRole('option', { name: 'Custom map selection' }),
  ).toBeAttached()
  await expect(page.getByText(/objectives overlap exactly/i)).toBeVisible()

  const algorithms = ['shortest', 'fastest', 'energy', 'balanced'] as const
  for (const algorithm of algorithms) {
    const checkbox = page.getByRole('checkbox', {
      name: new RegExp(
        `Show .*${algorithm === 'energy' ? 'Energy' : algorithm}`,
        'i',
      ),
    })
    await checkbox.uncheck()
    await expect
      .poll(async () =>
        (await map.getAttribute('data-visible-route-algorithms'))?.split(','),
      )
      .not.toContain(algorithm)
    await checkbox.check()
    await expect
      .poll(async () =>
        (await map.getAttribute('data-visible-route-algorithms'))?.split(','),
      )
      .toContain(algorithm)
  }

  await page.getByRole('radio', { name: /Fastest Arrival/i }).check()
  await expect(map).toHaveAttribute('data-selected-route-algorithm', 'fastest')
  await expect
    .poll(async () =>
      (await map.getAttribute('data-route-layer-order'))?.split(',').at(-1),
    )
    .toBe('fastest-route')

  const routeAlgorithms = (
    (await map.getAttribute('data-route-algorithms')) ?? ''
  ).split(',')
  const routeSources = (
    (await map.getAttribute('data-route-source-ids')) ?? ''
  ).split(',')
  expect(new Set(routeAlgorithms).size).toBe(4)
  expect(new Set(routeSources).size).toBe(4)
  expect(browserErrors).toEqual([])

  await page.screenshot({
    path: 'artifacts/screenshots/custom-route-four-objectives.png',
    fullPage: true,
  })
})
