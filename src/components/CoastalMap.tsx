import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import maplibregl, {
  type FilterSpecification,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { AnimationFrame } from '../animation/useRouteAnimation'
import { decodeGrid } from '../routing/grid'
import type {
  Algorithm,
  InteractiveRoute,
  LoadedScenario,
} from '../types/scenario'

interface Props {
  scenario: LoadedScenario
  pairId: string
  forecastCycle: string
  visibleAlgorithms: Set<Algorithm>
  selectedAlgorithm: Algorithm
  interactiveRoutes: InteractiveRoute[]
  endpoints: { start: [number, number]; goal: [number, number] }
  onMapClick: (coordinate: [number, number]) => void
  onReady?: () => void
}

export interface CoastalMapHandle {
  updateVessel: (frame: AnimationFrame, route: [number, number][]) => void
  fitRoute: (route: [number, number][]) => void
}

const algorithms: Algorithm[] = ['shortest', 'fastest', 'energy', 'balanced']
const routeColors: Record<Algorithm, string> = {
  shortest: '#f8fafc',
  fastest: '#22d3ee',
  energy: '#4ade80',
  balanced: '#fbbf24',
}

const filter = (
  pair: string,
  cycle: string,
  algorithm: Algorithm,
  visible: boolean,
): FilterSpecification => [
  'all',
  ['==', ['get', 'pairId'], pair],
  ['==', ['get', 'forecastCycle'], cycle],
  ['==', ['get', 'algorithm'], visible ? algorithm : '__hidden__'],
]

function localStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'ocean',
        type: 'background',
        paint: { 'background-color': '#061b2a' },
      },
    ],
  }
}

function routeCollection(
  scenario: LoadedScenario,
  routes: InteractiveRoute[],
  pairId: string,
  cycle: string,
) {
  const features = routes.length ? [] : [...scenario.routes.features]
  for (const route of routes)
    features.push({
      type: 'Feature',
      properties: {
        pairId,
        forecastCycle: cycle,
        algorithm: route.algorithm,
        interactive: true,
      },
      geometry: { type: 'LineString', coordinates: route.coordinates },
    })
  return { type: 'FeatureCollection' as const, features }
}

