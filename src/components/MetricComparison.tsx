import {
  formatDistance,
  formatDuration,
  formatEnergy,
  formatNumber,
} from '../lib/format'
import type { RouteMetric } from '../types/scenario'

interface MetricComparisonProps {
  routes: RouteMetric[]
  selectedId: string
  dataMode?: 'offline-proxy' | 'pinned-noaa'
}

const labels: Record<string, string> = {
  shortest: 'Shortest',
  fastest: 'Fastest',
  energy: 'Energy',
  balanced: 'Balanced',
}

export function MetricComparison({
  routes,
  selectedId,
  dataMode = 'offline-proxy',
}: MetricComparisonProps) {
  return (
    <section className="metrics" aria-labelledby="metric-comparison-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            {dataMode === 'pinned-noaa'
              ? 'Four-objective evaluation'
              : 'Legacy proxy evaluation'}
          </div>
          <h2 id="metric-comparison-title">Route outcomes</h2>
        </div>
        <p>
          {dataMode === 'pinned-noaa'
            ? 'Same mission, grid, constraints, vehicle, and forecast departure'
            : 'Deterministic distance and environmental-cost software baselines'}
        </p>
      </div>
      <div className="metric-grid metric-grid--routes">
        {routes.map((route) => (
          <article
            className={`metric-card ${route.algorithm === selectedId ? 'metric-card--selected' : ''}`}
            key={route.id}
            data-route-metric={route.algorithm}
          >
            <div className="metric-card__header">
              <span>{labels[route.algorithm] ?? route.algorithm}</span>
              <span className="tag">
                {['shortest', 'distance'].includes(route.algorithm)
                  ? 'Dijkstra'
                  : 'A*'}
              </span>
            </div>
            <dl className="route-metrics">
              <div>
                <dt>Distance</dt>
                <dd>{formatDistance(route.path_length_m)}</dd>
              </div>
              <div>
                <dt>Transit</dt>
                <dd>{formatDuration(route.travel_time_s)}</dd>
              </div>
              <div>
                <dt>Modelled energy</dt>
                <dd>{formatEnergy(route.modelled_propulsion_energy_wh)}</dd>
              </div>
              <div>
                <dt>Risk score</dt>
                <dd>{formatNumber(route.risk_score ?? 0, 2)}</dd>
              </div>
              <div>
                <dt>Minimum depth</dt>
                <dd>{formatNumber(route.minimum_depth_m, 1)} m</dd>
              </div>
              <div>
                <dt>Mean current</dt>
                <dd>{formatNumber(route.mean_current_mps, 2)} m/s</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className="control-hint">
        {dataMode === 'pinned-noaa'
          ? 'Currents are from the pinned NOAA RTOFS field; propulsion energy and risk are modelled quantities.'
          : 'This fallback uses deterministic proxy inputs, not NOAA observations.'}
      </p>
    </section>
  )
}
