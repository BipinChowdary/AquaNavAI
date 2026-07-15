# Experiment plan

## Question

For identical feasible missions and forecast departures, how does a time-expanded energy-proxy A* route differ from the shortest feasible Dijkstra route under NOAA RTOFS surface currents?

## Controlled design

- Three deterministic northbound shelf missions.
- Ten consecutive hourly departures from 2026-07-12T01:00Z through 10:00Z.
- One 500 m, eight-neighbour graph and one CUDEM-derived feasibility mask.
- Reference ASV through-water speed 1.5 m/s, hotel power 30 W, propulsion proxy `P = 44.44 v^3 W`.
- Waiting disabled; an edge fails when cross-current cannot be countered or forward ground speed is nonpositive.

Report paired route length, travel time, modelled energy, minimum depth, current exposure, failure reason, and browser runtime. Preserve null or adverse outcomes. The current pinned cycle produces only modest energy differences; this is evidence about the scenario, not proof of general superiority.

## Next necessary experiment

Calibrate the energy model using a named ASV simulator or instrumented platform, repeat across grouped forecast cycles/seasons, add grid-resolution and vehicle-parameter sensitivity, and quantify forecast uncertainty. Only then consider a learned surrogate with route/cycle-grouped splits.
