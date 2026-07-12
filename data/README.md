# Data boundary

`raw/`, `cache/`, and `processed/` are local and ignored. Small, immutable,
browser-ready releases are generated under `public/scenarios/` and include
checksums and provenance.

Network access is restricted to `aquanav data fetch`. No other engine or web
command may silently refresh a source. The current `south-florida-v1` catalog is
deliberately in proxy mode until exact NOAA subset URLs, cycles, and checksums
are reviewed and pinned.
