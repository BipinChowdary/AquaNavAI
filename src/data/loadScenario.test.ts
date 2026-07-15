/// <reference types="node" />
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResourceDiagnostic } from '../initialization/diagnostics'
import { loadScenario } from './loadScenario'

const json = (value: unknown) => JSON.stringify(value)
const checksum = (value: string) =>
  createHash('sha256').update(value).digest('hex')

function fixture() {
  const artifacts: Record<string, string> = {
    'bathymetry.webp': 'bounded-image-fixture',
    'coastline.geojson': json({ type: 'FeatureCollection', features: [] }),
    'currents.geojson': json({ type: 'FeatureCollection', features: [] }),
    'metrics.json': json({
      scenarioId: 'south-florida-v1',
      dataMode: 'offline-proxy',
      computeTimingIncluded: false,
      results: [],
    }),
    'provenance.json': json({
      scenarioId: 'south-florida-v1',
      status: 'proxy',
      warning: 'proxy',
      analysisGrid: {},
      sources: [],
      transformations: [],
    }),
    'routes.geojson': json({ type: 'FeatureCollection', features: [] }),
    'stations.geojson': json({ type: 'FeatureCollection', features: [] }),
  }
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
    disclaimer: 'Research demonstration only; not for navigation.',
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
    checksums: Object.fromEntries(
      Object.entries(artifacts).map(([name, body]) => [name, checksum(body)]),
    ),
  }
  const responses: Record<string, string> = {
    '/scenarios/index.json': json({
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
    }),
    '/scenarios/south-florida-v1/manifest.json': json(manifest),
    ...Object.fromEntries(
      Object.entries(artifacts).map(([name, body]) => [
        `/scenarios/south-florida-v1/${name}`,
        body,
      ]),
    ),
  }
  return { responses }
}

function installFetch(
  responses: Record<string, string>,
  mutate?: (url: string, body: string) => string,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const path = new URL(url, window.location.origin).pathname
      const body = responses[path]
      if (body === undefined) return new Response('missing', { status: 404 })
      return new Response(mutate?.(path, body) ?? body, {
        status: 200,
        headers: { 'content-length': String(body.length) },
      })
    }),
  )
}

describe('loadScenario', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads same-origin artifacts and verifies every released checksum', async () => {
    const { responses } = fixture()
    const diagnostics: ResourceDiagnostic[] = []
    installFetch(responses)
    const loaded = await loadScenario(undefined, {
      onResource: (resource) => diagnostics.push(resource),
    })
    expect(loaded.manifest.id).toBe('south-florida-v1')
    expect(loaded.bathymetryUrl).toBe(
      `/scenarios/south-florida-v1/bathymetry.webp?sha256=${checksum('bounded-image-fixture')}`,
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(9)
    const final = new Map(diagnostics.map((item) => [item.name, item]))
    expect(
      [...final.values()]
        .filter((item) => item.expectedChecksum)
        .every((item) => item.outcome === 'verified'),
    ).toBe(true)
  })

  it('fails closed when a released artifact checksum is corrupt', async () => {
    const { responses } = fixture()
    installFetch(responses, (url, body) =>
      url.endsWith('/metrics.json') ? `${body} ` : body,
    )
    await expect(loadScenario()).rejects.toThrow(/checksum mismatch.*metrics/i)
  })

  it('reports an actionable HTTP error for a missing artifact', async () => {
    const { responses } = fixture()
    delete responses['/scenarios/south-florida-v1/routes.geojson']
    installFetch(responses)
    await expect(loadScenario()).rejects.toThrow(/HTTP 404.*routes\.geojson/i)
  })

  it('rejects a manifest with an unsafe cross-directory artifact path', async () => {
    const { responses } = fixture()
    const manifestPath = '/scenarios/south-florida-v1/manifest.json'
    const manifest = JSON.parse(responses[manifestPath])
    manifest.files.routes = '../routes.geojson'
    manifest.checksums['../routes.geojson'] = 'a'.repeat(64)
    responses[manifestPath] = json(manifest)
    installFetch(responses)
    await expect(loadScenario()).rejects.toThrow(/unsafe artifact path/i)
  })

  it('rejects corrupt JSON after checksum verification', async () => {
    const { responses } = fixture()
    const metricsPath = '/scenarios/south-florida-v1/metrics.json'
    responses[metricsPath] = '{not-json'
    const manifestPath = '/scenarios/south-florida-v1/manifest.json'
    const manifest = JSON.parse(responses[manifestPath])
    manifest.checksums['metrics.json'] = checksum(responses[metricsPath])
    responses[manifestPath] = json(manifest)
    installFetch(responses)
    await expect(loadScenario()).rejects.toThrow(
      /metrics\.json is not valid JSON/i,
    )
  })

  it('rejects a stale index paired with a different manifest version', async () => {
    const { responses } = fixture()
    const manifestPath = '/scenarios/south-florida-v1/manifest.json'
    const manifest = JSON.parse(responses[manifestPath])
    manifest.version = '2.0.0'
    responses[manifestPath] = json(manifest)
    installFetch(responses)
    await expect(loadScenario()).rejects.toThrow(/index and scenario manifest/i)
  })

  it('rejects a schema-invalid manifest before downloading artifacts', async () => {
    const { responses } = fixture()
    const manifestPath = '/scenarios/south-florida-v1/manifest.json'
    const manifest = JSON.parse(responses[manifestPath])
    manifest.bbox = [-80.2, 'invalid', -79.9, 26.55]
    responses[manifestPath] = json(manifest)
    installFetch(responses)
    await expect(loadScenario()).rejects.toThrow(/bounding box is invalid/i)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })
})
