import numpy as np

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.processing.grid import GridSpec
from aquanavai.routing.environmental_astar import environmental_astar
from aquanavai.routing.graph import GridEnvironment
from aquanavai.routing.objective_astar import objective_astar
from aquanavai.routing.shortest_path import shortest_path


def test_zero_current_environmental_search_matches_distance_baseline() -> None:
    grid = GridSpec((-80.0, 26.0, -79.9, 26.1), 500, width=5, height=5)
    feasible = np.ones((5, 5), dtype=bool)
    depth = np.full((5, 5), 20.0)
    current = np.zeros((12, 5, 5))
    environment = GridEnvironment(grid, feasible, depth, current, current.copy())
    start, goal = grid.node(0, 0), grid.node(4, 4)
    distance = shortest_path(environment, start, goal)
    vehicle = VehicleModel(1.5, 30, 44.44)
    environmental = environmental_astar(environment, start, goal, vehicle)
    assert environmental.nodes == distance.nodes
    for objective in ("fastest", "energy", "balanced"):
        assert objective_astar(environment, start, goal, vehicle, objective).nodes == distance.nodes


def test_search_never_crosses_blocked_cells() -> None:
    grid = GridSpec((-80.0, 26.0, -79.9, 26.1), 500, width=5, height=5)
    feasible = np.ones((5, 5), dtype=bool)
    feasible[2, 1:4] = False
    current = np.zeros((12, 5, 5))
    environment = GridEnvironment(grid, feasible, np.full((5, 5), 20.0), current, current.copy())
    result = shortest_path(environment, grid.node(0, 2), grid.node(4, 2))
    assert all(feasible[grid.cell(node)] for node in result.nodes)


def test_navigation_v2_objectives_are_deterministic_and_feasible() -> None:
    grid = GridSpec((-80.0, 26.0, -79.9, 26.1), 500, width=7, height=7)
    feasible = np.ones((7, 7), dtype=bool)
    feasible[3, 1:6] = False
    depth = np.full((7, 7), 25.0)
    depth[:, 1] = 7.0
    east = np.zeros((24, 7, 7))
    north = np.zeros_like(east)
    north[:, :, 4:] = 0.35
    environment = GridEnvironment(grid, feasible, depth, east, north)
    vehicle = VehicleModel(1.5, 30, 44.44)
    start, goal = grid.node(0, 3), grid.node(6, 3)
    for objective in ("fastest", "energy", "balanced"):
        first = objective_astar(environment, start, goal, vehicle, objective)
        second = objective_astar(environment, start, goal, vehicle, objective)
        assert first.nodes == second.nodes
        assert len(first.nodes) > 2
        assert all(feasible[grid.cell(node)] for node in first.nodes)
        assert 0 <= first.risk_score <= 1
