import { formatDistance, formatDuration, formatEnergy, formatNumber } from '../lib/format'
import type { RouteMetric } from '../types/scenario'

interface MetricComparisonProps {
  distance: RouteMetric
  environmental: RouteMetric
}

function deltaPercent(baseline: number, value: number) {
  return baseline === 0 ? 0 : ((value - baseline) / baseline) * 100
}

export function MetricComparison({ distance, environmental }: MetricComparisonProps) {
  const energyDelta = deltaPercent(
    distance.modelled_propulsion_energy_wh,
    environmental.modelled_propulsion_energy_wh,
  )
  const timeDelta = deltaPercent(distance.travel_time_s, environmental.travel_time_s)
  const distanceDelta = deltaPercent(distance.path_length_m, environmental.path_length_m)
  const metrics = [
    {
      label: 'Modelled energy',
      baseline: formatEnergy(distance.modelled_propulsion_energy_wh),
      treatment: formatEnergy(environmental.modelled_propulsion_energy_wh),
      delta: energyDelta,
    },
    {
      label: 'Transit time',
      baseline: formatDuration(distance.travel_time_s),
      treatment: formatDuration(environmental.travel_time_s),
      delta: timeDelta,
    },
    {
      label: 'Path length',
      baseline: formatDistance(distance.path_length_m),
      treatment: formatDistance(environmental.path_length_m),
      delta: distanceDelta,
    },
  ]
  return (
    <section className="metrics" aria-labelledby="metric-comparison-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Paired evaluation</div>
          <h2 id="metric-comparison-title">Route outcome</h2>
        </div>
        <p>Same mission, grid, constraints, and departure cycle</p>
      </div>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-card__header">
              <span>{metric.label}</span>
              <span className={metric.delta <= 0 ? 'delta delta--good' : 'delta delta--bad'}>
                {metric.delta > 0 ? '+' : ''}
                {formatNumber(metric.delta, 1)}%
              </span>
            </div>
            <div className="metric-values">
              <div>
                <span>Distance</span>
                <strong>{metric.baseline}</strong>
              </div>
              <div>
                <span>Environmental</span>
                <strong>{metric.treatment}</strong>
              </div>
            </div>
          </article>
        ))}
        <article className="metric-card metric-card--context">
          <div className="metric-card__header">
            <span>Environmental context</span>
            <span className="tag">proxy</span>
          </div>
          <div className="metric-values">
            <div>
              <span>Minimum depth</span>
              <strong>{formatNumber(environmental.minimum_depth_m, 1)} m</strong>
            </div>
            <div>
              <span>Mean current</span>
              <strong>{formatNumber(environmental.mean_current_mps, 2)} m/s</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
