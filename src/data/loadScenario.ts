import type { ResourceDiagnostic } from '../initialization/diagnostics'
import type {
  GeoJsonFeatureCollection,
  LoadedScenario,
  MetricsArtifact,
  NavigationGridArtifact,
  ProvenanceArtifact,
  ScenarioIndex,
  ScenarioManifest,
} from '../types/scenario'

export type ScenarioLoadStage =
  | 'loading_release_index'
  | 'loading_manifest'
  | 'downloading_artifacts'
  | 'verifying_checksums'
  | 'validating_contract'

export interface ScenarioLoadOptions {
  signal?: AbortSignal
  onStage?: (stage: ScenarioLoadStage) => void
  onResource?: (diagnostic: ResourceDiagnostic) => void
}

interface DownloadedResource {
  bytes: ArrayBuffer
  diagnostic: ResourceDiagnostic
}

function sameOriginPath(url: string) {
  const parsed = new URL(url, window.location.origin)
  if (parsed.origin !== window.location.origin)
    throw new Error(`Cross-origin scenario resource rejected: ${parsed.origin}`)
  return `${parsed.pathname}${parsed.search}`
}

async function download(
  name: string,
  url: string,
  expectedChecksum: string | null,
  options: ScenarioLoadOptions,
): Promise<DownloadedResource> {
  const path = sameOriginPath(url)
  const started = performance.now()
  const diagnostic: ResourceDiagnostic = {
    name,
    url: path,
    status: null,
    contentLength: null,
    expectedChecksum,
    actualChecksum: null,
    durationMs: null,
    outcome: 'pending',
  }
  options.onResource?.(diagnostic)
  try {
    const response = await fetch(path, {
      cache: 'default',
      credentials: 'same-origin',
      signal: options.signal,
    })
    diagnostic.status = response.status
    if (!response.ok)
      throw new Error(`HTTP ${response.status} while loading ${path}`)
    const bytes = await response.arrayBuffer()
    diagnostic.contentLength = bytes.byteLength
    diagnostic.durationMs = performance.now() - started
    diagnostic.outcome = 'downloaded'
    options.onResource?.({ ...diagnostic })
    return { bytes, diagnostic }
  } catch (reason) {
    diagnostic.durationMs = performance.now() - started
    diagnostic.outcome = 'failed'
    diagnostic.error =
      reason instanceof Error ? reason.message : 'Unknown download error'
    options.onResource?.({ ...diagnostic })
    throw reason
  }
}

function decodeJson<T>(resource: DownloadedResource): T {
  try {
    return JSON.parse(new TextDecoder().decode(resource.bytes)) as T
  } catch {
    throw new Error(`${resource.diagnostic.name} is not valid JSON.`)
  }
}

async function sha256(bytes: ArrayBuffer) {
  if (!globalThis.crypto?.subtle)
    throw new Error('This browser cannot verify SHA-256 scenario checksums.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
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
  for (const file of Object.values(files)) {
    if (typeof file !== 'string') continue
    if (file.includes('/') || file.includes('\\') || file.includes('..'))
      throw new Error('Scenario manifest contains an unsafe artifact path.')
    if (!checksums[file])
      throw new Error(`Scenario checksum is missing for ${file}.`)
  }
}

function assertArtifactContract(
  manifest: ScenarioManifest,
  metrics: MetricsArtifact,
  provenance: ProvenanceArtifact,
) {
  if (
    metrics.scenarioId !== manifest.id ||
    metrics.dataMode !== manifest.dataMode
  )
    throw new Error('Metrics identity does not match the scenario manifest.')
  if (provenance.scenarioId !== manifest.id)
    throw new Error('Provenance identity does not match the scenario manifest.')
}

export async function loadScenario(
  id?: string,
  options: ScenarioLoadOptions = {},
): Promise<LoadedScenario> {
  options.onStage?.('loading_release_index')
  const indexDownload = await download(
    'release index',
    '/scenarios/index.json',
    null,
    options,
  )
  const index = decodeJson<ScenarioIndex>(indexDownload)
  const requestedId = id ?? index.scenarios[0]?.id
  const entry = index.scenarios.find((scenario) => scenario.id === requestedId)
  if (!entry)
    throw new Error(
      `Scenario '${requestedId}' is not listed in the release index.`,
    )

  options.onStage?.('loading_manifest')
  const manifestDownload = await download(
    'scenario manifest',
    entry.manifest,
    null,
    options,
  )
  const manifest: unknown = decodeJson(manifestDownload)
  assertManifest(manifest)
  if (entry.id !== manifest.id || entry.version !== manifest.version)
    throw new Error(
      'Release index and scenario manifest identity do not match.',
    )

  const base = `/scenarios/${manifest.id}/`
  const artifacts = Object.entries(manifest.checksums)
  options.onStage?.('downloading_artifacts')
  const downloaded = new Map(
    await Promise.all(
      artifacts.map(
        async ([name, expectedChecksum]) =>
          [
            name,
            await download(
              name,
              `${base}${name}?sha256=${expectedChecksum}`,
              expectedChecksum,
              options,
            ),
          ] as const,
      ),
    ),
  )

  options.onStage?.('verifying_checksums')
  await Promise.all(
    [...downloaded.entries()].map(async ([name, resource]) => {
      const actual = await sha256(resource.bytes)
      resource.diagnostic.actualChecksum = actual
      if (actual !== resource.diagnostic.expectedChecksum) {
        resource.diagnostic.outcome = 'failed'
        resource.diagnostic.error = `Checksum mismatch for ${name}.`
        options.onResource?.({ ...resource.diagnostic })
        throw new Error(
          `Checksum mismatch for ${name}: expected ${resource.diagnostic.expectedChecksum}, received ${actual}.`,
        )
      }
      resource.diagnostic.outcome = 'verified'
      options.onResource?.({ ...resource.diagnostic })
    }),
  )

  options.onStage?.('validating_contract')
  const artifact = <T>(name: string): T => {
    const resource = downloaded.get(name)
    if (!resource) throw new Error(`Verified artifact ${name} is unavailable.`)
    return decodeJson<T>(resource)
  }
  const metrics = artifact<MetricsArtifact>(manifest.files.metrics)
  const provenance = artifact<ProvenanceArtifact>(manifest.files.provenance)
  assertArtifactContract(manifest, metrics, provenance)

  return {
    manifest,
    metrics,
    provenance,
    coastline: artifact<GeoJsonFeatureCollection>(manifest.files.coastline),
    currents: artifact<GeoJsonFeatureCollection>(manifest.files.currents),
    stations: artifact<GeoJsonFeatureCollection>(manifest.files.stations),
    routes: artifact<GeoJsonFeatureCollection>(manifest.files.routes),
    bathymetryUrl: `${base}${manifest.files.bathymetry}?sha256=${manifest.checksums[manifest.files.bathymetry]}`,
    navigationGrid: manifest.files.grid
      ? artifact<NavigationGridArtifact>(manifest.files.grid)
      : null,
  }
}
