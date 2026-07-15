# Implementation record and forward plan

## Baseline at 63e79a4

On 2026-07-12 the proxy baseline passed TypeScript, ESLint, Vite, 16 Python tests, strict mypy, Ruff, and two Chromium tests. The prior Cloudflare blank page was a dashboard configuration error: no build command was configured.

## NOAA navigation v1

- [x] Preserve and audit the proxy fixture.
- [x] Pin and checksum CUDEM, RTOFS, and NDBC inputs.
- [x] Build a 500 m EPSG:32617 South Florida navigation grid.
- [x] Correct and test raster/graph north-axis orientation.
- [x] Release precomputed Dijkstra and environmental A* results for ten departures.
- [x] Add same-contract browser routing in a Web Worker and animated ASV controls.
- [x] Make the NOAA scenario the release-index default.
- [ ] Obtain calibrated simulator or platform labels before any learned production cost.
- [ ] Add a cycle-aligned authoritative WAVEWATCH III field and uncertainty study.
- [ ] Validate the propulsion proxy against a named ASV or high-fidelity simulator.

No learned model was added: a regressor trained only to imitate the current formula would not add scientific evidence and could confuse the provenance boundary.

## Navigation V2

- [x] Preserve deployed Navigation V1 at annotated tag `pre-navigation-v2`.
- [x] Replace ad hoc loading booleans with explicit initialization and recoverable error stages.
- [x] Initialize one persistent routing worker with correlated requests, timeouts, surfaced errors, and safe supersession.
- [x] Implement shortest, fastest, lowest-modelled-energy, and balanced objectives in TypeScript and Python.
- [x] Regenerate the pinned NOAA release as 30 cases / 120 route records.
- [x] Retain full planner geometry and document the decision not to apply unsafe decorative smoothing.
- [x] Animate an imperative MapLibre ASV marker along cumulative geodesic distance with a matching progress trail.
- [x] Add browser assertions for geographic/pixel movement, pause/resume/reset/seek, custom clicks, invalid points, rapid requests, hard reload, route/cycle switching, offline networking, and mobile layout.
- [x] Audit NOAA ENC/ENC Direct to GIS as a future chart-constraint source without implying that unpinned ENC hazards are already integrated.
- [ ] Merge to `main` only after the user approves the verified Cloudflare preview.
