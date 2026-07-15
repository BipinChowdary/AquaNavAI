import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoutingWorkerClient } from './client'
import type { NavigationGridArtifact } from '../types/scenario'

const grid = {
  version: 1,
  width: 1,
  height: 1,
  resolutionM: 500,
  forecastTimes: ['2026-07-12T00:00:00Z'],
  vehicle: {
    cruiseSpeedMps: 1.5,
    hotelPowerW: 30,
    propulsionCoefficient: 44.44,
  },
  encoding: {
    byteOrder: 'little',
    depthScaleM: 0.1,
    currentScaleMps: 0.001,
  },
  feasible: 'AQ==',
  depth: 'ZAA=',
  longitude: 'AACgwg==',
  latitude: 'AADAQQ==',
  currentEast: 'AAA=',
  currentNorth: 'AAA=',
  missions: [],
} satisfies NavigationGridArtifact

class WorkerFixture {
  static mode: 'error' | 'stall' = 'error'
  static terminated = 0
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage() {
    if (WorkerFixture.mode === 'error')
      queueMicrotask(() =>
        this.onerror?.({
          message: 'Failed to load routing worker script (HTTP 404).',
        } as ErrorEvent),
      )
  }
  terminate() {
    WorkerFixture.terminated += 1
  }
}

describe('RoutingWorkerClient initialization recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    WorkerFixture.terminated = 0
  })

  it('rejects an unavailable worker script without leaving pending state', async () => {
    WorkerFixture.mode = 'error'
    vi.stubGlobal('Worker', WorkerFixture)
    const client = new RoutingWorkerClient()
    await expect(client.initialize(grid)).rejects.toThrow(/HTTP 404/i)
    expect(client.status).toBe('error')
    client.dispose()
    expect(client.status).toBe('idle')
  })

  it('terminates a worker that never completes startup at the stall deadline', async () => {
    vi.useFakeTimers()
    WorkerFixture.mode = 'stall'
    vi.stubGlobal('Worker', WorkerFixture)
    const client = new RoutingWorkerClient()
    const initialization = client.initialize(grid, 30_000)
    const rejection = expect(initialization).rejects.toThrow(
      /30-second stall deadline/i,
    )
    await vi.advanceTimersByTimeAsync(30_000)
    await rejection
    expect(client.status).toBe('error')
    expect(WorkerFixture.terminated).toBeGreaterThan(0)
  })
})
