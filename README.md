# AquaNavAI

Forecast-aware coastal route-planning research for autonomous surface vehicles,
with a reproducible Python engine and a professor-ready offline web
demonstration.

> **Research demonstration only.** AquaNavAI is not for navigation, collision
> avoidance, vessel control, or operational mission planning.

## Current release

The software architecture, routing baselines, experiment contract, static
exporter, tests, and MapLibre interface are implemented. The bundled
`south-florida-v1` scenario is an explicitly labelled deterministic proxy used
to verify the complete offline workflow. It is not yet a NOAA-derived research
result. Exact CUDEM, ETOPO, RTOFS, and NDBC subsets must be checksummed and
pinned before scientific claims are made.

## Architecture

- `src/` — React, TypeScript, MapLibre, and artifact-contract validation.
- `engine/` — uv-managed Python 3.12 package for acquisition, routing,
  evaluation, CodeCarbon tracking, and static export.
- `public/scenarios/` — immutable, same-origin browser artifacts; no live APIs.
- `data/` — source catalog; raw/cache/processed data remain ignored.
- `docs/` — architecture, research design, provenance, reproducibility, IP, and
  demo/deployment runbooks.

The deployed Cloudflare Pages site is static. Python is local-only.

## Quick start

```powershell
npm ci
uv sync --frozen --project engine --python 3.12.13
uv run --project engine aquanav reproduce --scenario south-florida-v1 --offline
npm run dev
```

Open `http://localhost:5173` while the development server is running.

## Verification

```powershell
npm run check
uv run --project engine ruff check engine/src engine/tests
uv run --project engine pytest
npm run test:e2e
```

## Research commands

```powershell
uv run --project engine aquanav route --scenario south-florida-v1 --algorithm distance
uv run --project engine aquanav route --scenario south-florida-v1 --algorithm environmental
uv run --project engine aquanav evaluate --scenario south-florida-v1
uv run --project engine aquanav export-web --scenario south-florida-v1
```

Only `aquanav data fetch` may access remote sources. It intentionally refuses to
run while `data/catalog.yaml` remains in proxy mode.

## Disclosure status

The repository is private and intentionally has no open-source license pending
research and IP review. See `SECURITY.md` and `docs/disclosure-register.md`.
