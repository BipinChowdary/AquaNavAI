import { ROUTE_PAIRS, type Algorithm } from '../types/scenario'

interface RouteControlsProps {
  pairId: string
  onPairChange: (pairId: string) => void
  visibleAlgorithms: Set<Algorithm>
  onAlgorithmToggle: (algorithm: Algorithm) => void
}

export function RouteControls({
  pairId,
  onPairChange,
  visibleAlgorithms,
  onAlgorithmToggle,
}: RouteControlsProps) {
  return (
    <section className="panel controls" aria-labelledby="route-controls-title">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Mission controls</div>
          <h2 id="route-controls-title">Route comparison</h2>
        </div>
        <span className="status-dot">offline</span>
      </div>
      <label className="field-label" htmlFor="route-pair">
        Mission pair
      </label>
      <select id="route-pair" value={pairId} onChange={(event) => onPairChange(event.target.value)}>
        {ROUTE_PAIRS.map((pair) => (
          <option key={pair.id} value={pair.id}>
            {pair.label}
          </option>
        ))}
      </select>
      <fieldset className="route-legend">
        <legend>Visible routes</legend>
        <label>
          <input
            type="checkbox"
            checked={visibleAlgorithms.has('distance')}
            onChange={() => onAlgorithmToggle('distance')}
          />
          <span className="legend-line legend-line--distance" />
          Distance baseline
        </label>
        <label>
          <input
            type="checkbox"
            checked={visibleAlgorithms.has('environmental')}
            onChange={() => onAlgorithmToggle('environmental')}
          />
          <span className="legend-line legend-line--environmental" />
          Environmental A*
        </label>
      </fieldset>
    </section>
  )
}
