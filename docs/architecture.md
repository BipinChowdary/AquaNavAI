# Architecture

## Trust and deployment boundary

The Python engine is the research system of record. It acquires and validates explicitly catalogued NOAA files, harmonizes them onto one analysis grid, computes release routes, and exports immutable artifacts. Cloudflare Pages serves only the React build and those processed artifacts.

The browser validates the manifest contract, loads same-origin data, and can recompute two routes in a Web Worker without a Python server. The worker consumes the exact quantized grid exported by Python: uint8 feasibility, decimetre depth, centimetre-per-second signed currents, and float32 WGS84 cell coordinates.

## Data flow

1. `data/catalog.yaml` identifies exact URLs, source timestamps, checksums, units, missing values, and limitations.
2. The build verifies or retrieves immutable raw files under ignored `data/raw/south-florida-noaa-v1/`.
3. CUDEM NAD83 elevation and RTOFS vector components are independently reprojected to a 500 m EPSG:32617 grid.
4. Raster rows are flipped together for the graph convention that increasing row is north; a test protects this convention.
5. CUDEM depth ≥5 m plus a one-cell exclusion around invalid/shallow cells defines feasibility.
6. Dijkstra and time-expanded environmental A* share this graph, vehicle, endpoints, and forecast horizon.
7. Checksummed GeoJSON, imagery, metrics, grid, provenance, and manifest artifacts are published under `public/scenarios/`.

The environmental objective is a physics-inspired modelled-energy proxy. Browser compute time is measured locally; released static metrics omit nondeterministic timing to preserve artifact reproducibility.
