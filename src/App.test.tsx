import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { loadScenario } from './data/loadScenario'
import type { LoadedScenario } from './types/scenario'

vi.mock('./components/CoastalMap', () => ({
  CoastalMap: () => <div aria-label="Interactive coastal map">Map fixture</div>,
}))
vi.mock('./data/loadScenario', () => ({ loadScenario: vi.fn() }))

const metric = (algorithm: 'distance' | 'environmental', energy: number) => ({
  id: `${algorithm}-result`,
  pair_id: 'shelf-northbound',
  algorithm,
  forecast_cycle: '2026-07-03T00:00:00Z',
  departure_time: '2026-07-03T00:00:00Z',
  path_length_m: algorithm === 'distance' ? 44_000 : 45_000,
  travel_time_s: algorithm === 'distance' ? 25_000 : 24_000,
  modelled_propulsion_energy_wh: energy,
  minimum_depth_m: 8.2,
  mean_current_mps: 0.3,
  compute_time_ms: 0,
  compute_emissions_kg: null,
})

const scenario: LoadedScenario = {
  manifest: {
    schemaVersion: '1.0.0',
    id: 'south-florida-v1',
    title: 'South Florida Atlantic Shelf',
    version: '1.0.0-proxy.1',
    generatedAt: '2026-07-12T00:00:00Z',
    dataMode: 'offline-proxy',
    immutable: true,
    bbox: [-80.2, 26, -79.9, 26.55],
    crs: { analysis: 'EPSG:32617', interchange: 'EPSG:4326' },
    forecastCycles: ['2026-07-03T00:00:00Z'],
    departureTimes: ['2026-07-03T00:00:00Z'],
    referenceVehicleId: 'reference-asv-v1',
    disclaimer: 'Research demonstration only; not for navigation or operational mission planning.',
    citations: [],
    files: {},
    checksums: {},
  },
  metrics: {
    scenarioId: 'south-florida-v1',
    dataMode: 'offline-proxy',
    computeTimingIncluded: false,
    results: [metric('distance', 1300), metric('environmental', 1200)],
  },
  provenance: {
    scenarioId: 'south-florida-v1',
    status: 'proxy',
    warning: 'Proxy data only.',
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
}

describe('AquaNavAI application', () => {
  beforeEach(() => {
    vi.mocked(loadScenario).mockResolvedValue(scenario)
  })

  it('presents the pinned scenario, research warning, and paired metrics', async () => {
    render(<App />)
    expect(await screen.findByText('South Florida Atlantic Shelf')).toBeInTheDocument()
    expect(screen.getByText('Research use only')).toBeInTheDocument()
    expect(screen.getByText('Route outcome')).toBeInTheDocument()
    expect(screen.getByLabelText('Interactive coastal map')).toBeInTheDocument()
  })

  it('allows route visibility controls to be changed', async () => {
    const user = userEvent.setup()
    render(<App />)
    const checkbox = await screen.findByRole('checkbox', { name: /distance baseline/i })
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })
})
