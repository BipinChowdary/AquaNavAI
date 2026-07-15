import type {
  Algorithm,
  InteractiveRoute,
  NavigationGridArtifact,
} from '../types/scenario'

export type WorkerStatus =
  'idle' | 'initializing' | 'ready' | 'routing' | 'error'

interface WorkerMessage {
  type: 'ready' | 'result' | 'error'
  id: number
  routes?: InteractiveRoute[]
  errors?: Partial<Record<Algorithm, string>>
  message?: string
  decodeTimeMs?: number
}

interface PendingRequest {
  resolve: (routes: InteractiveRoute[]) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class RoutingWorkerClient {
  private worker: Worker | null = null
  private sequence = 0
  private pending = new Map<number, PendingRequest>()
  private latestRouteRequest = 0
  status: WorkerStatus = 'idle'
  decodeTimeMs = 0
  startupTimeMs = 0
  private readonly onStatus?: (status: WorkerStatus) => void

  constructor(onStatus?: (status: WorkerStatus) => void) {
    this.onStatus = onStatus
  }

  private setStatus(status: WorkerStatus) {
    this.status = status
    this.onStatus?.(status)
  }

  async initialize(grid: NavigationGridArtifact, timeoutMs = 30_000) {
    this.dispose()
    this.setStatus('initializing')
    const started = performance.now()
    const worker = new Worker(
      new URL('../workers/routeWorker.ts', import.meta.url),
      {
        type: 'module',
      },
    )
    this.worker = worker
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.type === 'ready') {
        this.decodeTimeMs = message.decodeTimeMs ?? 0
        this.startupTimeMs = performance.now() - started
        this.setStatus('ready')
      }
      const request = this.pending.get(message.id)
      if (!request) return
      clearTimeout(request.timer)
      this.pending.delete(message.id)
      if (message.type === 'error') {
        request.reject(new Error(message.message ?? 'Routing worker failed.'))
      } else if (message.type === 'ready') {
        request.resolve([])
      } else if (message.routes?.length) {
        request.resolve(message.routes)
      } else if (message.errors && Object.keys(message.errors).length) {
        const reasons = [...new Set(Object.values(message.errors))]
        request.reject(new Error(reasons.join(' ')))
      } else {
        request.reject(new Error('No route objective could be calculated.'))
      }
    }
    const fail = (message: string) => {
      this.setStatus('error')
      if (this.worker === worker) {
        worker.terminate()
        this.worker = null
      }
      for (const request of this.pending.values()) {
        clearTimeout(request.timer)
        request.reject(new Error(message))
      }
      this.pending.clear()
    }
    worker.onerror = (event) => fail(event.message || 'Routing worker crashed.')
    worker.onmessageerror = () =>
      fail('Routing worker returned an unreadable message.')
    const id = ++this.sequence
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id)
          if (this.worker === worker) {
            worker.terminate()
            this.worker = null
          }
          this.setStatus('error')
          reject(
            new Error(
              `Routing worker made no progress before the ${Math.round(timeoutMs / 1000)}-second stall deadline.`,
            ),
          )
        }, timeoutMs)
        this.pending.set(id, {
          resolve: () => resolve(),
          reject,
          timer,
        })
        worker.postMessage({ type: 'init', id, grid })
      })
    } catch (reason) {
      if (this.worker === worker) {
        worker.terminate()
        this.worker = null
      }
      this.setStatus('error')
      throw reason
    }
  }

  async calculate(
    start: [number, number],
    goal: [number, number],
    forecastIndex: number,
    algorithms: Algorithm[] = ['shortest', 'fastest', 'energy', 'balanced'],
    timeoutMs = 15_000,
  ) {
    if (
      !this.worker ||
      this.status === 'idle' ||
      this.status === 'initializing'
    )
      throw new Error('The routing worker is not ready yet.')
    const id = ++this.sequence
    this.latestRouteRequest = id
    this.setStatus('routing')
    for (const [pendingId, request] of this.pending) {
      clearTimeout(request.timer)
      request.reject(new Error('Route request superseded by a newer mission.'))
      this.pending.delete(pendingId)
    }
    return new Promise<InteractiveRoute[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        if (id === this.latestRouteRequest) this.setStatus('error')
        reject(new Error('Route calculation timed out after 15 seconds.'))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (routes) => {
          if (id !== this.latestRouteRequest) return
          this.setStatus('ready')
          resolve(routes)
        },
        reject: (reason) => {
          if (id === this.latestRouteRequest) this.setStatus('ready')
          reject(reason)
        },
        timer,
      })
      this.worker?.postMessage({
        type: 'route',
        id,
        start,
        goal,
        forecastIndex,
        algorithms,
      })
    })
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.reject(new Error('Routing worker was disposed.'))
    }
    this.pending.clear()
    this.decodeTimeMs = 0
    this.startupTimeMs = 0
    this.setStatus('idle')
  }
}
