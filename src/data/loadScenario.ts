import type {
  GeoJsonFeatureCollection,
  LoadedScenario,
  MetricsArtifact,
  ProvenanceArtifact,
  ScenarioIndex,
  ScenarioManifest,
  NavigationGridArtifact,
} from '../types/scenario'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Unable to load ${url}: HTTP ${response.status}`)
  return (await response.json()) as T
}

function assertManifest(value: unknown): asserts value is ScenarioManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Scenario manifest must be an object.')
  const manifest = value as Record<string, unknown>
  const files = manifest.files as Record<string, unknown> | undefined
  const checksums = manifest.checksums as Record<string, unknown> | undefined
  const requiredFiles = [
    'bathymetry',
    'coastline',
    'currents',
    'metrics',
    'provenance',
    'routes',
    'stations',
  ]
  if (
    manifest.schemaVersion !== '1.0.0' ||
    typeof manifest.id !== 'string' ||
    !/^[a-z0-9-]+$/.test(manifest.id) ||
    !['offline-proxy', 'pinned-noaa'].includes(String(manifest.dataMode)) ||
    manifest.immutable !== true
  )
    throw new Error('Scenario manifest identity or release mode is invalid.')
  if (
    !Array.isArray(manifest.bbox) ||
    manifest.bbox.length !== 4 ||
    !manifest.bbox.every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    )
  )
    throw new Error('Scenario manifest bounding box is invalid.')
  if (
    !Array.isArray(manifest.forecastCycles) ||
    !manifest.forecastCycles.length ||
    !manifest.forecastCycles.every(
      (item) => typeof item === 'string' && !Number.isNaN(Date.parse(item)),
    )
  )
    throw new Error('Scenario forecast timestamps are invalid.')
  if (
    !files ||
    requiredFiles.some((key) => typeof files[key] !== 'string') ||
    (manifest.dataMode === 'pinned-noaa' && typeof files.grid !== 'string')
  )
    throw new Error('Scenario manifest file contract is incomplete.')
  if (
    !checksums ||
    !Object.values(checksums).every(
      (checksum) =>
        typeof checksum === 'string' && /^[a-f0-9]{64}$/.test(checksum),
    )
  )
    throw new Error('Scenario artifact checksum contract is invalid.')
}

export async function loadScenario(id?: string): Promise<LoadedScenario> {
  const index = await fetchJson<ScenarioIndex>('/scenarios/index.json')
  const requestedId = id ?? index.scenarios[0]?.id
  const entry = index.scenarios.find((scenario) => scenario.id === requestedId)
  if (!entry)
    throw new Error(
      `Scenario '${requestedId}' is not listed in the release index.`,
    )
  const manifest: unknown = await fetchJson(entry.manifest)
  assertManifest(manifest)
  const base = `/scenarios/${manifest.id}/`
  const [metrics, provenance, coastline, currents, stations, routes] =
    await Promise.all([
      fetchJson<MetricsArtifact>(base + manifest.files.metrics),
      fetchJson<ProvenanceArtifact>(base + manifest.files.provenance),
      fetchJson<GeoJsonFeatureCollection>(base + manifest.files.coastline),
      fetchJson<GeoJsonFeatureCollection>(base + manifest.files.currents),
      fetchJson<GeoJsonFeatureCollection>(base + manifest.files.stations),
      fetchJson<GeoJsonFeatureCollection>(base + manifest.files.routes),
    ])
  const navigationGrid = manifest.files.grid
    ? await fetchJson<NavigationGridArtifact>(base + manifest.files.grid)
    : null
  return {
    manifest,
    metrics,
    provenance,
    coastline,
    currents,
    stations,
    routes,
    bathymetryUrl: base + manifest.files.bathymetry,
    navigationGrid,
  }
}
