interface Props {
  playing: boolean
  elapsedS: number
  durationS: number
  remainingM: number
  speed: number
  progress: number
  bearing: number
  objective: string
  disabledReason?: string
  onPlayPause: () => void
  onReset: () => void
  onSpeed: (speed: number) => void
  onSeek: (progress: number) => void
}
export function AnimationControls(props: Props) {
  const etaMinutes = Math.ceil(
    Math.max(0, props.durationS - props.elapsedS) / 60,
  )
  return (
    <div
      className="animation-controls"
      aria-label="ASV mission animation controls"
    >
      <button
        type="button"
        onClick={props.onPlayPause}
        disabled={Boolean(props.disabledReason)}
        title={props.disabledReason}
      >
        {props.playing ? 'Pause' : props.elapsedS ? 'Resume' : 'Play'} ASV
      </button>
      <button
        type="button"
        onClick={props.onReset}
        disabled={Boolean(props.disabledReason)}
      >
        Reset
      </button>
      <label>
        Speed{' '}
        <select
          value={props.speed}
          onChange={(event) => props.onSpeed(Number(event.target.value))}
        >
          {[1, 5, 10].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
      </label>
      <label className="animation-progress">
        Progress{' '}
        <input
          aria-label="Animation progress"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(props.progress * 100)}
          disabled={Boolean(props.disabledReason)}
          onChange={(event) => props.onSeek(Number(event.target.value) / 100)}
        />
      </label>
      <strong>{Math.round(props.progress * 100)}%</strong>
      <span>{Math.round(props.elapsedS / 60)} simulated min</span>
      <span>{(props.remainingM / 1852).toFixed(1)} nm remaining</span>
      <span>ETA +{etaMinutes} min</span>
      <span>{props.bearing.toFixed(0)}° heading</span>
      <span>{props.objective}</span>
      {props.disabledReason && (
        <span className="route-error">{props.disabledReason}</span>
      )}
    </div>
  )
}
