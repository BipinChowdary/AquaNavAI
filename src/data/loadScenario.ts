import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type {
  GeoJsonFeatureCollection,
  LoadedScenario,
  MetricsArtifact,
  ProvenanceArtifact,
  ScenarioIndex,
  ScenarioManifest,
} from '../types/scenario'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to load ${url}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export async function loadScenario(id = 'south-florida-v1'): Promise<LoadedScenario> {
  const [index, schema] = await Promise.all([
    fetchJson<ScenarioIndex>('/scenarios/index.json'),
    fetchJson<Record<string, unknown>>('/schemas/scenario.schema.json'),
  ])
  const entry = index.scenarios.find((scenario) => scenario.id === id)
  if (!entry) throw new Error(`Scenario '${id}' is not listed in the release index.`)
  const manifest = await fetchJson<ScenarioManifest>(entry.manifest)
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  if (!validate(manifest)) {
    throw new Error(`Scenario manifest is invalid: ${ajv.errorsText(validate.errors)}`)
  }
  const base = `/scenarios/${manifest.id}/`
  const [metrics, provenance, coastline, currents, stations, routes] = await Promise.all([
    fetchJson<MetricsArtifact>(base + manifest.files.metrics),
    fetchJson<ProvenanceArtifact>(base + manifest.files.provenance),
    fetchJson<GeoJsonFeatureCollection>(base + manifest.files.coastline),
    fetchJson<GeoJsonFeatureCollection>(base + manifest.files.currents),
    fetchJson<GeoJsonFeatureCollection>(base + manifest.files.stations),
    fetchJson<GeoJsonFeatureCollection>(base + manifest.files.routes),
  ])
  return {
    manifest,
    metrics,
    provenance,
    coastline,
    currents,
    stations,
    routes,
    bathymetryUrl: base + manifest.files.bathymetry,
  }
}
