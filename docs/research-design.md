# Benchmark-first research design

## Research question

For identical South Florida coastal missions and departure cycles, how does a
forecast-aware energy objective change route length, travel time, and modelled
propulsion energy relative to the shortest feasible path?

## Baselines

- **Distance baseline:** Dijkstra on the common eight-neighbour, 500 m feasible
  grid using edge distance only.
- **Environmental baseline:** A* over `(cell, one-hour forecast bin)` minimizing
  a propulsion-energy proxy under time-varying surface currents.

Both algorithms use the same endpoints, depth threshold, buffer, departure
cycle, reference vehicle, and forecast horizon. Waiting and extrapolation are
disabled. A route fails explicitly if the vehicle cannot counter a cross-current
or the forecast horizon is exceeded.

## Vehicle proxy

- Through-water speed: 1.5 m/s.
- Hotel power: 30 W.
- Propulsion power: `44.44 × v³ W`, approximately 150 W at cruise.

This is modelled energy, not measured vessel energy. CodeCarbon measures only
computer energy/emissions and is reported separately.

## Experiment matrix

Three deterministic route pairs across ten consecutive 00Z cycles produce 30
paired cases. Report path length, time, modelled energy, minimum depth, mean
current, runtime, and compute emissions when explicitly enabled. Use paired
differences and deterministic bootstrap confidence intervals. Preserve null and
adverse outcomes.

## Deferred work

WAVEWATCH III, uncertainty propagation, real-platform calibration, and learned
costs require new versioned scenarios and must not be backfilled into v1.
