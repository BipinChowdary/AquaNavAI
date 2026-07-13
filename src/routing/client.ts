import type { Algorithm, InteractiveRoute, NavigationGridArtifact } from '../types/scenario'

let requestId = 0

export function calculateRoutesInWorker(
  grid: NavigationGridArtifact,
  start: [number, number],
  goal: [number, number],
  forecastIndex: number,
  algorithms: Algorithm[] = ['distance', 'environmental'],
) {
  return new Promise<InteractiveRoute[]>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/routeWorker.ts', import.meta.url), { type: 'module' })
    const id = ++requestId
    worker.onmessage = (event: MessageEvent<{ id: number; routes?: InteractiveRoute[]; error?: string }>) => {
      if (event.data.id !== id) return
      worker.terminate()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.routes ?? [])
    }
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)) }
    worker.postMessage({ id, grid, start, goal, forecastIndex, algorithms })
  })
}
