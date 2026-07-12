from __future__ import annotations

import numpy as np
from scipy.interpolate import RegularGridInterpolator


def interpolate_regular_grid(
    source_y: np.ndarray,
    source_x: np.ndarray,
    values: np.ndarray,
    target_y: np.ndarray,
    target_x: np.ndarray,
) -> np.ndarray:
    """Interpolate without implying that the source's information resolution increased."""
    interpolator = RegularGridInterpolator(
        (source_y, source_x), values, bounds_error=False, fill_value=np.nan
    )
    points = np.column_stack((target_y.ravel(), target_x.ravel()))
    return np.asarray(interpolator(points)).reshape(target_y.shape)
