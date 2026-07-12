import numpy as np

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.processing.grid import GridSpec
from aquanavai.routing.environmental_astar import environmental_astar
from aquanavai.routing.graph import GridEnvironment
from aquanavai.routing.shortest_path import shortest_path


def test_zero_current_environmental_search_matches_distance_baseline() -> None:
    grid = GridSpec((-80.0, 26.0, -79.9, 26.1), 500, width=5, height=5)
    feasible = np.ones((5, 5), dtype=bool)
    depth = np.full((5, 5), 20.0)
    current = np.zeros((12, 5, 5))
    environment = GridEnvironment(grid, feasible, depth, current, current.copy())
    start, goal = grid.node(0, 0), grid.node(4, 4)
    distance = shortest_path(environment, start, goal)
    environmental = environmental_astar(environment, start, goal, VehicleModel(1.5, 30, 44.44))
    assert environmental.nodes == distance.nodes


def test_search_never_crosses_blocked_cells() -> None:
    grid = GridSpec((-80.0, 26.0, -79.9, 26.1), 500, width=5, height=5)
    feasible = np.ones((5, 5), dtype=bool)
    feasible[2, 1:4] = False
    current = np.zeros((12, 5, 5))
    environment = GridEnvironment(grid, feasible, np.full((5, 5), 20.0), current, current.copy())
    result = shortest_path(environment, grid.node(0, 2), grid.node(4, 2))
    assert all(feasible[grid.cell(node)] for node in result.nodes)
