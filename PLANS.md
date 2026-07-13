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
