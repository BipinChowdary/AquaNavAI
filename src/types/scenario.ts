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

export interface NavigationGridArtifact {
  version: 1
  width: number
  height: number
  resolutionM: number
  forecastTimes: string[]
  vehicle: {
    cruiseSpeedMps: number
    hotelPowerW: number
    propulsionCoefficient: number
  }
  encoding: { byteOrder: 'little'; depthScaleM: number; currentScaleMps: number }
  feasible: string
  depth: string
  longitude: string
  latitude: string
  currentEast: string
  currentNorth: string
  missions: Array<{
    id: string
    label: string
    start: [number, number]
    goal: [number, number]
  }>
}

export interface InteractiveRoute {
  algorithm: Algorithm
  coordinates: [number, number][]
  pathLengthM: number
  travelTimeS: number
  modelledEnergyWh: number
  minimumDepthM: number
  meanCurrentMps: number
  computeTimeMs: number
  start: [number, number]
  goal: [number, number]
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
    url?: string
    authoritativeEndpoint?: string
    retrievalTimestamp?: string | null
    dataTimestamp?: string | null
    sourceFileChecksum?: string
    limitations?: string
    files?: Array<{ url: string; sha256: string }>
  }>
  transformations: string[]
  energyModel?: Record<string, unknown>
  limitations?: string[]
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
  navigationGrid?: NavigationGridArtifact | null
}

export const PROXY_ROUTE_PAIRS = [
  { id: 'shelf-northbound', label: 'Broward → Boca' },
  { id: 'shelf-southbound', label: 'Boca → Broward' },
  { id: 'cross-shelf', label: 'Cross-shelf diagonal' },
] as const

export const PROXY_MISSIONS: NavigationGridArtifact['missions'] = [
  { id: 'shelf-northbound', label: 'Broward to Boca', start: [-80.055, 26.055], goal: [-80.05, 26.455] },
  { id: 'shelf-southbound', label: 'Boca to Broward', start: [-80.05, 26.455], goal: [-80.055, 26.055] },
  { id: 'cross-shelf', label: 'Cross-shelf diagonal', start: [-80.07, 26.18], goal: [-79.955, 26.36] },
]
