# Reproducibility

Toolchains are pinned by `.node-version`, `.python-version`, `package-lock.json`,
and `engine/uv.lock`. A clean environment must use `npm ci` and `uv sync
--frozen`.

The offline exporter is deterministic: release timestamps, forecast identifiers,
algorithm tie-breaking, JSON key order, and proxy fields are fixed. Runtime
measurements are excluded from the immutable fixture and belong in ignored
experiment artifacts.

Reproduction fails rather than contacting NOAA. Network use requires the
separate `data fetch` command. CI validates frontend types/lint/tests/build,
asset limits, Python lint/tests, JSON Schema contracts, dependency audits, and a
browser run with external requests blocked.
