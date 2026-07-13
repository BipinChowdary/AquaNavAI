import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useRouteAnimation } from './animation/useRouteAnimation'
import { AnimationControls } from './components/AnimationControls'
import { CoastalMap, type CoastalMapHandle } from './components/CoastalMap'
import { ForecastTimeline } from './components/ForecastTimeline'
import { MetricComparison } from './components/MetricComparison'
import { ProvenancePanel } from './components/ProvenancePanel'
import { ResearchDisclaimer } from './components/ResearchDisclaimer'
import { RouteControls } from './components/RouteControls'
import { ScenarioSummary } from './components/ScenarioSummary'
import { StatusBanner } from './components/StatusBanner'
import { loadScenario } from './data/loadScenario'
import { RoutingWorkerClient, type WorkerStatus } from './routing/client'
import {
  PROXY_MISSIONS,
  type Algorithm,
  type InteractiveRoute,
  type LoadedScenario,
  type RouteMetric,
} from './types/scenario'

type InitStage =
  | 'idle'
  | 'loading_manifest'
  | 'loading_artifacts'
  | 'validating'
  | 'initializing_worker'
  | 'initializing_map'
  | 'ready'
  | 'error'

const initLabels: Record<InitStage, string> = {
  idle: 'Preparing scenario',
  loading_manifest: 'Loading scenario manifest',
  loading_artifacts: 'Loading checksummed NOAA artifacts',
  validating: 'Validating scenario contract',
  initializing_worker: 'Decoding navigation grid in worker',
  initializing_map: 'Initializing offline coastal map',
  ready: 'Navigation V2 ready',
  error: 'Initialization failed',
}
const EMPTY_COORDINATES: [number, number][] = []

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
    risk_score: route.riskScore,
    compute_time_ms: route.computeTimeMs,
    compute_emissions_kg: null,
  }
}

