import type { FeatureCollection, Geometry } from 'geojson'

export type DataMode = 'offline-proxy' | 'pinned-noaa'
export type Algorithm = 'distance' | 'environmental'

export interface ScenarioIndex {
  schemaVersion: '1.0.0'
  scenarios: Array<{
    id: string
    title: string
    version: string
    manifest: string
    dataMode: DataMode
  }>
}

export interface ScenarioManifest {
  schemaVersion: '1.0.0'
  id: string
  title: string
  version: string
  generatedAt: string
  dataMode: DataMode
  immutable: true
  bbox: [number, number, number, number]
  crs: { analysis: string; interchange: string }
  forecastCycles: string[]
  departureTimes: string[]
  referenceVehicleId: string
  disclaimer: string
  citations: string[]
  files: Record<string, string>
  checksums: Record<string, string>
}

export interface RouteMetric {
  id: string
  pair_id: string
  algorithm: Algorithm
  forecast_cycle: string
  departure_time: string
  path_length_m: number
  travel_time_s: number
  modelled_propulsion_energy_wh: number
  minimum_depth_m: number
  mean_current_mps: number
  compute_time_ms: number
  compute_emissions_kg: number | null
}

export interface MetricsArtifact {
  scenarioId: string
  dataMode: DataMode
  computeTimingIncluded: boolean
  results: RouteMetric[]
}

export interface ProvenanceArtifact {
  scenarioId: string
  status: string
  warning: string
  analysisGrid: {
    crs: string
    resolutionM: number
    nativeSourceResolutionPreservedInMetadata: boolean
  }
  sources: Array<{
    id: string
    provider: string
    product: string
    role: string
    status: string
    url: string
  }>
  transformations: string[]
}

export type GeoJsonFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>

export interface LoadedScenario {
  manifest: ScenarioManifest
  metrics: MetricsArtifact
  provenance: ProvenanceArtifact
  coastline: GeoJsonFeatureCollection
  currents: GeoJsonFeatureCollection
  stations: GeoJsonFeatureCollection
  routes: GeoJsonFeatureCollection
  bathymetryUrl: string
}

export const ROUTE_PAIRS = [
  { id: 'shelf-northbound', label: 'Broward → Boca' },
  { id: 'shelf-southbound', label: 'Boca → Broward' },
  { id: 'cross-shelf', label: 'Cross-shelf diagonal' },
] as const
