from __future__ import annotations

from dataclasses import dataclass
from math import hypot

import numpy as np

from aquanavai.processing.grid import GridSpec


@dataclass
class GridEnvironment:
    grid: GridSpec
    feasible: np.ndarray
    depth_m: np.ndarray
    current_east_mps: np.ndarray
    current_north_mps: np.ndarray

    def __post_init__(self) -> None:
        expected = (self.grid.height, self.grid.width)
        if self.feasible.shape != expected or self.depth_m.shape != expected:
            raise ValueError(f"Grid arrays must have shape {expected}")
        if self.current_east_mps.shape != self.current_north_mps.shape:
            raise ValueError("Current component shapes must match")
        if self.current_east_mps.shape[1:] != expected:
            raise ValueError("Current arrays must have shape (time, height, width)")

    @property
    def forecast_bins(self) -> int:
        return int(self.current_east_mps.shape[0])

    def neighbors(self, node: int) -> list[tuple[int, float, float, float]]:
        row, column = self.grid.cell(node)
        results: list[tuple[int, float, float, float]] = []
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            rr, cc = row + dr, column + dc
            if 0 <= rr < self.grid.height and 0 <= cc < self.grid.width and self.feasible[rr, cc]:
                distance = self.grid.resolution_m * hypot(dr, dc)
                norm = hypot(dr, dc)
                results.append((self.grid.node(rr, cc), distance, dc / norm, dr / norm))
        return results

    def current(self, time_bin: int, node: int) -> tuple[float, float]:
        if time_bin < 0 or time_bin >= self.forecast_bins:
            raise IndexError("Route exceeds the pinned forecast horizon")
        row, column = self.grid.cell(node)
        return (
            float(self.current_east_mps[time_bin, row, column]),
            float(self.current_north_mps[time_bin, row, column]),
        )

    def coordinate(self, node: int) -> tuple[float, float]:
        return self.grid.coordinate(*self.grid.cell(node))

    def minimum_depth(self, path: list[int]) -> float:
        return min(float(self.depth_m[self.grid.cell(node)]) for node in path)
