from __future__ import annotations

import numpy as np
from scipy.ndimage import binary_dilation


def feasible_water_mask(
    depth_m: np.ndarray,
    minimum_depth_m: float,
    resolution_m: float,
    land_buffer_m: float,
) -> np.ndarray:
    valid_water = np.isfinite(depth_m) & (depth_m >= minimum_depth_m)
    blocked = ~valid_water
    buffer_cells = int(np.ceil(land_buffer_m / resolution_m))
    if buffer_cells > 0:
        blocked = binary_dilation(blocked, iterations=buffer_cells)
    return ~blocked


def snap_to_feasible(mask: np.ndarray, row: int, column: int) -> tuple[int, int]:
    if mask[row, column]:
        return row, column
    candidates = np.argwhere(mask)
    if not candidates.size:
        raise ValueError("Feasibility mask contains no navigable cells")
    distances = np.square(candidates[:, 0] - row) + np.square(candidates[:, 1] - column)
    best = candidates[int(np.argmin(distances))]
    return int(best[0]), int(best[1])
