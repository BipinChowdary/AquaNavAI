# Navigation V2 benchmark-first research design

## Question and objectives

For identical South Florida coastal missions and departure times, how do four defensible objectives change route length, travel time, modelled propulsion energy, and environmental context?

- **Shortest Distance:** Dijkstra minimizes valid eight-neighbour grid distance.
- **Fastest Arrival:** time-expanded current-aware search minimizes travel time.
- **Lowest Modelled Energy:** time-expanded search minimizes the documented reference-vessel energy proxy.
- **Balanced Mission:** time (0.35), modelled energy (0.35), current exposure (0.15), and shallow-water context (0.15), normalized to a fixed 500 m reference step before summation.

All objectives use the same 500 m graph, endpoints, mask, departure, vehicle, and forecast horizon. Waiting and forecast extrapolation are disabled. Failure is explicit when current or forecast constraints make a route infeasible. Two objectives may legitimately overlap.

## Vehicle proxy

- Through-water speed: 1.5 m/s.
- Hotel power: 30 W.
- Propulsion power: `44.44 × v³ W`, approximately 150 W at cruise.

This is modelled energy, not measured vessel energy. CodeCarbon measures computer energy/emissions only and remains separate.

## Experiment matrix

Three deterministic route pairs over ten departure times produce 30 four-objective cases and 120 route records. Report distance, time, modelled energy, minimum depth, mean current, normalized risk context, runtime, and compute emissions when enabled. Preserve null and adverse outcomes.

## Geometry policy

The release retains every planner node. The 500 m orthogonal and approximately 707 m diagonal segments are already collision-checked graph edges. No spline or decorative curve is applied because it could enter invalid cells or change objective cost. Animation interpolates along this exact polyline by cumulative geodesic distance.

## Deferred work

Pinned ENC constraints, cycle-aligned wave forcing, uncertainty propagation, platform calibration, and learned costs require new versioned evidence. A learned model is not claimed in Navigation V2.
