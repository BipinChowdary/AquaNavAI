import { expect, test } from '@playwright/test'

for (const width of [2048, 1440, 1024, 760, 390]) {
  test(`layout remains wide, readable, and overflow-free at ${width}px`, async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))

    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('[data-init-stage="ready"]')).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.locator('[data-route-metric]')).toHaveCount(4, {
      timeout: 15_000,
    })

    const appBox = await page.locator('.app-frame').boundingBox()
    const sidebarBox = await page.locator('.workspace-sidebar').boundingBox()
    const mapBox = await page.locator('.map-workspace').boundingBox()
    expect(appBox).not.toBeNull()
    expect(sidebarBox).not.toBeNull()
    expect(mapBox).not.toBeNull()
    if (!appBox || !sidebarBox || !mapBox) return

    const expectedWidth =
      width <= 760 ? width : Math.min(1920, Math.max(0, width - 24))
    expect(appBox.width).toBeCloseTo(expectedWidth, 0)
    if (width > 1100) expect(sidebarBox.width).toBeCloseTo(360, 0)
    else if (width > 760) expect(sidebarBox.width).toBeCloseTo(340, 0)
    else expect(sidebarBox.width).toBeCloseTo(appBox.width, 0)
    expect(mapBox.width).toBeGreaterThan(width > 760 ? 500 : 300)

    expect(
      await page.evaluate(() => {
        const controls = document.querySelector('.controls')
        const summary = document.querySelector('.scenario-summary')
        return Boolean(
          controls &&
          summary &&
          controls.compareDocumentPosition(summary) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
      }),
    ).toBe(true)

    const typography = await page.evaluate(() => {
      const select =
        document.querySelector<HTMLSelectElement>('.controls select')
      const objective = document.querySelector<HTMLElement>(
        '.route-objective strong',
      )
      const detail = document.querySelector<HTMLElement>(
        '.route-objective small',
      )
      const checkbox = document.querySelector<HTMLInputElement>(
        '.visibility-toggle input',
      )
      const line = document.querySelector<HTMLElement>('.legend-line')
      return {
        select: select
          ? Number.parseFloat(getComputedStyle(select).fontSize)
          : 0,
        objective: objective
          ? Number.parseFloat(getComputedStyle(objective).fontSize)
          : 0,
        detail: detail
          ? Number.parseFloat(getComputedStyle(detail).fontSize)
          : 0,
        checkbox: checkbox?.getBoundingClientRect().width ?? 0,
        line: line?.getBoundingClientRect().width ?? 0,
      }
    })
    expect(typography.select).toBeGreaterThanOrEqual(15)
    expect(typography.objective).toBeGreaterThanOrEqual(12)
    expect(typography.detail).toBeGreaterThanOrEqual(10)
    expect(typography.checkbox).toBeGreaterThanOrEqual(16)
    expect(typography.line).toBeGreaterThanOrEqual(38)

    await expect(
      page.getByRole('heading', { name: 'Data provenance and limitations' }),
    ).toBeVisible()
    await expect(page.locator('details.provenance')).toHaveCount(0)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    expect(consoleErrors).toEqual([])

    if (width === 2048 || width === 390)
      await page.screenshot({
        path: `artifacts/screenshots/layout-${width === 2048 ? 'desktop' : 'mobile'}.png`,
        fullPage: true,
      })
  })
}
