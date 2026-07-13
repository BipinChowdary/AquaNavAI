import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { useRouteAnimation } from './animation/useRouteAnimation'
import { AnimationControls } from './components/AnimationControls'
import { CoastalMap } from './components/CoastalMap'
import { ForecastTimeline } from './components/ForecastTimeline'
import { MetricComparison } from './components/MetricComparison'
import { ProvenancePanel } from './components/ProvenancePanel'
import { ResearchDisclaimer } from './components/ResearchDisclaimer'
import { RouteControls } from './components/RouteControls'
import { ScenarioSummary } from './components/ScenarioSummary'
import { StatusBanner } from './components/StatusBanner'
import { loadScenario } from './data/loadScenario'
import { calculateRoutesInWorker } from './routing/client'
import {
  PROXY_MISSIONS,
  type Algorithm,
  type InteractiveRoute,
  type LoadedScenario,
  type RouteMetric,
} from './types/scenario'

function asMetric(route: InteractiveRoute, cycle: string): RouteMetric {
  return {
    id: `interactive-${route.algorithm}`,
    pair_id: 'custom',
    algorithm: route.algorithm,
    forecast_cycle: cycle,
    departure_time: cycle,
    path_length_m: route.pathLengthM,
    travel_time_s: route.travelTimeS,
    modelled_propulsion_energy_wh: route.modelledEnergyWh,
    minimum_depth_m: route.minimumDepthM,
    mean_current_mps: route.meanCurrentMps,
    compute_time_ms: route.computeTimeMs,
    compute_emissions_kg: null,
  }
}

