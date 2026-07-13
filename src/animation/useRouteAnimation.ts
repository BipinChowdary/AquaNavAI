import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const earthRadiusM = 6_371_000
const radians = (value: number) => (value * Math.PI) / 180
const degrees = (value: number) => (value * 180) / Math.PI
const demoDurationMs = 22_000

export const segmentDistance = (a: [number, number], b: [number, number]) =>
  Math.hypot(
    radians(b[0] - a[0]) * Math.cos(radians((a[1] + b[1]) / 2)),
    radians(b[1] - a[1]),
  ) * earthRadiusM

export const routeBearing = (a: [number, number], b: [number, number]) => {
  const y = Math.sin(radians(b[0] - a[0])) * Math.cos(radians(b[1]))
  const x =
    Math.cos(radians(a[1])) * Math.sin(radians(b[1])) -
    Math.sin(radians(a[1])) *
      Math.cos(radians(b[1])) *
      Math.cos(radians(b[0] - a[0]))
  return (degrees(Math.atan2(y, x)) + 360) % 360
}

export interface AnimationFrame {
  coordinate: [number, number]
  bearing: number
  progress: number
  segment: number
}

export function interpolateRoute(
  coordinates: [number, number][],
  distances: number[],
  progress: number,
): AnimationFrame {
  if (!coordinates.length)
    return { coordinate: [0, 0], bearing: 0, progress: 0, segment: 0 }
  if (coordinates.length === 1)
    return { coordinate: coordinates[0], bearing: 0, progress, segment: 0 }
  const total = distances.at(-1) ?? 0
  const target = Math.max(0, Math.min(1, progress)) * total
  let segment = distances.findIndex((value) => value >= target) - 1
  segment = Math.max(0, Math.min(coordinates.length - 2, segment))
  const start = coordinates[segment]
  const end = coordinates[segment + 1]
  const span = distances[segment + 1] - distances[segment]
  const ratio = span ? (target - distances[segment]) / span : 0
  return {
    coordinate: [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ],
    bearing: routeBearing(start, end),
    progress: Math.max(0, Math.min(1, progress)),
    segment,
  }
}

export function useRouteAnimation(
  coordinates: [number, number][],
  durationS: number,
  onFrame?: (frame: AnimationFrame) => void,
) {
  const [snapshot, setSnapshot] = useState({ progress: 0, playing: false })
  const [speed, setSpeed] = useState(1)
  const frameId = useRef<number | null>(null)
  const lastTime = useRef<number | null>(null)
  const lastUiUpdate = useRef(0)
  const progressRef = useRef(0)
  const playingRef = useRef(false)
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])
  const distances = useMemo(() => {
    const values = [0]
    for (let index = 1; index < coordinates.length; index += 1)
      values.push(
        values[index - 1] +
          segmentDistance(coordinates[index - 1], coordinates[index]),
      )
    return values
  }, [coordinates])
  const totalDistanceM = distances.at(-1) ?? 0

  const emit = useCallback(
    (progress: number, updateUi = true) => {
      const current = interpolateRoute(coordinates, distances, progress)
      onFrameRef.current?.(current)
      if (updateUi)
        setSnapshot({ progress: current.progress, playing: playingRef.current })
      return current
    },
    [coordinates, distances],
  )

  const stopLoop = useCallback(() => {
    if (frameId.current !== null) cancelAnimationFrame(frameId.current)
    frameId.current = null
    lastTime.current = null
  }, [])

  useEffect(() => {
    stopLoop()
    playingRef.current = false
    progressRef.current = 0
    emit(0)
  }, [coordinates, emit, stopLoop])

  useEffect(() => {
    if (!snapshot.playing || coordinates.length < 2) return
    playingRef.current = true
    const tick = (time: number) => {
      if (!playingRef.current) return
      if (lastTime.current !== null) {
        const delta = ((time - lastTime.current) * speed) / demoDurationMs
        progressRef.current = Math.min(1, progressRef.current + delta)
        const updateUi =
          time - lastUiUpdate.current >= 100 || progressRef.current >= 1
        emit(progressRef.current, updateUi)
        if (updateUi) lastUiUpdate.current = time
        if (progressRef.current >= 1) {
          playingRef.current = false
          setSnapshot({ progress: 1, playing: false })
          stopLoop()
          return
        }
      }
      lastTime.current = time
      frameId.current = requestAnimationFrame(tick)
    }
    frameId.current = requestAnimationFrame(tick)
    return stopLoop
  }, [snapshot.playing, speed, coordinates.length, emit, stopLoop])

  useEffect(() => {
    const handler = () => {
      if (!document.hidden) return
      playingRef.current = false
      setSnapshot((current) => ({ ...current, playing: false }))
      stopLoop()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [stopLoop])

  const setPlaying = useCallback(
    (playing: boolean) => {
      if (!coordinates.length || progressRef.current >= 1) return
      playingRef.current = playing
      setSnapshot((current) => ({ ...current, playing }))
      if (!playing) stopLoop()
    },
    [coordinates.length, stopLoop],
  )
  const reset = useCallback(() => {
    stopLoop()
    playingRef.current = false
    progressRef.current = 0
    emit(0)
  }, [emit, stopLoop])
  const seek = useCallback(
    (progress: number) => {
      progressRef.current = Math.max(0, Math.min(1, progress))
      emit(progressRef.current)
    },
    [emit],
  )
  const frame = interpolateRoute(coordinates, distances, snapshot.progress)
  return {
    elapsedS: durationS * snapshot.progress,
    playing: snapshot.playing,
    speed,
    progress: snapshot.progress,
    totalDistanceM,
    coordinate: frame.coordinate,
    bearing: frame.bearing,
    segment: frame.segment,
    setPlaying,
    setSpeed,
    reset,
    seek,
  }
}
