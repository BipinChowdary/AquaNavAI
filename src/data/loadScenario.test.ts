import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadScenario } from './loadScenario'

const manifest = {
  schemaVersion: '1.0.0',
  id: 'south-florida-v1',
  title: 'South Florida Atlantic Shelf',
  version: '1.0.0',
  generatedAt: '2026-07-12T00:00:00Z',
  dataMode: 'offline-proxy',
  immutable: true,
  bbox: [-80.2, 26, -79.9, 26.55],
  crs: { analysis: 'EPSG:32617', interchange: 'EPSG:4326' },
  forecastCycles: ['2026-07-03T00:00:00Z'],
  departureTimes: ['2026-07-03T00:00:00Z'],
  referenceVehicleId: 'reference-asv-v1',
  disclaimer: 'Research demonstration only; not for operational navigation.',
  citations: [],
  files: {
    bathymetry: 'bathymetry.webp',
    coastline: 'coastline.geojson',
    currents: 'currents.geojson',
    metrics: 'metrics.json',
    provenance: 'provenance.json',
    routes: 'routes.geojson',
    stations: 'stations.geojson',
  },
  checksums: { 'metrics.json': 'a'.repeat(64) },
}

describe('loadScenario', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads only same-origin release artifacts after validating the manifest', async () => {
    const responses: Record<string, unknown> = {
      '/scenarios/index.json': {
        schemaVersion: '1.0.0',
        scenarios: [
          {
            id: 'south-florida-v1',
            title: 'South Florida',
            version: '1.0.0',
            manifest: '/scenarios/south-florida-v1/manifest.json',
            dataMode: 'offline-proxy',
          },
        ],
      },
      '/schemas/scenario.schema.json': { type: 'object', required: ['id'] },
      '/scenarios/south-florida-v1/manifest.json': manifest,
      '/scenarios/south-florida-v1/metrics.json': {
        scenarioId: 'south-florida-v1',
        dataMode: 'offline-proxy',
        computeTimingIncluded: false,
        results: [],
      },
      '/scenarios/south-florida-v1/provenance.json': {
        scenarioId: 'south-florida-v1',
        status: 'proxy',
        warning: 'proxy',
        analysisGrid: {},
        sources: [],
        transformations: [],
      },
      '/scenarios/south-florida-v1/coastline.geojson': {
        type: 'FeatureCollection',
        features: [],
      },
      '/scenarios/south-florida-v1/currents.geojson': {
        type: 'FeatureCollection',
        features: [],
      },
      '/scenarios/south-florida-v1/stations.geojson': {
        type: 'FeatureCollection',
        features: [],
      },
      '/scenarios/south-florida-v1/routes.geojson': {
        type: 'FeatureCollection',
        features: [],
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url in responses,
        status: url in responses ? 200 : 404,
        json: async () => responses[url],
      })),
    )
    const loaded = await loadScenario()
    expect(loaded.manifest.id).toBe('south-florida-v1')
    expect(loaded.bathymetryUrl).toBe(
      '/scenarios/south-florida-v1/bathymetry.webp',
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(8)
  })
})
