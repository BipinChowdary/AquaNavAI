# ADR 0002: Benchmark before learning

**Status:** accepted

Distance Dijkstra and physics-informed environmental A* are implemented and
evaluated before any learned cost. A learned model requires defensible simulator
or platform labels, grouped train/validation/test splits, and comparison against
both baselines. Until then AquaNavAI describes its contribution as forecast-aware
route optimization, not learned AI.
