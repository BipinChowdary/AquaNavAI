interface Props {
  playing: boolean
  elapsedS: number
  durationS: number
  remainingM: number
  speed: number
  onPlayPause: () => void
  onReset: () => void
  onSpeed: (speed: number) => void
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
      <button type="button" onClick={props.onPlayPause}>
        {props.playing ? 'Pause' : props.elapsedS ? 'Resume' : 'Play'} ASV
      </button>
      <button type="button" onClick={props.onReset}>
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
      <span>{Math.round(props.elapsedS / 60)} min elapsed</span>
      <span>{(props.remainingM / 1852).toFixed(1)} nm remaining</span>
      <span>ETA +{etaMinutes} min</span>
    </div>
  )
}
