from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds


def read_cudem_subset(
    path: Path, bbox: tuple[float, float, float, float]
) -> tuple[np.ndarray, dict[str, object]]:
    """Read a WGS84 CUDEM GeoTIFF subset without changing its native resolution."""
    with rasterio.open(path) as dataset:
        if dataset.crs is None:
            raise ValueError("CUDEM raster has no CRS")
        window = from_bounds(*bbox, transform=dataset.transform).round_offsets().round_lengths()
        values = dataset.read(1, window=window, masked=True).astype("float64")
        metadata = {
            "crs": dataset.crs.to_string(),
            "transform": tuple(dataset.window_transform(window))[:6],
            "nodata": dataset.nodata,
            "shape": list(values.shape),
        }
    if values.size == 0 or np.ma.getmaskarray(values).all():
        raise ValueError("CUDEM subset contains no valid cells")
    return values.filled(np.nan), metadata


def depth_from_elevation(elevation_m: np.ndarray) -> np.ndarray:
    """Convert signed elevation to positive water depth while preserving NoData."""
    return np.where(np.isfinite(elevation_m), np.maximum(-elevation_m, 0.0), np.nan)
