import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { loadScenario } from './data/loadScenario'
import type {
  Algorithm,
  InteractiveRoute,
  LoadedScenario,
} from './types/scenario'

vi.mock('./components/CoastalMap', async () => {
  const React = await import('react')
  return {
    CoastalMap: React.forwardRef(function MapFixture(
      props: { onReady?: () => void },
      ref,
    ) {
      void ref
      React.useEffect(() => props.onReady?.(), [props])
      return <div aria-label="Interactive coastal map">Map fixture</div>
    }),
  }
})
vi.mock('./data/loadScenario', () => ({ loadScenario: vi.fn() }))
vi.mock('./routing/client', () => ({
  RoutingWorkerClient: class {
    status = 'idle'
    callback?: (status: string) => void
    constructor(callback?: (status: string) => void) {
      this.callback = callback
    }
    async initialize() {
      this.status = 'ready'
      this.callback?.('ready')
    }
    async calculate(start: [number, number], goal: [number, number]) {
      return (['shortest', 'fastest', 'energy', 'balanced'] as Algorithm[]).map(
        (algorithm, index): InteractiveRoute => ({
          algorithm,
          coordinates: [
            start,
            [
              (start[0] + goal[0]) / 2 + index * 0.0001,
              (start[1] + goal[1]) / 2,
            ],
            goal,
          ],
          pathLengthM: 40_000 + index * 100,
          travelTimeS: 20_000 + index * 100,
          modelledEnergyWh: 900 + index * 10,
          minimumDepthM: 8,
          meanCurrentMps: 0.3,
          riskScore: 0.2,
          computeTimeMs: 2,
          start,
          goal,
        }),
      )
    }
    dispose() {}
  },
}))

const scenario: LoadedScenario = {
  manifest: {
    schemaVersion: '1.0.0',
    id: 'south-florida-noaa-v1',
    title: 'South Florida Atlantic Shelf',
    version: '1.0.0',
    generatedAt: '2026-07-12T00:00:00Z',
    dataMode: 'pinned-noaa',
    immutable: true,
    bbox: [-80.2, 26, -79.9, 26.55],
    crs: { analysis: 'EPSG:32617', interchange: 'EPSG:4326' },
    forecastCycles: ['2026-07-03T00:00:00Z'],
    departureTimes: ['2026-07-03T00:00:00Z'],
    referenceVehicleId: 'reference-asv-v1',
    disclaimer:
      'Research demonstration only; not for navigation or operational mission planning.',
    citations: [],
    files: {},
    checksums: {},
  },
  metrics: {
    scenarioId: 'south-florida-noaa-v1',
    dataMode: 'pinned-noaa',
    computeTimingIncluded: false,
    results: [],
  },
  provenance: {
    scenarioId: 'south-florida-noaa-v1',
    status: 'verified',
    warning: '',
    analysisGrid: {
      crs: 'EPSG:32617',
      resolutionM: 500,
      nativeSourceResolutionPreservedInMetadata: true,
    },
    sources: [],
    transformations: [],
  },
  coastline: { type: 'FeatureCollection', features: [] },
  currents: { type: 'FeatureCollection', features: [] },
  stations: { type: 'FeatureCollection', features: [] },
  routes: { type: 'FeatureCollection', features: [] },
  bathymetryUrl: '/bathymetry.webp',
  navigationGrid: {
    version: 1,
    width: 1,
    height: 1,
    resolutionM: 500,
    forecastTimes: ['2026-07-03T00:00:00Z'],
    vehicle: {
      cruiseSpeedMps: 1.5,
      hotelPowerW: 30,
      propulsionCoefficient: 44.44,
    },
    encoding: { byteOrder: 'little', depthScaleM: 0.1, currentScaleMps: 0.001 },
    feasible: 'AQ==',
    depth: 'ZAA=',
    longitude: 'AACgwg==',
    latitude: 'AADAQQ==',
    currentEast: 'AAA=',
    currentNorth: 'AAA=',
    missions: [
      {
        id: 'test-mission',
        label: 'Test mission',
        start: [-80.05, 26.05],
        goal: [-80, 26.4],
      },
    ],
  },
}

describe('AquaNavAI application', () => {
  beforeEach(() => {
    vi.mocked(loadScenario).mockReset()
    vi.mocked(loadScenario).mockResolvedValue(scenario)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('reaches ready with four objective metrics and the research warning', async () => {
    render(<App />)
    expect(
      await screen.findByText('South Florida Atlantic Shelf'),
    ).toBeInTheDocument()
    expect(screen.getByText('Research use only')).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelectorAll('[data-route-metric]')).toHaveLength(4),
    )
    expect(
      document.querySelector('[data-init-stage="ready"]'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Interactive coastal map')).toBeInTheDocument()
    expect(
      screen.getByText('AquaNavAI — Project by Bipin Chowdary'),
    ).toBeInTheDocument()
    expect(screen.getByText('Scenario v1.0.0')).toBeInTheDocument()
  })

  it('links the header creator credit to the portfolio in a new tab', async () => {
    render(<App />)
    await screen.findByText('South Florida Atlantic Shelf')

    const link = screen.getByRole('link', { name: 'Bipin Chowdary' })
    expect(link).toHaveAttribute('href', 'https://bipinchowdary.github.io/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('exposes four independently toggleable route layers', async () => {
    const user = userEvent.setup()
    render(<App />)
    const checkboxes = await screen.findAllByRole('checkbox', { name: /show/i })
    expect(checkboxes).toHaveLength(4)
    expect(checkboxes[0]).toBeChecked()
    await user.click(checkboxes[0])
    await waitFor(() => expect(checkboxes[0]).not.toBeChecked())
  })

  it('treats a 10-second cold load as a soft warning and still reaches ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let resolveScenario: (value: LoadedScenario) => void = () => undefined
    vi.mocked(loadScenario).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveScenario = resolve
      }),
    )
    render(<App />)
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(
      screen.getByText(/still making progress and will continue safely/i),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-init-stage="failed"]')).toBeNull()
    await act(async () => {
      resolveScenario(scenario)
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(
        document.querySelector('[data-init-stage="ready"]'),
      ).toBeInTheDocument(),
    )
  })

  it('surfaces acquisition failure and retries from a clean run', async () => {
    vi.mocked(loadScenario)
      .mockRejectedValueOnce(new Error('HTTP 503 while loading release index'))
      .mockResolvedValueOnce(scenario)
    const user = userEvent.setup()
    render(<App />)
    expect(
      await screen.findByText(/HTTP 503 while loading release index/i),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(
        document.querySelector('[data-init-stage="ready"]'),
      ).toBeInTheDocument(),
    )
    expect(loadScenario).toHaveBeenCalledTimes(2)
  })

  it('requests the explicitly labelled proxy fixture after primary failure', async () => {
    vi.mocked(loadScenario)
      .mockRejectedValueOnce(new Error('Primary scenario unavailable'))
      .mockResolvedValueOnce({
        ...scenario,
        manifest: {
          ...scenario.manifest,
          id: 'south-florida-v1',
          dataMode: 'offline-proxy',
        },
      })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Primary scenario unavailable/i)
    await user.click(
      screen.getByRole('button', {
        name: 'Load deterministic proxy fixture',
      }),
    )
    await waitFor(() => expect(loadScenario).toHaveBeenCalledTimes(2))
    expect(vi.mocked(loadScenario).mock.calls[1]?.[0]).toBe('south-florida-v1')
  })
})