function App() {
  const [scenario, setScenario] = useState<LoadedScenario | null>(null)
  const [initStage, setInitStage] = useState<InitStage>('idle')
  const [initError, setInitError] = useState<string | null>(null)
  const [initRun, setInitRun] = useState(0)
  const [useFallback, setUseFallback] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [workerReady, setWorkerReady] = useState(false)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>('idle')
  const [pairId, setPairId] = useState('')
  const [cycleIndex, setCycleIndex] = useState(0)
  const [selectedAlgorithm, setSelectedAlgorithm] =
    useState<Algorithm>('balanced')
  const [visibleAlgorithms, setVisibleAlgorithms] = useState<Set<Algorithm>>(
    () => new Set(['shortest', 'fastest', 'energy', 'balanced']),
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
  const mapRef = useRef<CoastalMapHandle>(null)
  const initialRouteStarted = useRef(false)
  const initStageRef = useRef<InitStage>('idle')
  const mapReadyRef = useRef(false)
  const workerReadyRef = useRef(false)
  const [worker] = useState(
    () => new RoutingWorkerClient((status) => setWorkerStatus(status)),
  )

  useEffect(() => {
    initStageRef.current = initStage
  }, [initStage])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      if (!active) return
      if (mapReadyRef.current && workerReadyRef.current) return
      setInitError(
        `Cold initialization exceeded 8 seconds during ${initLabels[initStageRef.current]}.`,
      )
      setInitStage('error')
    }, 8_000)
    const initialize = async () => {
      try {
        setInitError(null)
        initialRouteStarted.current = false
        mapReadyRef.current = false
        workerReadyRef.current = false
        setScenario(null)
        setMapReady(false)
        setWorkerReady(false)
        setInitStage('loading_manifest')
        await Promise.resolve()
        setInitStage('loading_artifacts')
        const loaded = await loadScenario(
          useFallback ? 'south-florida-noaa-v1' : undefined,
        )
        if (!active) return
        setInitStage('validating')
        if (!loaded.navigationGrid)
          throw new Error(
            'The selected scenario has no browser navigation grid.',
          )
        const mission = loaded.navigationGrid.missions[0] ?? PROXY_MISSIONS[0]
        setScenario(loaded)
        setPairId(mission.id)
        setEndpoints({ start: [...mission.start], goal: [...mission.goal] })
        setInteractiveRoutes([])
        setCycleIndex(0)
        setInitStage('initializing_worker')
        await worker.initialize(loaded.navigationGrid)
        if (!active) return
        workerReadyRef.current = true
        setWorkerReady(true)
        setInitStage('initializing_map')
      } catch (reason) {
        if (!active) return
        setInitError(
          reason instanceof Error
            ? reason.message
            : 'Unknown initialization error',
        )
        setInitStage('error')
      }
    }
    void initialize()
    return () => {
      active = false
      clearTimeout(timeout)
      worker.dispose()
    }
  }, [initRun, useFallback, worker])

  const effectiveInitStage: InitStage =
    workerReady && mapReady ? 'ready' : initStage

  const cycle = scenario?.manifest.forecastCycles[cycleIndex] ?? ''
  const selectedRoute =
    interactiveRoutes.find((route) => route.algorithm === selectedAlgorithm) ??
    null
  const animatedCoordinates = selectedRoute?.coordinates ?? EMPTY_COORDINATES
  const animation = useRouteAnimation(
    animatedCoordinates,
    selectedRoute?.travelTimeS ?? 0,
    (frame) => mapRef.current?.updateVessel(frame, animatedCoordinates),
  )

  const calculateFor = useCallback(
    async (
      nextEndpoints: { start: [number, number]; goal: [number, number] },
      nextCycleIndex = cycleIndex,
    ) => {
      if (!workerReady) {
        setRouteError(
          'Routing is disabled until the navigation worker is ready.',
        )
        return
      }
      setCalculating(true)
      setRouteError(null)
      animation.reset()
      try {
        const routes = await worker.calculate(
          nextEndpoints.start,
          nextEndpoints.goal,
          nextCycleIndex,
        )
        if (routes.length !== 4)
          throw new Error(
            `Only ${routes.length} of four objectives returned a valid route.`,
          )
        setInteractiveRoutes(routes)
        const active = routes.find(
          (route) => route.algorithm === selectedAlgorithm,
        )
        if (active)
          requestAnimationFrame(() =>
            mapRef.current?.fitRoute(active.coordinates),
          )
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : 'Route calculation failed.'
        if (!message.includes('superseded')) setRouteError(message)
      } finally {
        setCalculating(false)
      }
    },
    [animation, cycleIndex, selectedAlgorithm, workerReady, worker],
  )

  useEffect(() => {
    if (effectiveInitStage !== 'ready' || !endpoints || !cycle) return
    if (initialRouteStarted.current) return
    initialRouteStarted.current = true
    void calculateFor(endpoints)
  }, [effectiveInitStage, endpoints, cycle, calculateFor])

  const choosePair = (id: string) => {
    if (!scenario) return
    const mission = (scenario.navigationGrid?.missions ?? PROXY_MISSIONS).find(
      (item) => item.id === id,
    )
    if (!mission) return
    const next = {
      start: [...mission.start] as [number, number],
      goal: [...mission.goal] as [number, number],
    }
    setPairId(id)
    setEndpoints(next)
    setInteractiveRoutes([])
    setRouteError(null)
    setSelectingGoal(false)
    animation.reset()
    void calculateFor(next)
  }

  const choosePoint = (coordinate: [number, number]) => {
    if (!endpoints || effectiveInitStage !== 'ready') return
    animation.reset()
    setPairId('custom')
    setInteractiveRoutes([])
    if (!selectingGoal) {
      setEndpoints({ ...endpoints, start: coordinate })
      setSelectingGoal(true)
      setRouteError(
        'Start selected. Click a second valid offshore point for the destination.',
      )
      return
    }
    const next = { ...endpoints, goal: coordinate }
    setEndpoints(next)
    setSelectingGoal(false)
    setRouteError(null)
    void calculateFor(next)
  }

  const changeCycle = (index: number) => {
    setCycleIndex(index)
    setInteractiveRoutes([])
    animation.reset()
    if (endpoints) void calculateFor(endpoints, index)
  }

  const routeMetrics = useMemo(
    () => interactiveRoutes.map((route) => asMetric(route, cycle)),
    [interactiveRoutes, cycle],
  )
  const toggleAlgorithm = (algorithm: Algorithm) =>
    setVisibleAlgorithms((current) => {
      const next = new Set(current)
      if (next.has(algorithm)) next.delete(algorithm)
      else next.add(algorithm)
      return next
    })

  const diagnostic = JSON.stringify({
    stage: effectiveInitStage,
    scenario: scenario?.manifest.id ?? null,
    version: scenario?.manifest.version ?? null,
    worker: workerStatus,
    workerDecodeMs: worker.decodeTimeMs,
    error: initError,
  })

  if (!scenario || effectiveInitStage === 'error')
    return (
      <main
        className={`load-state ${effectiveInitStage === 'error' ? 'load-state--error' : ''}`}
        data-init-stage={effectiveInitStage}
      >
        {effectiveInitStage !== 'error' && (
          <div className="loading-ring" aria-hidden="true" />
        )}
        <span>{initLabels[effectiveInitStage]}</span>
        {initError && (
          <>
            <h1>AquaNavAI could not initialize the pinned scenario.</h1>
            <p>{initError}</p>
            <div className="recovery-actions">
              <button
                type="button"
                onClick={() => setInitRun((value) => value + 1)}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseFallback(true)
                  setInitRun((value) => value + 1)
                }}
              >
                Load bundled fallback
              </button>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(diagnostic)}
              >
                Copy diagnostic
              </button>
            </div>
          </>
        )}
      </main>
    )

  return (
    <div
      className="app-frame"
      data-init-stage={effectiveInitStage}
      data-selecting-goal={String(selectingGoal)}
    >
      {effectiveInitStage !== 'ready' && (
        <div className="initialization-banner" role="status">
          <span>{initLabels[effectiveInitStage]}</span>
          <progress />
        </div>
      )}
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
          <strong>Forecast-aware coastal routing · Navigation V2</strong>
        </div>
        <StatusBanner
          dataMode={scenario.manifest.dataMode}
          cases={scenario.metrics.results.length / 4}
        />
      </header>
      <ResearchDisclaimer text={scenario.manifest.disclaimer} />
      <div className={`data-status data-status--${scenario.manifest.dataMode}`}>
        {scenario.manifest.dataMode === 'pinned-noaa'
          ? 'Verified NOAA-derived environmental snapshot. Research demonstrator; not for operational navigation.'
          : 'Deterministic proxy fixture; not a NOAA-derived scientific result.'}
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
            selectedAlgorithm={selectedAlgorithm}
            onAlgorithmSelect={(algorithm) => {
              setSelectedAlgorithm(algorithm)
              animation.reset()
            }}
            missions={scenario.navigationGrid?.missions ?? PROXY_MISSIONS}
            onCalculate={() => endpoints && void calculateFor(endpoints)}
            calculating={calculating}
            routeError={routeError}
            workerStatus={workerStatus}
          />
        </aside>
        <section
          className="map-workspace"
          aria-label="Route-planning workspace"
        >
          {endpoints && (
            <CoastalMap
              ref={mapRef}
              scenario={scenario}
              pairId={pairId}
              forecastCycle={cycle}
              visibleAlgorithms={visibleAlgorithms}
              selectedAlgorithm={selectedAlgorithm}
              interactiveRoutes={interactiveRoutes}
              endpoints={endpoints}
              onMapClick={choosePoint}
              onReady={() => {
                mapReadyRef.current = true
                setMapReady(true)
              }}
            />
          )}
          <AnimationControls
            playing={animation.playing}
            elapsedS={animation.elapsedS}
            durationS={selectedRoute?.travelTimeS ?? 0}
            remainingM={(1 - animation.progress) * animation.totalDistanceM}
            speed={animation.speed}
            progress={animation.progress}
            bearing={animation.bearing}
            objective={selectedAlgorithm}
            disabledReason={
              selectedRoute
                ? undefined
                : calculating
                  ? 'Calculating selected route…'
                  : 'A valid selected route is required.'
            }
            onPlayPause={() => animation.setPlaying(!animation.playing)}
            onReset={animation.reset}
            onSpeed={animation.setSpeed}
            onSeek={animation.seek}
          />
          <ForecastTimeline
            cycles={scenario.manifest.forecastCycles}
            selectedIndex={cycleIndex}
            onChange={changeCycle}
          />
        </section>
      </main>
      <MetricComparison
        routes={routeMetrics}
        selectedId={selectedAlgorithm}
        dataMode={scenario.manifest.dataMode}
      />
      <ProvenancePanel provenance={scenario.provenance} />
      {new URLSearchParams(location.search).has('debug') && (
        <aside className="debug-panel" aria-label="Navigation diagnostics">
          <strong>Navigation diagnostics</strong>
          <code>{diagnostic}</code>
          <code>
            route={selectedAlgorithm} progress={animation.progress.toFixed(4)}{' '}
            segment={animation.segment} lng={animation.coordinate[0].toFixed(6)}{' '}
            lat={animation.coordinate[1].toFixed(6)}
          </code>
        </aside>
      )}
      <footer>
        <span>AquaNavAI | MS AI research demonstrator</span>
        <span>Immutable scenario {scenario.manifest.version}</span>
        <span>Generated {scenario.manifest.generatedAt.slice(0, 10)}</span>
      </footer>
    </div>
  )
}
export default App
