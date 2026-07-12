from __future__ import annotations

import numpy as np


def paired_bootstrap_interval(
    baseline: list[float],
    treatment: list[float],
    confidence: float = 0.95,
    resamples: int = 5000,
    seed: int = 20260712,
) -> tuple[float, float, float]:
    if len(baseline) != len(treatment) or not baseline:
        raise ValueError("Paired samples must be non-empty and the same length")
    differences = np.asarray(treatment) - np.asarray(baseline)
    generator = np.random.default_rng(seed)
    samples = generator.choice(differences, size=(resamples, len(differences)), replace=True).mean(
        axis=1
    )
    alpha = 1 - confidence
    low, high = np.quantile(samples, [alpha / 2, 1 - alpha / 2])
    return float(differences.mean()), float(low), float(high)
