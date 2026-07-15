/// <reference lib="webworker" />
import { calculateRoute, decodeGrid, type DecodedGrid } from '../routing/grid'
import type { Algorithm, NavigationGridArtifact } from '../types/scenario'

type WorkerRequest =
  | { type: 'init'; id: number; grid: NavigationGridArtifact }
  | {
      type: 'route'
      id: number
      start: [number, number]
      goal: [number, number]
      forecastIndex: number
      algorithms: Algorithm[]
    }

let grid: DecodedGrid | null = null

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'init') {
      const started = performance.now()
      grid = decodeGrid(request.grid)
      self.postMessage({
        type: 'ready',
        id: request.id,
        decodeTimeMs: performance.now() - started,
      })
      return
    }
    if (!grid) throw new Error('Routing grid has not been initialized.')
    const routes = []
    const errors: Partial<Record<Algorithm, string>> = {}
    for (const algorithm of request.algorithms) {
      try {
        routes.push(
          calculateRoute(
            grid,
            request.start,
            request.goal,
            algorithm,
            request.forecastIndex,
          ),
        )
      } catch (error) {
        errors[algorithm] =
          error instanceof Error ? error.message : 'Unknown routing error'
      }
    }
    self.postMessage({ type: 'result', id: request.id, routes, errors })
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : 'Unknown routing error',
    })
  }
}
