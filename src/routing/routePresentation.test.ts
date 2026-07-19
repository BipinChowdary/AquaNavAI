import { describe, expect, it } from 'vitest'
import type { InteractiveRoute, LoadedScenario } from '../types/scenario'
import {
  exactOverlapMessage,
  objectiveRouteCollection,
  routeCasingLayerId,
  routeLayerId,
  routeSourceId,
  ROUTE_ALGORITHMS,
} from './routePresentation'

const scenario = {
  routes: { type: 'FeatureCollection', features: [] },
} as unknown as LoadedScenario

function route(
  algorithm: InteractiveRoute['algorithm'],
  coordinates: InteractiveRoute['coordinates'],
): InteractiveRoute {
  return {
    algorithm,
    coordinates,
    pathLengthM: 1,
    travelTimeS: 1,
    modelledEnergyWh: 1,
    minimumDepthM: 1,
    meanCurrentMps: 1,
    riskScore: 1,
    computeTimeMs: 1,
    start: coordinates[0],
    goal: coordinates.at(-1) ?? coordinates[0],
  }
}

describe('custom-route presentation contract', () => {
  it('keeps all four algorithm results in unique sources and layers', () => {
    const routes = ROUTE_ALGORITHMS.map((algorithm, index) =>
      route(algorithm, [
        [-80.05, 26.1],
        [-80 + index * 0.001, 26.2],
        [-79.95, 26.3],
      ]),
    )

    expect(new Set(routes.map((candidate) => candidate.algorithm))).toEqual(
      new Set(ROUTE_ALGORITHMS),
    )
    expect(new Set(ROUTE_ALGORITHMS.map(routeSourceId)).size).toBe(4)
    expect(new Set(ROUTE_ALGORITHMS.map(routeLayerId)).size).toBe(4)
    expect(new Set(ROUTE_ALGORITHMS.map(routeCasingLayerId)).size).toBe(4)

    const collections = ROUTE_ALGORITHMS.map((algorithm) =>
      objectiveRouteCollection(
        scenario,
        routes,
        'custom',
        '2026-07-03T00:00:00Z',
        algorithm,
      ),
    )
    expect(collections).toHaveLength(4)
    expect(
      collections.map(
        (collection) => collection.features[0]?.properties.algorithm,
      ),
    ).toEqual(ROUTE_ALGORITHMS)
    expect(
      collections.every((collection) => collection.features.length === 1),
    ).toBe(true)
  })

  it('reports exact objective overlap without changing true geometry', () => {
    const shared: [number, number][] = [
      [-80.05, 26.1],
      [-80, 26.2],
      [-79.95, 26.3],
    ]
    const routes = [
      route('shortest', [shared[0], [-80.01, 26.21], shared[2]]),
      route(
        'fastest',
        shared.map(([lon, lat]) => [lon, lat]),
      ),
      route(
        'energy',
        shared.map(([lon, lat]) => [lon, lat]),
      ),
      route(
        'balanced',
        shared.map(([lon, lat]) => [lon, lat]),
      ),
    ]

    expect(exactOverlapMessage(routes)).toContain(
      'Fastest, lowest-energy, and balanced objectives overlap exactly',
    )
    expect(routes[1].coordinates).toEqual(shared)
    expect(routes[2].coordinates).toEqual(shared)
    expect(routes[3].coordinates).toEqual(shared)
  })
})
