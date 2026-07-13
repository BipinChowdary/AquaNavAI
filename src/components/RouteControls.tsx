import type { Algorithm, NavigationGridArtifact } from '../types/scenario'

interface RouteControlsProps {
  pairId: string
  onPairChange: (pairId: string) => void
  visibleAlgorithms: Set<Algorithm>
  onAlgorithmToggle: (algorithm: Algorithm) => void
  missions: Readonly<NavigationGridArtifact['missions']>
  onCalculate: () => void
  calculating: boolean
  routeError: string | null
}

export function RouteControls({ pairId, onPairChange, visibleAlgorithms, onAlgorithmToggle, missions, onCalculate, calculating, routeError }: RouteControlsProps) {
  return (
    <section className="panel controls" aria-labelledby="route-controls-title">
      <div className="panel-heading"><div><div className="eyebrow">Mission controls</div><h2 id="route-controls-title">Route comparison</h2></div><span className="status-dot">offline</span></div>
      <label className="field-label" htmlFor="route-pair">Verified mission</label>
      <select id="route-pair" value={pairId} onChange={(event) => onPairChange(event.target.value)}>
        {missions.map((pair) => <option key={pair.id} value={pair.id}>{pair.label}</option>)}
        {pairId === 'custom' && <option value="custom">Custom map selection</option>}
      </select>
      <p className="control-hint">Choose a mission or click two offshore points. Points snap to the nearest valid 500 m cell.</p>
      <button className="calculate-button" type="button" onClick={onCalculate} disabled={calculating}>
        {calculating ? 'Routing in worker...' : 'Calculate routes in browser'}
      </button>
      {routeError && <p className="route-error" role="alert">{routeError}</p>}
      <fieldset className="route-legend"><legend>Visible routes</legend>
        <label><input type="checkbox" checked={visibleAlgorithms.has('distance')} onChange={() => onAlgorithmToggle('distance')} /><span className="legend-line legend-line--distance" />Distance baseline</label>
        <label><input type="checkbox" checked={visibleAlgorithms.has('environmental')} onChange={() => onAlgorithmToggle('environmental')} /><span className="legend-line legend-line--environmental" />Environmental A*</label>
      </fieldset>
    </section>
  )
}
