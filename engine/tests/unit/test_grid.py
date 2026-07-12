from aquanavai.processing.grid import GridSpec


def test_grid_coordinate_round_trip() -> None:
    grid = GridSpec.from_bbox((-80.2, 26.0, -79.9, 26.55), 500)
    cell = grid.nearest_cell((-80.05, 26.25))
    longitude, latitude = grid.coordinate(*cell)
    assert abs(longitude + 80.05) < 0.01
    assert abs(latitude - 26.25) < 0.01
    assert grid.cell(grid.node(*cell)) == cell
