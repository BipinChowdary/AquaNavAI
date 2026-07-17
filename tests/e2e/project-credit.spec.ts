import { expect, test, type Locator } from '@playwright/test'

const expectNoOverlap = async (first: Locator, second: Locator) => {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ])
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  if (!firstBox || !secondBox) return

  const overlaps = !(
    firstBox.x + firstBox.width <= secondBox.x ||
    secondBox.x + secondBox.width <= firstBox.x ||
    firstBox.y + firstBox.height <= secondBox.y ||
    secondBox.y + secondBox.height <= firstBox.y
  )
  expect(overlaps).toBe(false)
}

for (const width of [1440, 1024, 760, 390]) {
  test(`creator credit remains usable at ${width}px`, async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = []
    const portfolioRequests: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    context.on('request', (request) => {
      if (request.url().startsWith('https://bipinchowdary.github.io/'))
        portfolioRequests.push(request.url())
    })

    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
      timeout: 8_000,
    })

    const title = page.locator('.project-title')
    const credit = page.locator('.project-credit')
    const status = page.locator('.status-banner')
    const link = page.getByRole('link', { name: 'Bipin Chowdary' })

    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute(
      'href',
      'https://bipinchowdary.github.io/',
    )
    await expect(link).toHaveAttribute('target', '_blank')
    await expectNoOverlap(title, credit)
    await expectNoOverlap(credit, status)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    expect(portfolioRequests).toEqual([])
    expect(consoleErrors).toEqual([])

    if (width === 1440 || width === 390) {
      await page.locator('.topbar').screenshot({
        path: `artifacts/screenshots/project-credit-${width === 1440 ? 'desktop' : 'mobile'}.png`,
      })
    }

    if (width === 1440) {
      const popupPromise = page.waitForEvent('popup')
      await link.click()
      const popup = await popupPromise
      await expect
        .poll(() => popup.url())
        .toMatch(/^https:\/\/bipinchowdary\.github\.io\//)
      expect(portfolioRequests.length).toBeGreaterThan(0)
      await popup.close()
    }
  })
}
