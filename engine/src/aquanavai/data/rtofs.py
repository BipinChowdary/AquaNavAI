from __future__ import annotations

from pathlib import Path

import numpy as np
import xarray as xr


def open_surface_currents(path: Path) -> xr.Dataset:
    """Open a pinned RTOFS NetCDF and normalize surface-current variable names."""
    dataset = xr.open_dataset(path, engine="h5netcdf")
    aliases = {
        "u": ("u", "u_velocity", "water_u", "u_velocity_surface"),
        "v": ("v", "v_velocity", "water_v", "v_velocity_surface"),
    }
    selected: dict[str, xr.DataArray] = {}
    for target, options in aliases.items():
        for option in options:
            if option in dataset:
                selected[target] = dataset[option]
                break
        if target not in selected:
            raise ValueError(f"RTOFS dataset has no recognized {target}-current variable")
    normalized = xr.Dataset(selected)
    for name in ("u", "v"):
        values = normalized[name].values
        if not np.isfinite(values).any():
            raise ValueError(f"RTOFS {name}-current contains no finite values")
        units = str(normalized[name].attrs.get("units", "")).lower()
        if units not in {"m/s", "m s-1", "meter second-1", "meters per second"}:
            raise ValueError(f"Unexpected RTOFS current units for {name}: {units or 'missing'}")
    return normalized
