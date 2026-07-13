# Navigation V2 verification record

Date: 2026-07-13 UTC

## Preserved baseline

- Exact deployed Navigation V1 source: `763c292d3f9a8aa69399be4a0e1694bda91da128`.
- Annotated rollback tag: `pre-navigation-v2`.
- Work branch: `fix/navigation-v2`, created from that exact source.
- `main` was not modified or merged during verification.

The V1 failure was reproduced on the exact static build, Vite development server, and prior Cloudflare preview. A first map click replaced the application with the global validation screen. Playback advanced a roughly five-hour simulated transit at only 5× real time, so the marker appeared stationary during a normal demonstration.

## Root causes and corrections

1. **Infinite validation state:** the first endpoint click changed `pairId` to `custom` and cleared routes. `selectedMetrics` became null, and the top-level render treated missing mission metrics as missing scenario validation. Navigation V2 separates global initialization from mission/route state; map clicks cannot change the initialization state.
2. **Missing visible movement:** the previous animation used model transit seconds as wall-clock duration, suppressed explicit playback under reduced-motion preferences, and wrote React state every frame. V2 uses a 22-second 1× demonstration duration, one `requestAnimationFrame` loop, cumulative geodesic-distance interpolation, an imperative MapLibre marker, and 100 ms UI snapshots.
3. **Invisible/unstable marker:** the vessel was a GeoJSON text layer updated together with routes, currents, mission points, and `fitBounds` on every frame. V2 uses a 42 px HTML marker above the map layers, a matching traversed-route layer, ResizeObserver-backed map sizing, and explicit selected-route fitting.
4. **Worker lifecycle:** V1 cloned and decoded the full 1.79 MB grid into a new worker for every request and had no ready handshake, timeout, or supersession protocol. V2 decodes once in a persistent worker, correlates unique request IDs, times out initialization/routes, surfaces worker/message errors, and rejects superseded requests safely.
5. **Route contract:** the previous browser and release exposed only distance and energy routes. V2 exports and recomputes shortest, fastest, lowest-modelled-energy, and balanced routes. Fastest, energy, and balanced may overlap under this pinned case; the UI explains this rather than manufacturing a visual difference.
6. **Geometry concern:** V1 did retain intermediate 500 m grid nodes; it was not exporting only endpoints. The straight appearance came from coarse resolution, shelf-aligned missions, and overlapping objectives. V2 retains every raw planner node (85 points in the first released case) and deliberately applies no spline or decorative smoothing that could cross an invalid cell or change objective cost.

No service worker exists, so there is no cross-version cache capable of combining old scenario chunks with a new manifest.

## Four objectives

- Shortest Distance: distance-only eight-neighbour Dijkstra.
- Fastest Arrival: time-expanded current-aware minimum travel time.
- Lowest Modelled Energy: time-expanded minimum reference-vessel energy proxy.
- Balanced Mission: normalized time 0.35, modelled energy 0.35, current exposure 0.15, and shallow-water context 0.15.

All four use identical endpoints, forecast field, feasibility mask, graph, vehicle, and forecast limits. Every released route has more than two coordinates and deterministic reference tests. The release contains 30 mission/departure cases and 120 route records.

## NOAA provenance audit

- CUDEM: five pinned Florida 1/9-arc-second tiles; retrieved 2026-07-12 23:51:13 UTC; source and processed SHA-256 values are in `data/catalog.yaml`.
- RTOFS: `rtofs_glo.t00z.f024_west_atl_std.grb2`, 2026-07-12 00Z cycle; retrieved 2026-07-12 23:47:38 UTC; surface U/V fields are model output.
- NDBC: stations 41122 and LKWF1; retrieved 2026-07-12 23:50:47 UTC; observations are context only.
- NOAA ENC/ENC Direct to GIS: audited on 2026-07-13 as a future chart-constraint source. No unpinned ENC feature changes the V2 mask, and the release does not claim charted hazard/restriction avoidance.
- WAVEWATCH III: deferred; no wave value enters V2 routing.

The human-readable and JSON provenance artifacts separate direct NOAA records, transformations, vessel assumptions, modelled quantities, and planner outputs. The research-only navigation disclaimer remains visible. The released manifest version is `2.0.0`; the Navigation V1 artifact remains recoverable from the backup tag.

## Measured local production behavior

On a clean Chromium load of the local static `dist` build:

- first map: 247 ms; application ready: 304 ms; first four routes: 386 ms (cold measurement),
- worker grid decode: 51–54 ms,
- ASV start: `[-80.0653458, 25.6011372]`, rendered at `(835, 797)`,
- after 5.5 seconds at 1×: `[-80.0397387, 25.6906936]`, 25.00%, rendered at `(870, 662)`,
- rendered displacement: 139.46 px,
- pause interval: progress remained exactly `0.2508` for 800 ms.

The browser suite additionally seeks to 25%, 50%, and 100%; verifies reset to origin; checks custom start/destination routing, invalid-land feedback, rapid superseding clicks, route/mission/cycle changes, hard reload, mobile layout, blocked external networking, and console/page/network errors.

## Release artifact measurement

- `dist`: 26 files, 4,549,430 bytes total.
- NOAA scenario: 10 files, 2,783,346 bytes raw; 254,202 bytes summed gzip.
- Largest asset: `navigation-grid.json`, 1,791,344 bytes.
- Cloudflare Pages comparison: 26 files versus 20,000; 1.71 MiB largest versus 25 MiB.
- No R2, Worker, KV, database, runtime Python service, localhost dependency, local user path, or secret is required.

## Final local release gate

- `npm ci`: passed; npm audit reported 0 vulnerabilities.
- `uv sync --frozen --project engine --python 3.12.13`: passed.
- TypeScript, ESLint, Vitest, Vite production build, and public-asset checks: passed (6 unit/component tests).
- Ruff and strict mypy: passed.
- Pytest: 21 passed.
- pip-audit: no known third-party vulnerabilities; the local editable package is not on PyPI and is skipped as expected.
- NOAA manifest/artifact checksum validation: 9 artifacts passed.
- Playwright Chromium production behavior suite: 2 passed, including offline desktop and mobile flows.

## Remaining scientific limits

This is still a 500 m research grid using CUDEM feasibility and one pinned RTOFS forecast product. It excludes chart-derived ENC hazards/restrictions, tides, traffic, collision avoidance, waves, uncertainty propagation, and calibrated vessel energy. Balanced risk is contextual and is not an operational safety score. No learned model is claimed.
