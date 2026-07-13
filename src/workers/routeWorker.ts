/// <reference lib="webworker" />
import { calculateRoute, decodeGrid } from '../routing/grid'
import type { Algorithm, NavigationGridArtifact } from '../types/scenario'

interface RouteRequest {
  id: number
  grid: NavigationGridArtifact
  start: [number, number]
  goal: [number, number]
  forecastIndex: number
  algorithms: Algorithm[]
}

self.onmessage = (event: MessageEvent<RouteRequest>) => {
  const { id, grid: artifact, start, goal, forecastIndex, algorithms } = event.data
  try {
    const grid = decodeGrid(artifact)
    const routes = algorithms.map((algorithm) => calculateRoute(grid, start, goal, algorithm, forecastIndex))
    self.postMessage({ id, routes })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Unknown routing error' })
  }
}
