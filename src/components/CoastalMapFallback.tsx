import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import type { AnimationFrame } from '../animation/useRouteAnimation'
import type {
  Algorithm,
  InteractiveRoute,
  LoadedScenario,
} from '../types/scenario'

export interface CoastalMapHandle {
  updateVessel: (frame: AnimationFrame, route: [number, number][]) => void
  fitRoute: (route: [number, number][]) => void
}

export interface CoastalMapFallbackProps {
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

const WIDTH = 1_000
const HEIGHT = 680
const colors: Record<Algorithm, string> = {
  shortest: '#f8fafc',
  fastest: '#22d3ee',
  energy: '#4ade80',
  balanced: '#fbbf24',
}

function project(
  coordinate: [number, number],
  bbox: [number, number, number, number],
) {
  const [west, south, east, north] = bbox
  return [
    ((coordinate[0] - west) / (east - west)) * WIDTH,
    ((north - coordinate[1]) / (north - south)) * HEIGHT,
  ] as const
}

function linePoints(
  coordinates: [number, number][],
  bbox: [number, number, number, number],
) {
  return coordinates
    .map((coordinate) => project(coordinate, bbox).join(','))
    .join(' ')
}

function coastlinePaths(scenario: LoadedScenario) {
  const paths: string[] = []
  const addRing = (ring: number[][]) => {
    if (!ring.length) return
    const commands = ring.map((coordinate, index) => {
      const [x, y] = project(
        [coordinate[0], coordinate[1]],
        scenario.manifest.bbox,
      )
      return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    paths.push(`${commands.join(' ')} Z`)
  }
  for (const feature of scenario.coastline.features) {
    if (feature.geometry.type === 'Polygon')
      for (const ring of feature.geometry.coordinates) addRing(ring)
    if (feature.geometry.type === 'MultiPolygon')
      for (const polygon of feature.geometry.coordinates)
        for (const ring of polygon) addRing(ring)
  }
  return paths
}

function releasedRoutes(
  scenario: LoadedScenario,
  pairId: string,
  cycle: string,
) {
  return scenario.routes.features.flatMap((feature) => {
    if (feature.geometry.type !== 'LineString') return []
    const properties = feature.properties ?? {}
    const algorithm = properties.algorithm as Algorithm
    if (
      !['shortest', 'fastest', 'energy', 'balanced'].includes(algorithm) ||
      properties.pairId !== pairId ||
      properties.forecastCycle !== cycle
    )
      return []
    return [
      {
        algorithm,
        coordinates: feature.geometry.coordinates.map(
          (coordinate) => [coordinate[0], coordinate[1]] as [number, number],
        ),
      },
    ]
  })
}

export const CoastalMapFallback = forwardRef<
  CoastalMapHandle,
  CoastalMapFallbackProps
>(function CoastalMapFallback(
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
  const svg = useRef<SVGSVGElement>(null)
  const marker = useRef<SVGGElement>(null)
  const progress = useRef<SVGPolylineElement>(null)
  const bbox = scenario.manifest.bbox
  const routes = useMemo(
    () =>
      interactiveRoutes.length
        ? interactiveRoutes
        : releasedRoutes(scenario, pairId, forecastCycle),
    [forecastCycle, interactiveRoutes, pairId, scenario],
  )
  const land = useMemo(() => coastlinePaths(scenario), [scenario])
  const [startX, startY] = project(endpoints.start, bbox)
  const [goalX, goalY] = project(endpoints.goal, bbox)

  useEffect(() => onReady?.(), [onReady])

  useImperativeHandle(ref, () => ({
    fitRoute(route) {
      if (!svg.current || route.length < 2) return
      svg.current.dataset.mapCenter =
        route[Math.floor(route.length / 2)].join(',')
      svg.current.dataset.mapZoom = 'simplified-fit'
    },
    updateVessel(frame, route) {
      if (!marker.current || !progress.current) return
      const [x, y] = project(frame.coordinate, bbox)
      marker.current.setAttribute(
        'transform',
        `translate(${x} ${y}) rotate(${frame.bearing})`,
      )
      marker.current.dataset.lng = frame.coordinate[0].toFixed(7)
      marker.current.dataset.lat = frame.coordinate[1].toFixed(7)
      marker.current.dataset.bearing = frame.bearing.toFixed(2)
      marker.current.dataset.progress = frame.progress.toFixed(4)
      marker.current.dataset.segment = String(frame.segment)
      marker.current.style.visibility = 'visible'
      const traversed = route.slice(0, Math.max(1, frame.segment + 1))
      traversed.push(frame.coordinate)
      progress.current.setAttribute('points', linePoints(traversed, bbox))
    },
  }))

  return (
    <div className="map-shell map-shell--simplified" data-map-mode="simplified">
      <div className="map-label">
        <span>South Florida Atlantic shelf</span>
        <span>{forecastCycle.slice(0, 16).replace('T', ' ')} UTC</span>
      </div>
      <div className="map-fallback-notice" role="status">
        Interactive WebGL map unavailable. Using simplified 2D map.
      </div>
      <svg
        ref={svg}
        className="coastal-map coastal-map--simplified"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="application"
        aria-label="Interactive South Florida coastal route map in simplified mode. Click to choose mission endpoints."
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const x = (event.clientX - box.left) / box.width
          const y = (event.clientY - box.top) / box.height
          const [west, south, east, north] = bbox
          onMapClick([west + x * (east - west), north - y * (north - south)])
        }}
      >
        <rect width={WIDTH} height={HEIGHT} fill="#061b2a" />
        <image
          href={scenario.bathymetryUrl}
          width={WIDTH}
          height={HEIGHT}
          preserveAspectRatio="none"
          opacity="0.86"
        />
        <g className="fallback-land">
          {land.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
        <g className="fallback-routes">
          {routes.map((route) =>
            visibleAlgorithms.has(route.algorithm) ? (
              <polyline
                key={route.algorithm}
                data-route-algorithm={route.algorithm}
                points={linePoints(route.coordinates, bbox)}
                fill="none"
                stroke={colors[route.algorithm]}
                strokeWidth={route.algorithm === selectedAlgorithm ? 7 : 4}
                strokeDasharray={
                  route.algorithm === 'shortest' ? '12 8' : undefined
                }
                opacity={route.algorithm === selectedAlgorithm ? 1 : 0.76}
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          <polyline
            ref={progress}
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            opacity="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fallback-endpoints">
          <circle cx={startX} cy={startY} r="8" className="start" />
          <circle cx={goalX} cy={goalY} r="8" className="goal" />
        </g>
        <g
          ref={marker}
          className="asv-marker asv-marker--svg"
          role="img"
          aria-label="Animated autonomous surface vessel"
          data-lng={endpoints.start[0].toFixed(7)}
          data-lat={endpoints.start[1].toFixed(7)}
          data-progress="0.0000"
          style={{ visibility: 'hidden' }}
        >
          <circle className="asv-pulse" r="18" />
          <path className="asv-icon" d="M 0 -15 L 10 13 L 0 8 L -10 13 Z" />
        </g>
      </svg>
      <div className="fallback-attribution">
        {scenario.manifest.dataMode === 'pinned-noaa'
          ? 'NOAA CUDEM · NOAA RTOFS · NOAA NDBC'
          : 'AquaNavAI deterministic proxy'}
      </div>
    </div>
  )
})
