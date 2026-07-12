import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { CoastalMap } from './components/CoastalMap'
import { ForecastTimeline } from './components/ForecastTimeline'
import { MetricComparison } from './components/MetricComparison'
import { ProvenancePanel } from './components/ProvenancePanel'
import { ResearchDisclaimer } from './components/ResearchDisclaimer'
import { RouteControls } from './components/RouteControls'
import { ScenarioSummary } from './components/ScenarioSummary'
import { StatusBanner } from './components/StatusBanner'
import { loadScenario } from './data/loadScenario'
import type { Algorithm, LoadedScenario } from './types/scenario'

function App() {
  const [scenario, setScenario] = useState<LoadedScenario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pairId, setPairId] = useState('shelf-northbound')
  const [cycleIndex, setCycleIndex] = useState(0)
  const [visibleAlgorithms, setVisibleAlgorithms] = useState<Set<Algorithm>>(
    () => new Set(['distance', 'environmental']),
  )

  useEffect(() => {
    let active = true
    loadScenario()
      .then((loaded) => {
        if (active) setScenario(loaded)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unknown scenario-loading error')
      })
    return () => {
      active = false
    }
  }, [])

  const selectedMetrics = useMemo(() => {
    if (!scenario) return null
    const cycle = scenario.manifest.forecastCycles[cycleIndex]
    const candidates = scenario.metrics.results.filter(
      (result) => result.pair_id === pairId && result.forecast_cycle === cycle,
    )
    const distance = candidates.find((result) => result.algorithm === 'distance')
    const environmental = candidates.find((result) => result.algorithm === 'environmental')
    return distance && environmental ? { distance, environmental } : null
  }, [scenario, pairId, cycleIndex])

  const toggleAlgorithm = (algorithm: Algorithm) => {
    setVisibleAlgorithms((current) => {
      const next = new Set(current)
      if (next.has(algorithm)) next.delete(algorithm)
      else next.add(algorithm)
      return next
    })
  }

  if (error) {
    return (
      <main className="load-state load-state--error">
        <span>Scenario unavailable</span>
        <h1>AquaNavAI could not load the pinned artifact.</h1>
        <p>{error}</p>
      </main>
    )
  }
  if (!scenario || !selectedMetrics) {
    return (
      <main className="load-state">
        <div className="loading-ring" aria-hidden="true" />
        <span>Validating offline scenario contract…</span>
      </main>
    )
  }

  const cycle = scenario.manifest.forecastCycles[cycleIndex]
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
        <StatusBanner />
      </header>

      <ResearchDisclaimer text={scenario.manifest.disclaimer} />

      <main id="top" className="workspace">
        <aside className="workspace-sidebar">
          <ScenarioSummary scenario={scenario} />
          <RouteControls
            pairId={pairId}
            onPairChange={setPairId}
            visibleAlgorithms={visibleAlgorithms}
            onAlgorithmToggle={toggleAlgorithm}
          />
        </aside>
        <section className="map-workspace" aria-label="Route-planning workspace">
          <CoastalMap
            scenario={scenario}
            pairId={pairId}
            forecastCycle={cycle}
            visibleAlgorithms={visibleAlgorithms}
          />
          <ForecastTimeline
            cycles={scenario.manifest.forecastCycles}
            selectedIndex={cycleIndex}
            onChange={setCycleIndex}
          />
        </section>
      </main>

      <MetricComparison {...selectedMetrics} />
      <ProvenancePanel provenance={scenario.provenance} />

      <footer>
        <span>AquaNavAI · MS AI research scaffold</span>
        <span>Immutable scenario {scenario.manifest.version}</span>
        <span>Generated {scenario.manifest.generatedAt.slice(0, 10)}</span>
      </footer>
    </div>
  )
}

export default App
