# Architecture

## Trust and deployment boundary

The Python engine is the research system of record. It validates catalogued NOAA files, harmonizes them onto one analysis grid, computes released routes, and exports immutable artifacts. Cloudflare Pages serves only the React build and processed artifacts. There is no v2 backend.

The browser validates the manifest contract once, loads only same-origin data, and recomputes four routes in one persistent Web Worker. The worker has a ready handshake, unique request IDs, correlated replies, explicit timeouts, surfaced errors, and safe supersession. The grid is decoded once per scenario version.

## Data and route flow

1. `data/catalog.yaml` records exact source URLs, timestamps, checksums, units, missing values, transformations, and limitations.
2. Raw downloads remain under ignored `data/raw/south-florida-noaa-v1/`.
3. CUDEM elevation and RTOFS east/north currents are reprojected to a 500 m EPSG:32617 grid.
4. All arrays are flipped together from raster north-up storage into the graph convention; tests protect vector and row orientation.
5. CUDEM depth >= 5 m plus the documented invalid/shallow buffer defines feasibility.
6. Distance Dijkstra and time-expanded fastest, energy, and balanced searches share the graph, endpoints, vehicle, constraints, and forecast horizon.
7. Checksummed GeoJSON, imagery, metrics, grid, provenance, and manifest artifacts are released under `public/scenarios/`.

The energy result is a modelled proxy, not measured vessel energy. Balanced weights are time 0.35, modelled energy 0.35, current exposure 0.15, and shallow-water context 0.15; every component is normalized to a fixed 500 m reference step before mission-wide summation. Full planner-node geometry is retained; no decorative spline is generated.

## UI lifecycle

Initialization uses `loading_manifest`, `loading_artifacts`, `validating`, `initializing_worker`, `initializing_map`, `ready`, and recoverable `error` states. Map endpoint changes are local mission state and cannot re-enter global validation. The ASV animation uses one `requestAnimationFrame` controller, distance-based interpolation, an imperative MapLibre marker, and throttled React status updates.