export const CoastalMap = forwardRef<CoastalMapHandle, Props>(
  function CoastalMap(
    {
      scenario,
      pairId,
      forecastCycle,
      visibleAlgorithms,
      selectedAlgorithm,
      interactiveRoutes,
      endpoints,
      onMapClick,
      onReady,
    },
    ref,
  ) {
    const container = useRef<HTMLDivElement>(null)
    const map = useRef<MapLibreMap | null>(null)
    const marker = useRef<Marker | null>(null)
    const markerElement = useRef<HTMLDivElement | null>(null)
    const clickHandler = useRef(onMapClick)
    const readyHandler = useRef(onReady)
    useEffect(() => {
      clickHandler.current = onMapClick
      readyHandler.current = onReady
    }, [onMapClick, onReady])
    const decodedGrid = useMemo(
      () =>
        scenario.navigationGrid ? decodeGrid(scenario.navigationGrid) : null,
      [scenario.navigationGrid],
    )

    useImperativeHandle(ref, () => ({
      fitRoute(route) {
        const instance = map.current
        if (!instance || route.length < 2) return
        instance.resize()
        const bounds = route.reduce(
          (value, coordinate) => value.extend(coordinate),
          new maplibregl.LngLatBounds(route[0], route[0]),
        )
        instance.fitBounds(bounds, { padding: 90, maxZoom: 11.5, duration: 0 })
        instance.setCenter(bounds.getCenter())
        if (container.current) {
          container.current.dataset.mapZoom = instance.getZoom().toFixed(3)
          container.current.dataset.mapCenter = instance
            .getCenter()
            .toArray()
            .join(',')
        }
      },
      updateVessel(frame, route) {
        const instance = map.current
        if (!instance || !marker.current || !markerElement.current) return
        marker.current.setLngLat(frame.coordinate)
        const icon =
          markerElement.current.querySelector<HTMLElement>('.asv-icon')
        if (icon) icon.style.transform = `rotate(${frame.bearing}deg)`
        markerElement.current.dataset.lng = frame.coordinate[0].toFixed(7)
        markerElement.current.dataset.lat = frame.coordinate[1].toFixed(7)
        markerElement.current.dataset.bearing = frame.bearing.toFixed(2)
        markerElement.current.dataset.progress = frame.progress.toFixed(4)
        markerElement.current.dataset.segment = String(frame.segment)
        markerElement.current.style.visibility = 'visible'
        const traversed = route.slice(0, Math.max(1, frame.segment + 1))
        traversed.push(frame.coordinate)
        ;(
          instance.getSource('route-progress') as GeoJSONSource | undefined
        )?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: traversed },
        })
      },
    }))

    useEffect(() => {
      if (!container.current) return
      const [west, south, east, north] = scenario.manifest.bbox
      const instance = new maplibregl.Map({
        container: container.current,
        style: localStyle(),
        center: [(west + east) / 2, (south + north) / 2],
        zoom: 8.7,
        minZoom: 7.5,
        maxZoom: 14,
        maxBounds: [
          [west - 0.75, south - 0.3],
          [east + 0.75, north + 0.3],
        ],
        attributionControl: false,
      })
      const resizeObserver = new ResizeObserver(() => instance.resize())
      resizeObserver.observe(container.current)
      instance.on('load', () => {
        instance.addSource('bathymetry', {
          type: 'image',
          url: scenario.bathymetryUrl,
          coordinates: [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
          ],
        })
        instance.addSource('coastline', {
          type: 'geojson',
          data: scenario.coastline,
        })
        instance.addSource('currents', {
          type: 'geojson',
          data: scenario.currents,
        })
        instance.addSource('stations', {
          type: 'geojson',
          data: scenario.stations,
        })
        instance.addSource('routes', { type: 'geojson', data: scenario.routes })
        instance.addSource('mission-points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        instance.addSource('route-progress', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] },
          },
        })
        instance.addLayer({
          id: 'bathymetry',
          type: 'raster',
          source: 'bathymetry',
          paint: { 'raster-opacity': 0.86, 'raster-contrast': 0.12 },
        })
        instance.addLayer({
          id: 'land',
          type: 'fill',
          source: 'coastline',
          paint: { 'fill-color': '#e8e2d2', 'fill-opacity': 0.98 },
        })
        instance.addLayer({
          id: 'coast-edge',
          type: 'line',
          source: 'coastline',
          paint: { 'line-color': '#84877d', 'line-width': 1.1 },
        })
        instance.addLayer({
          id: 'current-points',
          type: 'circle',
          source: 'currents',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'speed_mps'],
              0,
              1.8,
              1.4,
              5,
            ],
            'circle-color': '#67e8f9',
            'circle-opacity': 0.62,
            'circle-stroke-color': '#d5fbff',
            'circle-stroke-width': 0.4,
          },
        })
        instance.addLayer({
          id: 'stations',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-radius': 5,
            'circle-color': '#fbbf24',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
          },
        })
        for (const algorithm of algorithms) {
          instance.addLayer({
            id: `${algorithm}-route-casing`,
            type: 'line',
            source: 'routes',
            filter: ['==', ['get', 'algorithm'], '__initial__'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#03121c',
              'line-width': 8,
              'line-opacity': 0.85,
            },
          })
          instance.addLayer({
            id: `${algorithm}-route`,
            type: 'line',
            source: 'routes',
            filter: ['==', ['get', 'algorithm'], '__initial__'],
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': routeColors[algorithm],
              'line-width': 4,
              ...(algorithm === 'shortest'
                ? { 'line-dasharray': [2, 1.4] }
                : {}),
            },
          })
        }
        instance.addLayer({
          id: 'route-progress',
          type: 'line',
          source: 'route-progress',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 6,
            'line-opacity': 0.75,
          },
        })
        instance.addLayer({
          id: 'mission-points',
          type: 'circle',
          source: 'mission-points',
          paint: {
            'circle-radius': 7,
            'circle-color': [
              'match',
              ['get', 'kind'],
              'start',
              '#22c55e',
              '#fb7185',
            ],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        })
        const element = document.createElement('div')
        element.className = 'asv-marker'
        element.setAttribute('role', 'img')
        element.setAttribute('aria-label', 'Animated autonomous surface vessel')
        element.innerHTML =
          '<span class="asv-pulse"></span><span class="asv-icon">▲</span>'
        element.style.visibility = 'hidden'
        markerElement.current = element
        marker.current = new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat(
            scenario.navigationGrid?.missions[0]?.start ?? [
              (west + east) / 2,
              (south + north) / 2,
            ],
          )
          .addTo(instance)
        readyHandler.current?.()
      })
      instance.on('click', (event) =>
        clickHandler.current([event.lngLat.lng, event.lngLat.lat]),
      )
      instance.addControl(new maplibregl.NavigationControl(), 'top-right')
      instance.addControl(
        new maplibregl.ScaleControl({ unit: 'nautical' }),
        'bottom-left',
      )
      instance.addControl(
        new maplibregl.AttributionControl({
          compact: false,
          customAttribution:
            scenario.manifest.dataMode === 'pinned-noaa'
              ? 'NOAA CUDEM · NOAA RTOFS · NOAA NDBC'
              : 'AquaNavAI deterministic proxy',
        }),
        'bottom-right',
      )
      map.current = instance
      return () => {
        resizeObserver.disconnect()
        marker.current?.remove()
        marker.current = null
        markerElement.current = null
        instance.remove()
        map.current = null
      }
    }, [scenario])

    useEffect(() => {
      const instance = map.current
      if (!instance?.isStyleLoaded()) return
      instance.resize()
      ;(instance.getSource('routes') as GeoJSONSource | undefined)?.setData(
        routeCollection(scenario, interactiveRoutes, pairId, forecastCycle),
      )
      if (decodedGrid && scenario.navigationGrid) {
        const time = Math.max(
          0,
          scenario.navigationGrid.forecastTimes.indexOf(forecastCycle),
        )
        const features = []
        for (let row = 0; row < decodedGrid.height; row += 10)
          for (let column = 0; column < decodedGrid.width; column += 4) {
            const node = row * decodedGrid.width + column
            if (!decodedGrid.feasible[node]) continue
            const offset = time * decodedGrid.feasible.length + node
            const east =
              decodedGrid.currentEast[offset] * decodedGrid.currentScaleMps
            const north =
              decodedGrid.currentNorth[offset] * decodedGrid.currentScaleMps
            features.push({
              type: 'Feature' as const,
              properties: { speed_mps: Math.hypot(east, north) },
              geometry: {
                type: 'Point' as const,
                coordinates: [
                  decodedGrid.longitude[node],
                  decodedGrid.latitude[node],
                ],
              },
            })
          }
        ;(instance.getSource('currents') as GeoJSONSource | undefined)?.setData(
          {
            type: 'FeatureCollection',
            features,
          },
        )
      }
      for (const algorithm of algorithms) {
        const value = filter(
          pairId,
          forecastCycle,
          algorithm,
          visibleAlgorithms.has(algorithm),
        )
        instance.setFilter(`${algorithm}-route`, value)
        instance.setFilter(`${algorithm}-route-casing`, value)
        instance.setPaintProperty(
          `${algorithm}-route`,
          'line-width',
          algorithm === selectedAlgorithm ? 6 : 3.25,
        )
        instance.setPaintProperty(
          `${algorithm}-route`,
          'line-opacity',
          algorithm === selectedAlgorithm ? 1 : 0.72,
        )
      }
      ;(
        instance.getSource('mission-points') as GeoJSONSource | undefined
      )?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { kind: 'start' },
            geometry: { type: 'Point', coordinates: endpoints.start },
          },
          {
            type: 'Feature',
            properties: { kind: 'goal' },
            geometry: { type: 'Point', coordinates: endpoints.goal },
          },
        ],
      })
      const coordinates =
        interactiveRoutes.find((route) => route.algorithm === selectedAlgorithm)
          ?.coordinates ??
        interactiveRoutes.flatMap((route) => route.coordinates)
      if (coordinates.length) {
        const bounds = coordinates.reduce(
          (value, coordinate) => value.extend(coordinate),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
        )
        requestAnimationFrame(() => {
          instance.resize()
          instance.fitBounds(bounds, {
            padding: 90,
            maxZoom: 11.5,
            duration: 0,
          })
          instance.setCenter(bounds.getCenter())
        })
      }
    }, [
      scenario,
      pairId,
      forecastCycle,
      visibleAlgorithms,
      selectedAlgorithm,
      interactiveRoutes,
      endpoints,
      decodedGrid,
    ])

    return (
      <div className="map-shell">
        <div className="map-label">
          <span>South Florida Atlantic shelf</span>
          <span>{forecastCycle.slice(0, 16).replace('T', ' ')} UTC</span>
        </div>
        <div
          ref={container}
          className="coastal-map"
          role="application"
          aria-label="Interactive South Florida coastal route map. Click to choose mission endpoints."
        />
      </div>
    )
  },
)
