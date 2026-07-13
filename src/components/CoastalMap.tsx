import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { type FilterSpecification, type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Algorithm, InteractiveRoute, LoadedScenario } from '../types/scenario'
import { decodeGrid } from '../routing/grid'

interface Props {
  scenario: LoadedScenario
  pairId: string
  forecastCycle: string
  visibleAlgorithms: Set<Algorithm>
  interactiveRoutes: InteractiveRoute[]
  endpoints: { start: [number, number]; goal: [number, number] }
  vessel: { coordinate: [number, number]; bearing: number } | null
  onMapClick: (coordinate: [number, number]) => void
}

const filter = (pair: string, cycle: string, algorithm: Algorithm, visible: boolean): FilterSpecification => ['all', ['==', ['get', 'pairId'], pair], ['==', ['get', 'forecastCycle'], cycle], ['==', ['get', 'algorithm'], visible ? algorithm : '__hidden__']]

function localStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': '#061b2a' } }] }
}

function routeCollection(scenario: LoadedScenario, routes: InteractiveRoute[], pairId: string, cycle: string) {
  const features = [...scenario.routes.features]
  for (const route of routes) features.push({ type: 'Feature', properties: { pairId, forecastCycle: cycle, algorithm: route.algorithm, interactive: true }, geometry: { type: 'LineString', coordinates: route.coordinates } })
  return { type: 'FeatureCollection' as const, features }
}

