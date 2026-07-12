import numpy as np

from aquanavai.processing.mask import feasible_water_mask, snap_to_feasible


def test_depth_and_land_buffer_create_conservative_mask() -> None:
    depth = np.full((5, 5), 10.0)
    depth[2, 2] = 0.0
    mask = feasible_water_mask(depth, 5.0, resolution_m=500, land_buffer_m=250)
    assert not mask[2, 2]
    assert not mask[2, 1]
    assert mask[0, 0]


def test_snap_finds_nearest_feasible_cell() -> None:
    mask = np.zeros((3, 3), dtype=bool)
    mask[2, 2] = True
    assert snap_to_feasible(mask, 0, 0) == (2, 2)
