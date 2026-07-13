import { describe, expect, it } from 'vitest'
import { routeBearing, segmentDistance } from './useRouteAnimation'

describe('route animation geometry', () => {
  it('computes geodesic progress distance and vessel bearing', () => {
    const south: [number, number] = [-80.05, 26.0]
    const north: [number, number] = [-80.05, 26.1]
    expect(segmentDistance(south, north)).toBeGreaterThan(11_000)
    expect(segmentDistance(south, north)).toBeLessThan(11_200)
    expect(routeBearing(south, north)).toBeCloseTo(0, 5)
    expect(routeBearing(north, south)).toBeCloseTo(180, 5)
  })
})
