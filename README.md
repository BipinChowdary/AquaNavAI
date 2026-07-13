# AquaNavAI

AquaNavAI is a PhD-facing research demonstrator for forecast-aware coastal route planning for autonomous surface vehicles. It compares a distance Dijkstra baseline with an environmental-energy A* objective on the same navigability grid and runs as a static, offline-capable MapLibre application.

> **Research demonstration only.** Not for navigation, collision avoidance, vessel control, or operational mission planning.

## Verified v1 release

The default `south-florida-noaa-v1` scenario is derived from pinned official NOAA data:

- NOAA CUDEM Florida 1/9-arc-second topobathymetry (five immutable tiles) is the only v1 bathymetry and feasibility source.
- NOAA Global RTOFS 2026-07-12 00Z western Atlantic GRIB2 provides 24 hourly modelled surface-current fields; ten departure times are released.
- NDBC stations 41122 and LKWF1 provide contextual observations, not spatial current ground truth.
- WAVEWATCH III is explicitly deferred. No wave values enter v1 routing.

The deterministic `south-florida-v1` proxy remains available as a software fixture and is never represented as NOAA-derived.

## Run and verify

```powershell
npm ci
uv sync --frozen --project engine --python 3.12.13
uv run --project engine aquanav data validate --scenario south-florida-noaa-v1
npm run dev
```

Open `http://localhost:5173`. The development server must remain running.

Complete checks:

```powershell
npm run check
uv run --project engine ruff check engine/src engine/tests
uv run --project engine mypy --config-file engine/pyproject.toml engine/src
uv run --project engine pytest
uv run --project engine pip-audit
npm run test:e2e
```

## Rebuild the pinned NOAA scenario

Large raw files are ignored by Git. With the pinned cache present, the build is offline except for missing files; missing files are retrieved only from catalogued authoritative URLs and verified before use.

```powershell
uv run --project engine python -m aquanavai.pipeline.build_noaa_scenario --config data/catalog.yaml
```

The command validates source checksums, reprojects CUDEM and RTOFS, derives navigability, runs both planners, exports compact public artifacts, validates the JSON Schema, and writes a provenance report. See `data/catalog.yaml` and `public/scenarios/south-florida-noaa-v1/PROVENANCE.md`.

## Architecture

- `engine/`: Python 3.12 research engine and controlled data pipeline.
- `src/`: React/TypeScript application, browser Web Worker routing, animation, and contract validation.
- `public/scenarios/`: immutable same-origin public release artifacts.
- `data/raw/`: local immutable NOAA downloads, ignored by Git.
- `docs/`: scientific design, data, demonstration, and deployment runbooks.

The public deployment contains no Python server, raw NOAA downloads, secrets, or operational navigation logic. The repository is private and intentionally has no open-source license pending IP review.
