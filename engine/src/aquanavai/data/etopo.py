from __future__ import annotations

from pathlib import Path

import xarray as xr


def open_etopo_subset(path: Path, bbox: tuple[float, float, float, float]) -> xr.DataArray:
    """Open a regional ETOPO context subset from a local NetCDF snapshot."""
    west, south, east, north = bbox
    dataset = xr.open_dataset(path)
    candidates = [name for name in ("z", "elevation", "Band1") if name in dataset]
    if not candidates:
        raise ValueError("ETOPO dataset does not expose a recognized elevation variable")
    result = dataset[candidates[0]].sel(lon=slice(west, east), lat=slice(south, north))
    if result.size == 0:
        raise ValueError("ETOPO subset is empty")
    return result