function App() {
  const [scenario, setScenario] = useState<LoadedScenario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pairId, setPairId] = useState('')
  const [cycleIndex, setCycleIndex] = useState(0)
  const [visibleAlgorithms, setVisibleAlgorithms] = useState<Set<Algorithm>>(
    () => new Set(['distance', 'environmental']),
  )
  const [endpoints, setEndpoints] = useState<{
    start: [number, number]
    goal: [number, number]
  } | null>(null)
  const [selectingGoal, setSelectingGoal] = useState(false)
  const [interactiveRoutes, setInteractiveRoutes] = useState<
    InteractiveRoute[]
  >([])
  const [calculating, setCalculating] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadScenario()
      .then((loaded) => {
        if (!active) return
        setScenario(loaded)
        const mission = loaded.navigationGrid?.missions[0] ?? PROXY_MISSIONS[0]
        setPairId(mission.id)
        setEndpoints({ start: [...mission.start], goal: [...mission.goal] })
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unknown scenario-loading error',
          )
      })
    return () => {
      active = false
    }
  }, [])

  const cycle = scenario?.manifest.forecastCycles[cycleIndex] ?? ''
  const selectedMetrics = useMemo(() => {
    if (!scenario) return null
    if (interactiveRoutes.length === 2) {
      const distance = interactiveRoutes.find(
          (route) => route.algorithm === 'distance',
        ),
        environmental = interactiveRoutes.find(
          (route) => route.algorithm === 'environmental',
        )
      if (distance && environmental)
        return {
          distance: asMetric(distance, cycle),
          environmental: asMetric(environmental, cycle),
        }
    }
    const candidates = scenario.metrics.results.filter(
      (result) => result.pair_id === pairId && result.forecast_cycle === cycle,
    )
    const distance = candidates.find(
        (result) => result.algorithm === 'distance',
      ),
      environmental = candidates.find(
        (result) => result.algorithm === 'environmental',
      )
    return distance && environmental ? { distance, environmental } : null
  }, [scenario, pairId, cycle, interactiveRoutes])

  const animatedCoordinates = useMemo<[number, number][]>(() => {
    const interactive = interactiveRoutes.find(
      (route) => route.algorithm === 'environmental',
    )
    if (interactive) return interactive.coordinates
    if (!scenario) return []
    const feature = scenario.routes.features.find(
      (item) =>
        item.properties?.pairId === pairId &&
        item.properties?.forecastCycle === cycle &&
        item.properties?.algorithm === 'environmental',
    )
    return feature?.geometry.type === 'LineString'
      ? feature.geometry.coordinates.map(
          (item) => [item[0], item[1]] as [number, number],
        )
      : []
  }, [scenario, pairId, cycle, interactiveRoutes])
  const animation = useRouteAnimation(
    animatedCoordinates,
    selectedMetrics?.environmental.travel_time_s ?? 0,
  )

  const choosePair = (id: string) => {
    if (!scenario) return
    const mission = (scenario.navigationGrid?.missions ?? PROXY_MISSIONS).find(
      (item) => item.id === id,
    )
    if (!mission) return
    setPairId(id)
    setEndpoints({ start: [...mission.start], goal: [...mission.goal] })
    setInteractiveRoutes([])
    setRouteError(null)
    setSelectingGoal(false)
    animation.reset()
  }
  const choosePoint = (coordinate: [number, number]) => {
    if (!endpoints) return
    if (!selectingGoal) {
      setEndpoints({ ...endpoints, start: coordinate })
      setSelectingGoal(true)
    } else {
      setEndpoints({ ...endpoints, goal: coordinate })
      setSelectingGoal(false)
    }
    setPairId('custom')
    setInteractiveRoutes([])
    setRouteError(null)
    animation.reset()
  }
  const calculate = async () => {
    if (!scenario?.navigationGrid || !endpoints) {
      setRouteError(
        'Browser routing is available in the verified NOAA scenario.',
      )
      return
    }
    setCalculating(true)
    setRouteError(null)
    animation.reset()
    try {
      setInteractiveRoutes(
        await calculateRoutesInWorker(
          scenario.navigationGrid,
          endpoints.start,
          endpoints.goal,
          cycleIndex,
        ),
      )
    } catch (reason) {
      setRouteError(
        reason instanceof Error ? reason.message : 'Route calculation failed.',
      )
    } finally {
      setCalculating(false)
    }
  }
  const toggleAlgorithm = (algorithm: Algorithm) =>
    setVisibleAlgorithms((current) => {
      const next = new Set(current)
      if (next.has(algorithm)) next.delete(algorithm)
      else next.add(algorithm)
      return next
    })

  if (error)
    return (
      <main className="load-state load-state--error">
        <span>Scenario unavailable</span>
        <h1>AquaNavAI could not load the pinned artifact.</h1>
        <p>{error}</p>
      </main>
    )
  if (!scenario || !selectedMetrics || !endpoints)
    return (
      <main className="load-state">
        <div className="loading-ring" aria-hidden="true" />
        <span>Validating offline NOAA scenario contract...</span>
      </main>
    )

  return (
    <div className="app-frame">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AquaNavAI home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>AquaNav</strong>
            <em>AI</em>
          </span>
        </a>
        <div className="project-title">
          <span>Research demonstrator</span>
          <strong>Forecast-aware coastal routing</strong>
        </div>
        <StatusBanner
          dataMode={scenario.manifest.dataMode}
          pairedCases={scenario.metrics.results.length / 2}
        />
      </header>
      <ResearchDisclaimer text={scenario.manifest.disclaimer} />
      <div className={`data-status data-status--${scenario.manifest.dataMode}`}>
        {scenario.manifest.dataMode === 'pinned-noaa'
          ? 'Verified NOAA-derived environmental snapshot. Research demonstrator; not for operational navigation.'
          : 'This deterministic proxy fixture exercises the software path and is not a NOAA-derived scientific result.'}
        <a href="#provenance">Data provenance</a>
      </div>
      <main id="top" className="workspace">
        <aside className="workspace-sidebar">
          <ScenarioSummary scenario={scenario} />
          <RouteControls
            pairId={pairId}
            onPairChange={choosePair}
            visibleAlgorithms={visibleAlgorithms}
            onAlgorithmToggle={toggleAlgorithm}
            missions={scenario.navigationGrid?.missions ?? PROXY_MISSIONS}
            onCalculate={calculate}
            calculating={calculating}
            routeError={routeError}
          />
        </aside>
        <section
          className="map-workspace"
          aria-label="Route-planning workspace"
        >
          <CoastalMap
            scenario={scenario}
            pairId={pairId}
            forecastCycle={cycle}
            visibleAlgorithms={visibleAlgorithms}
            interactiveRoutes={interactiveRoutes}
            endpoints={endpoints}
            vessel={
              animatedCoordinates.length
                ? {
                    coordinate: animation.coordinate,
                    bearing: animation.bearing,
                  }
                : null
            }
            onMapClick={choosePoint}
          />
          <AnimationControls
            playing={animation.playing}
            elapsedS={animation.elapsedS}
            durationS={selectedMetrics.environmental.travel_time_s}
            remainingM={(1 - animation.progress) * animation.totalDistanceM}
            speed={animation.speed}
            onPlayPause={() => animation.setPlaying(!animation.playing)}
            onReset={animation.reset}
            onSpeed={animation.setSpeed}
          />
          <ForecastTimeline
            cycles={scenario.manifest.forecastCycles}
            selectedIndex={cycleIndex}
            onChange={(index) => {
              setCycleIndex(index)
              setInteractiveRoutes([])
              animation.reset()
            }}
          />
        </section>
      </main>
      <MetricComparison
        {...selectedMetrics}
        dataMode={scenario.manifest.dataMode}
      />
      <ProvenancePanel provenance={scenario.provenance} />
      <footer>
        <span>AquaNavAI | MS AI research demonstrator</span>
        <span>Immutable scenario {scenario.manifest.version}</span>
        <span>Generated {scenario.manifest.generatedAt.slice(0, 10)}</span>
      </footer>
    </div>
  )
}
export default App
