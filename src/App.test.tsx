import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => vi.mocked(loadScenario).mockResolvedValue(scenario))

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
})
