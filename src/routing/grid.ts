import type {
  Algorithm,
  InteractiveRoute,
  NavigationGridArtifact,
} from '../types/scenario'

export interface DecodedGrid {
  width: number
  height: number
  resolutionM: number
  feasible: Uint8Array
  depth: Uint16Array
  longitude: Float32Array
  latitude: Float32Array
  currentEast: Int16Array
  currentNorth: Int16Array
  depthScaleM: number
  currentScaleMps: number
  forecastBins: number
  vehicle: NavigationGridArtifact['vehicle']
}

const bytes = (encoded: string) => {
  const binary = atob(encoded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer
}

export function decodeGrid(artifact: NavigationGridArtifact): DecodedGrid {
  return {
    width: artifact.width,
    height: artifact.height,
    resolutionM: artifact.resolutionM,
    feasible: new Uint8Array(bytes(artifact.feasible)),
    depth: new Uint16Array(bytes(artifact.depth)),
    longitude: new Float32Array(bytes(artifact.longitude)),
    latitude: new Float32Array(bytes(artifact.latitude)),
    currentEast: new Int16Array(bytes(artifact.currentEast)),
    currentNorth: new Int16Array(bytes(artifact.currentNorth)),
    depthScaleM: artifact.encoding.depthScaleM,
    currentScaleMps: artifact.encoding.currentScaleMps,
    forecastBins: artifact.forecastTimes.length,
    vehicle: artifact.vehicle,
  }
}

class MinHeap {
  private values: Array<[number, number]> = []
  push(value: [number, number]) {
    this.values.push(value)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.values[parent][0] <= value[0]) break
      this.values[index] = this.values[parent]
      index = parent
    }
    this.values[index] = value
  }
  pop(): [number, number] | undefined {
    if (!this.values.length) return undefined
    const root = this.values[0]
    const tail = this.values.pop()
    if (this.values.length && tail) {
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        if (left >= this.values.length) break
        const child =
          right < this.values.length &&
          this.values[right][0] < this.values[left][0]
            ? right
            : left
        if (this.values[child][0] >= tail[0]) break
        this.values[index] = this.values[child]
        index = child
      }
      this.values[index] = tail
    }
    return root
  }
}

const directions = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const

export function nearestFeasible(
  grid: DecodedGrid,
  coordinate: [number, number],
) {
  let minimumLongitude = Number.POSITIVE_INFINITY,
    maximumLongitude = Number.NEGATIVE_INFINITY
  let minimumLatitude = Number.POSITIVE_INFINITY,
    maximumLatitude = Number.NEGATIVE_INFINITY
  for (let node = 0; node < grid.longitude.length; node += 1) {
    minimumLongitude = Math.min(minimumLongitude, grid.longitude[node])
    maximumLongitude = Math.max(maximumLongitude, grid.longitude[node])
    minimumLatitude = Math.min(minimumLatitude, grid.latitude[node])
    maximumLatitude = Math.max(maximumLatitude, grid.latitude[node])
  }
  if (
    coordinate[0] < minimumLongitude ||
    coordinate[0] > maximumLongitude ||
    coordinate[1] < minimumLatitude ||
    coordinate[1] > maximumLatitude
  )
    throw new Error('Selected point is outside the pinned NOAA study domain.')
  let best = -1
  let distance = Number.POSITIVE_INFINITY
  for (let node = 0; node < grid.feasible.length; node += 1) {
    if (!grid.feasible[node]) continue
    const dx = grid.longitude[node] - coordinate[0]
    const dy = grid.latitude[node] - coordinate[1]
    const candidate = dx * dx + dy * dy
    if (candidate < distance) {
      distance = candidate
      best = node
    }
  }
  if (best < 0) throw new Error('The bundled grid has no navigable cells.')
  const latitudeRadians =
    (((coordinate[1] + grid.latitude[best]) / 2) * Math.PI) / 180
  const snapDistanceM = Math.hypot(
    (grid.longitude[best] - coordinate[0]) *
      111_320 *
      Math.cos(latitudeRadians),
    (grid.latitude[best] - coordinate[1]) * 110_540,
  )
  if (snapDistanceM > 2_000)
    throw new Error(
      'Selected point is on land, shallow water, or more than 2 km from a navigable cell.',
    )
  return best
}

interface Edge {
  travel: number
  energy: number
  current: number
}

function edgeCost(
  grid: DecodedGrid,
  node: number,
  time: number,
  dr: number,
  dc: number,
): Edge | null {
  const norm = Math.hypot(dr, dc)
  const offset = time * grid.feasible.length + node
  const east = grid.currentEast[offset] * grid.currentScaleMps
  const north = grid.currentNorth[offset] * grid.currentScaleMps
  const along = east * (dc / norm) + north * (dr / norm)
  const cross = -east * (dr / norm) + north * (dc / norm)
  if (Math.abs(cross) >= grid.vehicle.cruiseSpeedMps) return null
  const ground =
    Math.sqrt(grid.vehicle.cruiseSpeedMps ** 2 - cross ** 2) + along
  if (ground <= 0) return null
  const travel = (grid.resolutionM * norm) / ground
  const power =
    grid.vehicle.hotelPowerW +
    grid.vehicle.propulsionCoefficient * grid.vehicle.cruiseSpeedMps ** 3
  return {
    travel,
    energy: (power * travel) / 3600,
    current: Math.hypot(east, north),
  }
}

