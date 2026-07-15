import { formatCycle } from '../lib/format'

interface ForecastTimelineProps {
  cycles: string[]
  selectedIndex: number
  onChange: (index: number) => void
}

export function ForecastTimeline({
  cycles,
  selectedIndex,
  onChange,
}: ForecastTimelineProps) {
  return (
    <section className="timeline" aria-labelledby="forecast-timeline-title">
      <div>
        <div className="eyebrow">Departure cycle</div>
        <h2 id="forecast-timeline-title">
          {formatCycle(cycles[selectedIndex])}
        </h2>
      </div>
      <label className="sr-only" htmlFor="forecast-cycle">
        Select forecast cycle
      </label>
      <input
        id="forecast-cycle"
        type="range"
        min="0"
        max={cycles.length - 1}
        value={selectedIndex}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="timeline-scale" aria-hidden="true">
        <span>{formatCycle(cycles[0])}</span>
        <span>{formatCycle(cycles.at(-1) ?? cycles[0])}</span>
      </div>
    </section>
  )
}