export function CoastalMap({ scenario, pairId, forecastCycle, visibleAlgorithms, interactiveRoutes, endpoints, vessel, onMapClick }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const clickHandler = useRef(onMapClick)
  useEffect(() => { clickHandler.current = onMapClick }, [onMapClick])
  const decodedGrid = useMemo(() => scenario.navigationGrid ? decodeGrid(scenario.navigationGrid) : null, [scenario.navigationGrid])

  useEffect(() => {
    if (!container.current) return
    const [west, south, east, north] = scenario.manifest.bbox
    const externalStyle = import.meta.env.VITE_MAP_STYLE_URL as string | undefined
    const instance = new maplibregl.Map({ container: container.current, style: externalStyle || localStyle(), center: [(west + east) / 2, (south + north) / 2], zoom: 8.7, minZoom: 7.5, maxZoom: 14, maxBounds: [[west - 0.18, south - 0.12], [east + 0.18, north + 0.12]], attributionControl: false })
    const addResearchLayers = () => {
      if (instance.getSource('bathymetry')) return
      instance.addSource('bathymetry', { type: 'image', url: scenario.bathymetryUrl, coordinates: [[west, north], [east, north], [east, south], [west, south]] })
      instance.addSource('coastline', { type: 'geojson', data: scenario.coastline })
      instance.addSource('currents', { type: 'geojson', data: scenario.currents })
      instance.addSource('stations', { type: 'geojson', data: scenario.stations })
      instance.addSource('routes', { type: 'geojson', data: scenario.routes })
      instance.addSource('mission-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      instance.addSource('vessel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      instance.addLayer({ id: 'bathymetry', type: 'raster', source: 'bathymetry', paint: { 'raster-opacity': 0.86, 'raster-contrast': 0.12 } })
      instance.addLayer({ id: 'land', type: 'fill', source: 'coastline', paint: { 'fill-color': '#e8e2d2', 'fill-opacity': 0.98 } })
      instance.addLayer({ id: 'coast-edge', type: 'line', source: 'coastline', paint: { 'line-color': '#84877d', 'line-width': 1.1 } })
      instance.addLayer({ id: 'current-points', type: 'circle', source: 'currents', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'speed_mps'], 0, 1.8, 1.4, 5], 'circle-color': '#67e8f9', 'circle-opacity': 0.62, 'circle-stroke-color': '#d5fbff', 'circle-stroke-width': 0.4 } })
      instance.addLayer({ id: 'stations', type: 'circle', source: 'stations', paint: { 'circle-radius': 5, 'circle-color': '#fbbf24', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
      for (const algorithm of ['distance', 'environmental'] as const) {
        instance.addLayer({ id: `${algorithm}-route-casing`, type: 'line', source: 'routes', filter: ['==', ['get', 'algorithm'], '__initial__'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#03121c', 'line-width': algorithm === 'distance' ? 7 : 8, 'line-opacity': 0.8 } })
        instance.addLayer({ id: `${algorithm}-route`, type: 'line', source: 'routes', filter: ['==', ['get', 'algorithm'], '__initial__'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': algorithm === 'distance' ? '#f8fafc' : '#2dd4bf', 'line-width': algorithm === 'distance' ? 2.6 : 4, ...(algorithm === 'distance' ? { 'line-dasharray': [2, 1.4] } : {}) } })
      }
      instance.addLayer({ id: 'mission-points', type: 'circle', source: 'mission-points', paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'kind'], 'start', '#22c55e', '#fb7185'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
      instance.addLayer({ id: 'vessel', type: 'symbol', source: 'vessel', layout: { 'text-field': 'â–²', 'text-size': 24, 'text-rotate': ['get', 'bearing'], 'text-allow-overlap': true }, paint: { 'text-color': '#fbbf24', 'text-halo-color': '#03121c', 'text-halo-width': 2 } })
    }
    instance.on('load', () => {
      addResearchLayers()
      instance.setLayoutProperty('vessel', 'text-field', String.fromCodePoint(0x25b2))
      const attribution = instance.getContainer().querySelector('.maplibregl-ctrl-attrib-inner')
      if (attribution) attribution.textContent = scenario.manifest.dataMode === 'pinned-noaa' ? 'NOAA CUDEM | NOAA RTOFS | NOAA NDBC' : 'AquaNavAI deterministic proxy'
    })
    instance.on('click', (event) => clickHandler.current([event.lngLat.lng, event.lngLat.lat]))
    instance.addControl(new maplibregl.NavigationControl(), 'top-right')
    instance.addControl(new maplibregl.ScaleControl({ unit: 'nautical' }), 'bottom-left')
    instance.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: scenario.manifest.dataMode === 'pinned-noaa' ? 'NOAA CUDEM Â· NOAA RTOFS Â· NOAA NDBC' : 'AquaNavAI deterministic proxy' }), 'bottom-right')
    map.current = instance
    return () => { instance.remove(); map.current = null }
  }, [scenario])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const update = () => {
      const source = instance.getSource('routes') as GeoJSONSource | undefined
      source?.setData(routeCollection(scenario, interactiveRoutes, pairId, forecastCycle))
      if (decodedGrid && scenario.navigationGrid) {
        const time = Math.max(0, scenario.navigationGrid.forecastTimes.indexOf(forecastCycle))
        const features = []
        for (let row = 0; row < decodedGrid.height; row += 10) for (let column = 0; column < decodedGrid.width; column += 4) {
          const node = row * decodedGrid.width + column
          if (!decodedGrid.feasible[node]) continue
          const offset = time * decodedGrid.feasible.length + node
          const east = decodedGrid.currentEast[offset] * decodedGrid.currentScaleMps, north = decodedGrid.currentNorth[offset] * decodedGrid.currentScaleMps
          features.push({ type: 'Feature' as const, properties: { east_mps: east, north_mps: north, speed_mps: Math.hypot(east, north) }, geometry: { type: 'Point' as const, coordinates: [decodedGrid.longitude[node], decodedGrid.latitude[node]] } })
        }
        ;(instance.getSource('currents') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
      }
      for (const algorithm of ['distance', 'environmental'] as const) {
        const value = filter(pairId, forecastCycle, algorithm, visibleAlgorithms.has(algorithm))
        instance.setFilter(`${algorithm}-route`, value); instance.setFilter(`${algorithm}-route-casing`, value)
      }
      ;(instance.getSource('mission-points') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: endpoints.start } },
        { type: 'Feature', properties: { kind: 'goal' }, geometry: { type: 'Point', coordinates: endpoints.goal } },
      ] })
      ;(instance.getSource('vessel') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: vessel ? [{ type: 'Feature', properties: { bearing: vessel.bearing }, geometry: { type: 'Point', coordinates: vessel.coordinate } }] : [] })
      const coordinates = interactiveRoutes.length ? interactiveRoutes.flatMap((route) => route.coordinates) : scenario.routes.features.filter((feature) => feature.properties?.pairId === pairId && feature.properties?.forecastCycle === forecastCycle).flatMap((feature) => feature.geometry.type === 'LineString' ? feature.geometry.coordinates as [number, number][] : [])
      if (coordinates.length) {
        const bounds = coordinates.reduce((value, coordinate) => value.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))
        instance.fitBounds(bounds, { padding: 70, maxZoom: 11.5, duration: 500 })
      }
    }
    if (instance.isStyleLoaded()) update(); else instance.once('load', update)
  }, [scenario, pairId, forecastCycle, visibleAlgorithms, interactiveRoutes, endpoints, vessel, decodedGrid])

  return <div className="map-shell"><div className="map-label"><span>South Florida Atlantic shelf</span><span>{forecastCycle.slice(0, 16).replace('T', ' ')} UTC</span></div><div ref={container} className="coastal-map" role="application" aria-label="Interactive South Florida coastal route map. Click to choose mission endpoints." /></div>
}
