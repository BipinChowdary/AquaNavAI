import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const earthRadiusM = 6_371_000
const radians = (value: number) => (value * Math.PI) / 180
const degrees = (value: number) => (value * 180) / Math.PI

export const segmentDistance = (a: [number, number], b: [number, number]) => Math.hypot(radians(b[0] - a[0]) * Math.cos(radians((a[1] + b[1]) / 2)), radians(b[1] - a[1])) * earthRadiusM
export const routeBearing = (a: [number, number], b: [number, number]) => {
  const y = Math.sin(radians(b[0] - a[0])) * Math.cos(radians(b[1]))
  const x = Math.cos(radians(a[1])) * Math.sin(radians(b[1])) - Math.sin(radians(a[1])) * Math.cos(radians(b[1])) * Math.cos(radians(b[0] - a[0]))
  return (degrees(Math.atan2(y, x)) + 360) % 360
}

export function useRouteAnimation(coordinates: [number, number][], durationS: number) {
  const [elapsedS, setElapsedS] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const frame = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const distances = useMemo(() => { const values = [0]; for (let i = 1; i < coordinates.length; i += 1) values.push(values[i - 1] + segmentDistance(coordinates[i - 1], coordinates[i])); return values }, [coordinates])
  const totalDistanceM = distances.at(-1) ?? 0
  useEffect(() => {
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const tick = (time: number) => { if (last.current !== null && !reduced) { elapsedRef.current = Math.min(durationS, elapsedRef.current + ((time - last.current) / 1000) * speed); setElapsedS(elapsedRef.current); if (elapsedRef.current >= durationS) { setPlaying(false); return } } last.current = time; frame.current = requestAnimationFrame(tick) }
    if (playing) frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; last.current = null }
  }, [playing, speed, durationS])
  useEffect(() => { const handler = () => { if (document.hidden) setPlaying(false) }; document.addEventListener('visibilitychange', handler); return () => document.removeEventListener('visibilitychange', handler) }, [])
  const progress = durationS ? Math.min(elapsedS / durationS, 1) : 0
  const target = progress * totalDistanceM
  let segment = Math.max(0, distances.findIndex((value) => value >= target) - 1)
  if (segment >= coordinates.length - 1) segment = Math.max(0, coordinates.length - 2)
  const start = coordinates[segment] ?? [0, 0], end = coordinates[segment + 1] ?? start
  const span = (distances[segment + 1] ?? target) - (distances[segment] ?? 0), ratio = span ? (target - distances[segment]) / span : 0
  const coordinate: [number, number] = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]
  const reset = useCallback(() => { setPlaying(false); setElapsedS(0); elapsedRef.current = 0; last.current = null }, [])
  return { elapsedS, playing, speed, progress, totalDistanceM, coordinate, bearing: routeBearing(start, end), setPlaying, setSpeed, reset }
}
