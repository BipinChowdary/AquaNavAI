import type { Algorithm, NavigationGridArtifact } from '../types/scenario'

const objectiveDetails: Array<{
  id: Algorithm
  label: string
  detail: string
}> = [
  {
    id: 'shortest',
    label: 'Shortest Distance',
    detail: 'Distance-only Dijkstra baseline',
  },
  {
    id: 'fastest',
    label: 'Fastest Arrival',
    detail: 'Current-aware transit time',
  },
  {
    id: 'energy',
    label: 'Lowest Modelled Energy',
    detail: 'Documented energy proxy',
  },
  {
    id: 'balanced',
    label: 'Balanced Mission',
    detail: 'Time, energy, current and depth risk',
  },
]

interface RouteControlsProps {
  pairId: string
  onPairChange: (pairId: string) => void
  visibleAlgorithms: Set<Algorithm>
  onAlgorithmToggle: (algorithm: Algorithm) => void
  selectedAlgorithm: Algorithm
  onAlgorithmSelect: (algorithm: Algorithm) => void
  missions: Readonly<NavigationGridArtifact['missions']>
  onCalculate: () => void
  calculating: boolean
  routeError: string | null
  workerStatus: string
  fallbackMode?: boolean
}

export function RouteControls(props: RouteControlsProps) {
  return (
    <section className="panel controls" aria-labelledby="route-controls-title">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Mission controls</div>
          <h2 id="route-controls-title">
            {props.fallbackMode ? 'Static fallback' : 'Navigation V2'}
          </h2>
        </div>
        <span className="status-dot" data-testid="worker-status">
          {props.fallbackMode ? 'static' : props.workerStatus}
        </span>
      </div>
      <label className="field-label" htmlFor="route-pair">
        Verified mission
      </label>
      <select
        id="route-pair"
        value={props.pairId}
        onChange={(event) => props.onPairChange(event.target.value)}
      >
        {props.missions.map((pair) => (
          <option key={pair.id} value={pair.id}>
            {pair.label}
          </option>
        ))}
        {props.pairId === 'custom' && (
          <option value="custom">Custom map selection</option>
        )}
      </select>
      <p className="control-hint">
        {props.fallbackMode
          ? 'Validated deterministic proxy fixture. Select a released mission to inspect its two legacy baseline routes.'
          : 'Choose a mission or click two offshore points. Points snap deterministically to the nearest valid 500 m cell.'}
      </p>
      {!props.fallbackMode && (
        <button
          className="calculate-button"
          type="button"
          onClick={props.onCalculate}
          disabled={props.calculating || props.workerStatus !== 'ready'}
        >
          {props.calculating
            ? 'Calculating four objectives…'
            : 'Recalculate four routes'}
        </button>
      )}
      {props.routeError && (
        <p className="route-error" role="alert">
          {props.routeError}
        </p>
      )}
      {!props.fallbackMode && (
        <fieldset className="route-legend">
          <legend>Route objective and visibility</legend>
          {objectiveDetails.map((objective) => (
            <div className="route-objective" key={objective.id}>
              <label>
                <input
                  type="radio"
                  name="selected-route"
                  checked={props.selectedAlgorithm === objective.id}
                  onChange={() => props.onAlgorithmSelect(objective.id)}
                />
                <span className={`legend-line legend-line--${objective.id}`} />
                <span>
                  <strong>{objective.label}</strong>
                  <small>{objective.detail}</small>
                </span>
              </label>
              <label
                className="visibility-toggle"
                title={`Toggle ${objective.label} visibility`}
              >
                <input
                  type="checkbox"
                  aria-label={`Show ${objective.label}`}
                  checked={props.visibleAlgorithms.has(objective.id)}
                  onChange={() => props.onAlgorithmToggle(objective.id)}
                />
              </label>
            </div>
          ))}
        </fieldset>
      )}
      <p className="control-hint">
        {props.fallbackMode
          ? 'Interactive four-objective recalculation is unavailable in the legacy proxy fixture; proxy values are not NOAA results.'
          : 'Fastest, lowest-energy, and balanced objectives may overlap under the reference vehicle and pinned field. Overlap is a model result, not hidden or cosmetically separated.'}
      </p>
    </section>
  )
}
