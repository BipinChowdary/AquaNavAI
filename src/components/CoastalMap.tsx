import { useEffect, useRef } from 'react'
import maplibregl, { type FilterSpecification, type Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Algorithm, LoadedScenario } from '../types/scenario'

interface CoastalMapProps {
  scenario: LoadedScenario
  pairId: string
  forecastCycle: string
  visibleAlgorithms: Set<Algorithm>
}

const routeFilter = (
  pairId: string,
  forecastCycle: string,
  algorithm: Algorithm,
  visible: boolean,
): FilterSpecification => [
  'all',
  ['==', ['get', 'pairId'], pairId],
  ['==', ['get', 'forecastCycle'], forecastCycle],
  ['==', ['get', 'algorithm'], visible ? algorithm : '__hidden__'],
]

const initialRouteFilter: FilterSpecification = ['==', ['get', 'algorithm'], '__initial__']

export function CoastalMap({ scenario, pairId, forecastCycle, visibleAlgorithms }: CoastalMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    if (!container.current) return
    const [west, south, east, north] = scenario.manifest.bbox
    const instance = new maplibregl.Map({
      container: container.current,
      center: [(west + east) / 2, (south + north) / 2],
      zoom: 9.2,
      minZoom: 8,
      maxZoom: 13,
      maxBounds: [
        [west - 0.08, south - 0.08],
        [east + 0.08, north + 0.08],
      ],
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          bathymetry: {
            type: 'image',
            url: scenario.bathymetryUrl,
            coordinates: [
              [west, north],
              [east, north],
              [east, south],
              [west, south],
            ],
          },
          coastline: { type: 'geojson', data: scenario.coastline },
          currents: { type: 'geojson', data: scenario.currents },
          routes: { type: 'geojson', data: scenario.routes },
        },
        layers: [
          { id: 'ocean', type: 'background', paint: { 'background-color': '#061b2a' } },
          {
            id: 'bathymetry',
            type: 'raster',
            source: 'bathymetry',
            paint: { 'raster-opacity': 0.9, 'raster-contrast': 0.1, 'raster-saturation': -0.1 },
          },
          {
            id: 'land',
            type: 'fill',
            source: 'coastline',
            paint: { 'fill-color': '#e8e2d2', 'fill-opacity': 0.98 },
          },
          {
            id: 'coast-edge',
            type: 'line',
            source: 'coastline',
            paint: { 'line-color': '#9d9a8b', 'line-width': 1.2 },
          },
          {
            id: 'current-points',
            type: 'circle',
            source: 'currents',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'speed_mps'], 0, 2, 0.6, 5],
              'circle-color': '#67e8f9',
              'circle-opacity': 0.66,
              'circle-stroke-color': '#d5fbff',
              'circle-stroke-width': 0.5,
            },
          },
          {
            id: 'distance-route-casing',
            type: 'line',
            source: 'routes',
            filter: initialRouteFilter,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#071b28', 'line-width': 6, 'line-opacity': 0.7 },
          },
          {
            id: 'distance-route',
            type: 'line',
            source: 'routes',
            filter: initialRouteFilter,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#f8fafc', 'line-width': 2.5, 'line-dasharray': [2, 1.4] },
          },
          {
            id: 'environmental-route-casing',
            type: 'line',
            source: 'routes',
            filter: initialRouteFilter,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#06131d', 'line-width': 7, 'line-opacity': 0.72 },
          },
          {
            id: 'environmental-route',
            type: 'line',
            source: 'routes',
            filter: initialRouteFilter,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2dd4bf', 'line-width': 3.5 },
          },
        ],
      },
    })
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ unit: 'nautical' }), 'bottom-left')
    instance.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution: 'AquaNavAI proxy fixture · NOAA sources pending verification',
      }),
      'bottom-right',
    )
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [scenario])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const update = () => {
      for (const algorithm of ['distance', 'environmental'] as const) {
        const filter = routeFilter(pairId, forecastCycle, algorithm, visibleAlgorithms.has(algorithm))
        instance.setFilter(`${algorithm}-route`, filter)
        instance.setFilter(`${algorithm}-route-casing`, filter)
      }
    }
    if (!instance.isStyleLoaded()) {
      instance.once('load', update)
      return () => {
        instance.off('load', update)
      }
    }
    update()
  }, [pairId, forecastCycle, visibleAlgorithms])

  return (
    <div className="map-shell">
      <div className="map-label">
        <span>Atlantic shelf / South Florida</span>
        <span>WGS84</span>
      </div>
      <div
        ref={container}
        className="coastal-map"
        role="img"
        aria-label="Interactive coastal map comparing distance and environmental routes"
      />
    </div>
  )
}
