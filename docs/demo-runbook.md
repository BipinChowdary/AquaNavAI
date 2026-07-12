# Professor demonstration runbook

1. Before travel, run `npm ci`, `uv sync --frozen --project engine`, `npm run
   check`, and `npm run test:e2e`.
2. Rebuild and verify the pinned artifact with `uv run --project engine aquanav
   reproduce --scenario south-florida-v1 --offline`.
3. Start `npm run dev -- --host 127.0.0.1` and open
   `http://127.0.0.1:5173`.
4. Begin with the research-only warning and proxy-data status.
5. Compare the distance and environmental routes over mission pairs and cycles.
6. Open provenance and explain the static-web/local-engine boundary.
7. For a technical deep dive, show the common graph, energy proxy, 30 paired
   cases, deterministic tests, and deferred learned-model gate.

Never describe the proxy fixture as a NOAA result or the route as safe.
