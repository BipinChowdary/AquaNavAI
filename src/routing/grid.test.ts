import { describe, expect, it } from 'vitest'
import { calculateRoute, decodeGrid, nearestFeasible } from './grid'
import type { NavigationGridArtifact } from '../types/scenario'
import artifactData from '../../public/scenarios/south-florida-noaa-v1/navigation-grid.json'

const artifact = artifactData as NavigationGridArtifact

describe('browser routing contract', () => {
  it('decodes the pinned little-endian grid and snaps only to feasible cells', () => {
    const grid = decodeGrid(artifact)
    expect(grid.width * grid.height).toBe(grid.feasible.length)
    expect(grid.latitude[grid.width]).toBeGreaterThan(grid.latitude[0])
    expect(
      grid.feasible[nearestFeasible(grid, artifact.missions[0].start)],
    ).toBe(1)
    expect(() => nearestFeasible(grid, [-81, 27])).toThrow(
      /outside the pinned NOAA study domain/,
    )
    expect(() => nearestFeasible(grid, [-80.15, 26.1])).toThrow(
      /land, shallow water/,
    )
  })

  it('reproduces compatible Python route metrics well below the interactive target', () => {
    const grid = decodeGrid(artifact)
    const mission = artifact.missions[0]
    const routes = (['shortest', 'fastest', 'energy', 'balanced'] as const).map(
      (objective) =>
        calculateRoute(grid, mission.start, mission.goal, objective, 0),
    )
    const [distance, , environmental] = routes
    expect(distance.computeTimeMs).toBeLessThan(2000)
    expect(environmental.computeTimeMs).toBeLessThan(2000)
    expect(distance.pathLengthM).toBeCloseTo(42_207.11, -1)
    expect(environmental.modelledEnergyWh).toBeCloseTo(891.08, 0)
    expect(distance.minimumDepthM).toBeGreaterThanOrEqual(5)
    expect(routes.every((route) => route.coordinates.length > 2)).toBe(true)
    expect(
      routes.every((route) => route.riskScore >= 0 && route.riskScore <= 1),
    ).toBe(true)
    expect(routes[3].travelTimeS).toBeLessThanOrEqual(distance.travelTimeS)
    expect(
      calculateRoute(grid, mission.start, mission.goal, 'balanced', 0)
        .coordinates,
    ).toEqual(routes[3].coordinates)
    expect(
      environmental.coordinates.every(([lon, lat]) =>
        Number.isFinite(lon + lat),
      ),
    ).toBe(true)
  })
})
