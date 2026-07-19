import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { useRouteAnimation } from './animation/useRouteAnimation'
import { BUILD_INFO } from './buildInfo'
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
import {
  INITIALIZATION_SOFT_WARNING_MS,
  INITIALIZATION_STALL_DEADLINE_MS,
  initializationLabels,
  type InitializationStage,
  type MapDiagnostic,
  type ResourceDiagnostic,
} from './initialization/diagnostics'
import { RoutingWorkerClient, type WorkerStatus } from './routing/client'
import {
  exactOverlapMessage,
  ROUTE_ALGORITHMS,
} from './routing/routePresentation'
import {
  PROXY_MISSIONS,
  type Algorithm,
  type InteractiveRoute,
  type LoadedScenario,
  type RouteMetric,
} from './types/scenario'

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
  const [initStage, setInitStage] = useState<InitializationStage>('idle')
  const [initError, setInitError] = useState<string | null>(null)
  const [initRun, setInitRun] = useState(0)
  const [useFallback, setUseFallback] = useState(false)
  const [slowInitialization, setSlowInitialization] = useState(false)
  const [initStartedAt, setInitStartedAt] = useState('')
  const [initDurationMs, setInitDurationMs] = useState<number | null>(null)
  const [stageDurationsMs, setStageDurationsMs] = useState<
    Partial<Record<InitializationStage, number>>
  >({})
  const [initErrorName, setInitErrorName] = useState<string | null>(null)
  const [resourceDiagnostics, setResourceDiagnostics] = useState<
    ResourceDiagnostic[]
  >([])
  const [mapDiagnostic, setMapDiagnostic] = useState<MapDiagnostic>({
    mode: 'pending',
    reason: null,
  })
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
  const [worker] = useState(
    () => new RoutingWorkerClient((status) => setWorkerStatus(status)),
  )

  useEffect(() => {
    let active = true
    let stalled = false
    let stallTimer = 0
    const controller = new AbortController()
    const started = performance.now()
    let timedStage: InitializationStage = 'idle'
    let stageStarted = started
    const softTimer = window.setTimeout(() => {
      if (active) setSlowInitialization(true)
    }, INITIALIZATION_SOFT_WARNING_MS)
    const failForStall = () => {
      if (!active) return
      stalled = true
      controller.abort()
      worker.dispose()
      const now = performance.now()
      setInitDurationMs(now - started)
      setStageDurationsMs((current) => ({
        ...current,
        [timedStage]: (current[timedStage] ?? 0) + (now - stageStarted),
      }))
      setInitErrorName('TimeoutError')
      setInitError(
        `Initialization stopped because no progress was observed for ${INITIALIZATION_STALL_DEADLINE_MS / 1000} seconds during ${initializationLabels[timedStage].toLowerCase()}. Retry the scenario or load the deterministic proxy fixture.`,
      )
      setInitStage('failed')
    }
    const markProgress = (stage?: InitializationStage) => {
      if (!active) return
      if (stage && stage !== timedStage) {
        const now = performance.now()
        const completedStage = timedStage
        const completedDuration = now - stageStarted
        setStageDurationsMs((current) => ({
          ...current,
          [completedStage]: (current[completedStage] ?? 0) + completedDuration,
        }))
        timedStage = stage
        stageStarted = now
        setInitStage(stage)
      }
      clearTimeout(stallTimer)
      stallTimer = window.setTimeout(
        failForStall,
        INITIALIZATION_STALL_DEADLINE_MS,
      )
    }
    const initialize = async () => {
      try {
        setInitError(null)
        setInitErrorName(null)
        setSlowInitialization(false)
        setInitStartedAt(new Date().toISOString())
        setInitDurationMs(null)
        setStageDurationsMs({})
        setResourceDiagnostics([])
        setMapDiagnostic({ mode: 'pending', reason: null })
        initialRouteStarted.current = false
        setScenario(null)
        setMapReady(false)
        setWorkerReady(false)
        markProgress('loading_release_index')
        const loaded = await loadScenario(
          useFallback ? 'south-florida-v1' : undefined,
          {
            signal: controller.signal,
            onStage: markProgress,
            onResource: (next) => {
              markProgress()
              setResourceDiagnostics((current) => {
                const without = current.filter(
                  (resource) => resource.name !== next.name,
                )
                return [...without, next]
              })
            },
          },
        )
        if (!active) return
        const mission = loaded.navigationGrid?.missions[0] ?? PROXY_MISSIONS[0]
        setScenario(loaded)
        setPairId(mission.id)
        setEndpoints({ start: [...mission.start], goal: [...mission.goal] })
        setInteractiveRoutes([])
        setCycleIndex(0)
        if (!loaded.navigationGrid) {
          markProgress('ready')
          setInitDurationMs(performance.now() - started)
          clearTimeout(stallTimer)
          return
        }
        markProgress('starting_worker')
        await Promise.resolve()
        markProgress('constructing_model')
        await worker.initialize(
          loaded.navigationGrid,
          INITIALIZATION_STALL_DEADLINE_MS,
        )
        if (!active) return
        setWorkerReady(true)
        markProgress('ready')
        setInitDurationMs(performance.now() - started)
        clearTimeout(stallTimer)
      } catch (reason) {
        if (!active || stalled) return
        setInitDurationMs(performance.now() - started)
        setInitErrorName(reason instanceof Error ? reason.name : 'Error')
        setInitError(
          reason instanceof DOMException && reason.name === 'AbortError'
            ? 'Scenario loading was interrupted. Retry to start a clean initialization run.'
            : reason instanceof Error
              ? reason.message
              : 'Unknown initialization error',
        )
        markProgress('failed')
        clearTimeout(stallTimer)
      }
    }
    void initialize()
    return () => {
      active = false
      controller.abort()
      clearTimeout(softTimer)
      clearTimeout(stallTimer)
      worker.dispose()
    }
  }, [initRun, useFallback, worker])

  const effectiveInitStage: InitializationStage = initStage

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
        const routeAlgorithms = routes.map((route) => route.algorithm)
        const uniqueAlgorithms = new Set(routeAlgorithms)
        if (
          routes.length !== ROUTE_ALGORITHMS.length ||
          uniqueAlgorithms.size !== ROUTE_ALGORITHMS.length ||
          ROUTE_ALGORITHMS.some((algorithm) => !uniqueAlgorithms.has(algorithm))
        )
          throw new Error(
            `Expected four independent route objectives; received ${routeAlgorithms.join(', ') || 'none'}.`,
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
    if (effectiveInitStage !== 'ready' || !workerReady || !endpoints || !cycle)
      return
    if (initialRouteStarted.current) return
    initialRouteStarted.current = true
    void calculateFor(endpoints)
  }, [effectiveInitStage, workerReady, endpoints, cycle, calculateFor])

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
    if (scenario.navigationGrid) void calculateFor(next)
  }

  const choosePoint = (coordinate: [number, number]) => {
    if (!endpoints || effectiveInitStage !== 'ready') return
    if (!scenario?.navigationGrid) {
      setRouteError(
        'Custom routing is unavailable in the static deterministic proxy fixture.',
      )
      return
    }
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
    if (endpoints && scenario?.navigationGrid)
      void calculateFor(endpoints, index)
  }

  const routeMetrics = useMemo(
    () =>
      interactiveRoutes.length
        ? interactiveRoutes.map((route) => asMetric(route, cycle))
        : (scenario?.metrics.results ?? []).filter(
            (metric) =>
              metric.pair_id === pairId && metric.forecast_cycle === cycle,
          ),
    [interactiveRoutes, cycle, pairId, scenario],
  )
  const overlapMessage = useMemo(
    () => exactOverlapMessage(interactiveRoutes),
    [interactiveRoutes],
  )
  const toggleAlgorithm = (algorithm: Algorithm) =>
    setVisibleAlgorithms((current) => {
      const next = new Set(current)
      if (next.has(algorithm)) next.delete(algorithm)
      else next.add(algorithm)
      return next
    })
  const caseCount = useMemo(
    () =>
      new Set(
        scenario?.metrics.results.map(
          (metric) => `${metric.pair_id}:${metric.forecast_cycle}`,
        ) ?? [],
      ).size,
    [scenario],
  )

  const diagnostic = JSON.stringify({
    application: BUILD_INFO,
    stage: effectiveInitStage,
    startedAt: initStartedAt,
    durationMs: initDurationMs,
    stageDurationsMs,
    softWarningAfterMs: INITIALIZATION_SOFT_WARNING_MS,
    stallDeadlineMs: INITIALIZATION_STALL_DEADLINE_MS,
    scenario: scenario?.manifest.id ?? null,
    version: scenario?.manifest.version ?? null,
    worker: workerStatus,
    workerDecodeMs: worker.decodeTimeMs,
    workerStartupMs: worker.startupTimeMs,
    mapReady,
    map: mapDiagnostic,
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
    },
    resources: resourceDiagnostics,
    error: initError
      ? { name: initErrorName ?? 'Error', message: initError }
      : null,
  })

  if (!scenario || effectiveInitStage === 'failed')
    return (
      <main
        className={`load-state ${effectiveInitStage === 'failed' ? 'load-state--error' : ''}`}
        data-init-stage={effectiveInitStage}
      >
        {effectiveInitStage !== 'failed' && (
          <div className="loading-ring" aria-hidden="true" />
        )}
        <span>{initializationLabels[effectiveInitStage]}</span>
        {slowInitialization && effectiveInitStage !== 'failed' && (
          <p className="slow-initialization" role="status">
            Initialization is taking longer than expected. AquaNavAI is still
            making progress and will continue safely.
          </p>
        )}
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
                Load deterministic proxy fixture
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
          <span>{initializationLabels[effectiveInitStage]}</span>
          <progress />
        </div>
      )}
      {slowInitialization && effectiveInitStage !== 'ready' && (
        <div
          className="slow-initialization slow-initialization--banner"
          role="status"
        >
          Still loading safely; progress continues beyond the 8-second advisory.
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
        <div className="project-actions">
          <div className="project-credit">
            <span>A Research Project by</span>
            <a
              href="https://bipinchowdary.github.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>Bipin Chowdary</strong>
            </a>
          </div>
          <a
            className="header-button header-button--primary"
            href="https://bipinchowdary.github.io/AQNV/"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Project Details
          </a>
          <a
            className="header-button header-button--secondary"
            href="https://github.com/BipinChowdary/AQNV/blob/main/Paper.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Paper
          </a>
        </div>
        <StatusBanner dataMode={scenario.manifest.dataMode} cases={caseCount} />
      </header>
      <ResearchDisclaimer text={scenario.manifest.disclaimer} />
      <div className={`data-status data-status--${scenario.manifest.dataMode}`}>
        {scenario.manifest.dataMode === 'pinned-noaa'
          ? 'Verified NOAA-derived environmental snapshot. Research demonstrator; not for operational navigation.'
          : 'Deterministic proxy fixture; not a NOAA-derived scientific result.'}
        <a href="#provenance">Data provenance</a>
        {mapDiagnostic.mode === 'simplified' && (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(diagnostic)}
          >
            Copy diagnostic
          </button>
        )}
      </div>
      <main id="top" className="workspace">
        <aside className="workspace-sidebar">
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
            overlapMessage={overlapMessage}
            workerStatus={workerStatus}
            fallbackMode={!scenario.navigationGrid}
          />
          <ScenarioSummary scenario={scenario} />
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
                setMapReady(true)
              }}
              onModeChange={(mode, reason) =>
                setMapDiagnostic({ mode, reason })
              }
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
        <span>AquaNavAI — Project by Bipin Chowdary</span>
        <span>Scenario v{scenario.manifest.version}</span>
      </footer>
    </div>
  )
}
export default App