function reconstruct(parent: Int32Array, goalState: number, nodeCount: number) {
  const nodes: number[] = []
  let state = goalState
  while (state >= 0) {
    nodes.push(state % nodeCount)
    state = parent[state]
  }
  return nodes.reverse()
}

export function calculateRoute(
  grid: DecodedGrid,
  startCoordinate: [number, number],
  goalCoordinate: [number, number],
  algorithm: Algorithm,
  forecastIndex = 0,
): InteractiveRoute {
  const started = performance.now()
  const count = grid.feasible.length
  const start = nearestFeasible(grid, startCoordinate)
  const goal = nearestFeasible(grid, goalCoordinate)
  const bins = grid.forecastBins - forecastIndex
  const stateCount = algorithm === 'distance' ? count : count * bins
  const cost = new Float64Array(stateCount)
  cost.fill(Number.POSITIVE_INFINITY)
  const arrival = new Float64Array(stateCount)
  arrival.fill(Number.POSITIVE_INFINITY)
  const currentSum = new Float64Array(stateCount)
  const edgeCount = new Uint32Array(stateCount)
  const parent = new Int32Array(stateCount)
  parent.fill(-1)
  const queue = new MinHeap()
  cost[start] = 0
  arrival[start] = 0
  queue.push([0, start])
  let goalState = -1
  while (true) {
    const item = queue.pop()
    if (!item) break
    const [, state] = item
    const node = state % count
    const score = algorithm === 'distance' ? cost[state] : cost[state]
    if (node === goal) {
      goalState = state
      break
    }
    const row = Math.floor(node / grid.width)
    const column = node % grid.width
    const time = Math.floor(arrival[state] / 3600)
    if (time >= bins) continue
    for (const [dr, dc] of directions) {
      const rr = row + dr,
        cc = column + dc
      if (rr < 0 || rr >= grid.height || cc < 0 || cc >= grid.width) continue
      const nextNode = rr * grid.width + cc
      if (!grid.feasible[nextNode]) continue
      const edge = edgeCost(grid, node, forecastIndex + time, dr, dc)
      if (!edge) continue
      const nextArrival = arrival[state] + edge.travel
      const nextBin = Math.floor(nextArrival / 3600)
      if (nextBin >= bins) continue
      const nextState =
        algorithm === 'distance' ? nextNode : nextBin * count + nextNode
      const increment =
        algorithm === 'distance'
          ? grid.resolutionM * Math.hypot(dr, dc)
          : edge.energy
      const candidate = score + increment
      if (candidate < cost[nextState]) {
        cost[nextState] = candidate
        arrival[nextState] = nextArrival
        currentSum[nextState] = currentSum[state] + edge.current
        edgeCount[nextState] = edgeCount[state] + 1
        parent[nextState] = state
        queue.push([candidate, nextState])
      }
    }
  }
  if (goalState < 0)
    throw new Error(
      'No forecast-feasible route exists between the selected points.',
    )
  const nodes = reconstruct(parent, goalState, count)
  let pathLengthM = 0
  let minimumDepthM = Number.POSITIVE_INFINITY
  for (let index = 0; index < nodes.length; index += 1) {
    minimumDepthM = Math.min(
      minimumDepthM,
      grid.depth[nodes[index]] * grid.depthScaleM,
    )
    if (index) {
      const previous = nodes[index - 1]
      pathLengthM +=
        grid.resolutionM *
        Math.hypot(
          Math.floor(nodes[index] / grid.width) -
            Math.floor(previous / grid.width),
          (nodes[index] % grid.width) - (previous % grid.width),
        )
    }
  }
  const travelTimeS = arrival[goalState]
  const power =
    grid.vehicle.hotelPowerW +
    grid.vehicle.propulsionCoefficient * grid.vehicle.cruiseSpeedMps ** 3
  return {
    algorithm,
    coordinates: nodes.map((node) => [
      grid.longitude[node],
      grid.latitude[node],
    ]),
    pathLengthM,
    travelTimeS,
    modelledEnergyWh: (power * travelTimeS) / 3600,
    minimumDepthM,
    meanCurrentMps: edgeCount[goalState]
      ? currentSum[goalState] / edgeCount[goalState]
      : 0,
    computeTimeMs: performance.now() - started,
    start: [grid.longitude[start], grid.latitude[start]],
    goal: [grid.longitude[goal], grid.latitude[goal]],
  }
}
