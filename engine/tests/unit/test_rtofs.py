import numpy as np
import pytest
import xarray as xr

from aquanavai.data.rtofs import open_surface_currents


def test_rtofs_surface_current_aliases_are_normalized(tmp_path) -> None:
    path = tmp_path / "rtofs.nc"
    dataset = xr.Dataset(
        {
            "water_u": (("time", "y", "x"), np.ones((1, 2, 2))),
            "water_v": (("time", "y", "x"), np.zeros((1, 2, 2))),
        }
    )
    dataset["water_u"].attrs["units"] = "m/s"
    dataset["water_v"].attrs["units"] = "m/s"
    dataset.to_netcdf(path, engine="h5netcdf")
    normalized = open_surface_currents(path)
    assert set(normalized.data_vars) == {"u", "v"}


def test_rtofs_requires_explicit_units(tmp_path) -> None:
    path = tmp_path / "invalid.nc"
    xr.Dataset(
        {
            "u": (("time", "y", "x"), np.ones((1, 1, 1))),
            "v": (("time", "y", "x"), np.ones((1, 1, 1))),
        }
    ).to_netcdf(path, engine="h5netcdf")
    with pytest.raises(ValueError, match="units"):
        open_surface_currents(path)
