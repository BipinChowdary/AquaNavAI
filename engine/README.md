# AquaNavAI research engine

The engine owns data acquisition, provenance, environmental harmonization,
routing, evaluation, and static web export. The deployed application never
executes Python and never contacts NOAA at runtime.

```powershell
uv sync --project engine
uv run --project engine aquanav reproduce --scenario south-florida-v1 --offline
uv run --project engine pytest
```

`data fetch` is the only command authorized to use the network. The bundled
`south-florida-v1` artifacts are currently an explicitly labelled deterministic
proxy fixture until checksummed NOAA subsets are pinned through that command.
