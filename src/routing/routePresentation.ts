import type { FeatureCollection, LineString } from 'geojson'
import type {
  Algorithm,
  InteractiveRoute,
  LoadedScenario,
} from '../types/scenario'

export const ROUTE_ALGORITHMS = [
  'shortest',
  'fastest',
  'energy',
  'balanced',
] as const satisfies readonly Algorithm[]

export const routeSourceId = (algorithm: Algorithm) =>
  `${algorithm}-route-source`

export const routeLayerId = (algorithm: Algorithm) => `${algorithm}-route`

export const routeCasingLayerId = (algorithm: Algorithm) =>
  `${algorithm}-route-casing`

export function objectiveRouteCollection(
  scenario: LoadedScenario,
  routes: InteractiveRoute[],
  pairId: string,
  cycle: string,
  algorithm: Algorithm,
): FeatureCollection<LineString, Record<string, unknown>> {
  if (routes.length || pairId === 'custom') {
    const route = routes.find((candidate) => candidate.algorithm === algorithm)
    return {
      type: 'FeatureCollection',
      features: route
        ? [
            {
              type: 'Feature',
              properties: {
                pairId,
                forecastCycle: cycle,
                algorithm: route.algorithm,
                interactive: true,
              },
              geometry: {
                type: 'LineString',
                coordinates: route.coordinates,
              },
            },
          ]
        : [],
    }
  }

  return {
    type: 'FeatureCollection',
    features: scenario.routes.features.flatMap((feature) =>
      feature.geometry.type === 'LineString' &&
      feature.properties?.algorithm === algorithm
        ? [
            {
              type: 'Feature' as const,
              properties: feature.properties ?? {},
              geometry: feature.geometry,
            },
          ]
        : [],
    ),
  }
}

function sameCoordinates(
  first: InteractiveRoute['coordinates'],
  second: InteractiveRoute['coordinates'],
) {
  return (
    first.length === second.length &&
    first.every(
      (coordinate, index) =>
        coordinate[0] === second[index][0] &&
        coordinate[1] === second[index][1],
    )
  )
}

export function exactOverlapGroups(routes: InteractiveRoute[]) {
  const groups: Algorithm[][] = []
  const assigned = new Set<Algorithm>()
  for (const algorithm of ROUTE_ALGORITHMS) {
    if (assigned.has(algorithm)) continue
    const route = routes.find((candidate) => candidate.algorithm === algorithm)
    if (!route) continue
    const group = routes
      .filter((candidate) =>
        sameCoordinates(route.coordinates, candidate.coordinates),
      )
      .map((candidate) => candidate.algorithm)
      .filter((candidate) => !assigned.has(candidate))
    if (group.length < 2) continue
    group.forEach((candidate) => assigned.add(candidate))
    groups.push(group)
  }
  return groups
}

const objectiveNames: Record<Algorithm, string> = {
  shortest: 'shortest-distance',
  fastest: 'fastest',
  energy: 'lowest-energy',
  balanced: 'balanced',
}

export function exactOverlapMessage(routes: InteractiveRoute[]) {
  const groups = exactOverlapGroups(routes)
  if (!groups.length) return null
  const descriptions = groups.map((group) => {
    const names = group.map((algorithm) => objectiveNames[algorithm])
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
  })
  const description = descriptions.join('; ')
  return `${description[0].toUpperCase()}${description.slice(1)} objectives overlap exactly for this mission and forecast cycle. This is a model result; select an objective to draw it above the overlapping routes.`
}
