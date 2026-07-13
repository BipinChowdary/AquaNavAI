import type { LoadedScenario } from '../types/scenario'
import { formatNumber } from '../lib/format'

export function ScenarioSummary({ scenario }: { scenario: LoadedScenario }) {
  const { manifest, provenance } = scenario
  return (
    <section
      className="panel scenario-summary"
      aria-labelledby="scenario-title"
    >
      <div className="eyebrow">Pinned study domain</div>
      <h2 id="scenario-title">{manifest.title}</h2>
      <p className="panel-copy">
        A bounded FAU-relevant shelf experiment comparing identical missions
        across four forecast-aware route objectives.
      </p>
      <dl className="fact-grid">
        <div>
          <dt>Analysis grid</dt>
          <dd>{formatNumber(provenance.analysisGrid.resolutionM, 0)} m</dd>
        </div>
        <div>
          <dt>Forecast cycles</dt>
          <dd>{manifest.forecastCycles.length}</dd>
        </div>
        <div>
          <dt>Objective cases</dt>
          <dd>{scenario.metrics.results.length / 4}</dd>
        </div>
        <div>
          <dt>Analysis CRS</dt>
          <dd>{manifest.crs.analysis}</dd>
        </div>
      </dl>
    </section>
  )
}
