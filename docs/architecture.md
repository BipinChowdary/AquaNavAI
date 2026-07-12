# Architecture

## Boundary

The Python engine is the research system of record. It downloads only through
an explicit command, normalizes local source snapshots, computes routes and
metrics, and exports immutable browser artifacts. Cloudflare Pages serves only
the React build and those artifacts.

The web application performs no route optimization and has no API keys. It
validates `manifest.json` against `public/schemas/scenario.schema.json`, then
loads same-origin GeoJSON, metrics, provenance, and bathymetry assets.

## Data flow

1. An explicit acquisition records source URL, retrieval time, checksum,
   variable/units, subset, CRS, vertical datum, and citation.
2. Processing creates an EPSG:32617 analysis grid while retaining native source
   resolution in metadata.
3. Distance Dijkstra and time-expanded environmental A* share one feasibility
   graph and mission definition.
4. Evaluation writes experiment artifacts outside the public tree.
5. A reviewed release exports only bounded, checksummed web products.

The current proxy generator follows the same path but never claims NOAA source
status.
