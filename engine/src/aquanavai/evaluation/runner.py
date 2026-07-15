from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import pi
from time import perf_counter

import numpy as np

from aquanavai.config import ScenarioConfig, VehicleConfig
from aquanavai.energy.vehicle import VehicleModel
from aquanavai.processing.grid import GridSpec
from aquanavai.processing.mask import feasible_water_mask, snap_to_feasible
from aquanavai.routing.graph import GridEnvironment
from aquanavai.routing.objective_astar import RouteObjective, objective_astar
from aquanavai.routing.shortest_path import shortest_path
from aquanavai.schemas import RouteResult

DISCLAIMER = (
    "Research demonstration only; not for navigation, collision avoidance, "
    "or operational mission planning."
)


@dataclass
class EvaluationBundle:
    results: list[RouteResult]
    environment: GridEnvironment
    primary_paths: dict[str, list[int]]
    forecast_cycles: list[str]


def forecast_cycles() -> list[str]:
    start = datetime(2026, 7, 3, tzinfo=UTC)
    return [(start + timedelta(days=index)).strftime("%Y-%m-%dT00:00:00Z") for index in range(10)]


def build_proxy_environment(config: ScenarioConfig, cycle_index: int = 0) -> GridEnvironment:
    """Build a deterministic, visibly labelled fixture for offline integration testing."""
    grid = GridSpec.from_bbox(config.bbox, config.grid_resolution_m)
    longitudes = np.empty((grid.height, grid.width), dtype=float)
    latitudes = np.empty_like(longitudes)
    for row in range(grid.height):
        for column in range(grid.width):
            longitudes[row, column], latitudes[row, column] = grid.coordinate(row, column)

    coast = -80.085 + 0.006 * np.sin((latitudes - 26.0) * 6 * pi)
    offshore_degrees = longitudes - coast
    depth = np.where(offshore_degrees > 0, 2.0 + offshore_degrees * 720.0, 0.0)
    depth += np.where(offshore_degrees > 0, 1.4 * np.sin(latitudes * 31), 0.0)
    feasible = feasible_water_mask(
        depth,
        config.minimum_depth_m,
        config.grid_resolution_m,
        config.land_buffer_m,
    )

    time_bins = 48
    east = np.empty((time_bins, grid.height, grid.width), dtype=float)
    north = np.empty_like(east)
    offshore_factor = np.clip((offshore_degrees - 0.015) / 0.16, 0.0, 1.0)
    for time_bin in range(time_bins):
        phase = 2 * pi * (time_bin / 12 + cycle_index / 10)
        east[time_bin] = 0.05 * np.sin(phase + latitudes * 7) * offshore_factor
        north[time_bin] = (0.10 + 0.42 * offshore_factor) * (0.90 + 0.10 * np.sin(phase))
    east[:, ~feasible] = 0.0
    north[:, ~feasible] = 0.0
    return GridEnvironment(grid, feasible, depth, east, north)


def _nodes_for_pair(
    environment: GridEnvironment, start: tuple[float, float], goal: tuple[float, float]
) -> tuple[int, int]:
    start_cell = snap_to_feasible(environment.feasible, *environment.grid.nearest_cell(start))
    goal_cell = snap_to_feasible(environment.feasible, *environment.grid.nearest_cell(goal))
    return environment.grid.node(*start_cell), environment.grid.node(*goal_cell)


def evaluate_scenario(
    scenario: ScenarioConfig,
    vehicle_config: VehicleConfig,
    all_cycles: bool = True,
) -> EvaluationBundle:
    vehicle = VehicleModel.from_config(vehicle_config)
    cycles = forecast_cycles() if all_cycles else forecast_cycles()[:1]
    results: list[RouteResult] = []
    primary_paths: dict[str, list[int]] = {}
    primary_environment: GridEnvironment | None = None

    for cycle_index, cycle in enumerate(cycles):
        environment = build_proxy_environment(scenario, cycle_index)
        if primary_environment is None:
            primary_environment = environment
        departure = datetime.fromisoformat(cycle.replace("Z", "+00:00"))
        for pair in scenario.route_pairs:
            start, goal = _nodes_for_pair(environment, pair.start, pair.goal)
            from aquanavai.evaluation.metrics import evaluate_path

            started = perf_counter()
            distance_path = shortest_path(environment, start, goal)
            distance_elapsed = (perf_counter() - started) * 1000
            distance_metrics = evaluate_path(environment, distance_path.nodes, vehicle)
            shortest_risk = min(
                1.0,
                0.6 * distance_metrics.mean_current_mps / vehicle.cruise_speed_mps
                + 0.4
                * max(0.0, min(1.0, (20.0 - distance_metrics.minimum_depth_m) / 15.0)),
            )
            results.append(
                RouteResult(
                    id=f"{cycle[:10]}-{pair.id}-shortest",
                    pair_id=pair.id,
                    algorithm="shortest",
                    forecast_cycle=cycle,
                    departure_time=departure,
                    path_length_m=distance_metrics.path_length_m,
                    travel_time_s=distance_metrics.travel_time_s,
                    modelled_propulsion_energy_wh=distance_metrics.energy_wh,
                    minimum_depth_m=distance_metrics.minimum_depth_m,
                    mean_current_mps=distance_metrics.mean_current_mps,
                    risk_score=shortest_risk,
                    compute_time_ms=distance_elapsed,
                    coordinates=[environment.coordinate(node) for node in distance_path.nodes],
                )
            )
            objective_nodes: dict[str, list[int]] = {}
            for objective in ("fastest", "energy", "balanced"):
                typed_objective: RouteObjective = objective
                started = perf_counter()
                path = objective_astar(environment, start, goal, vehicle, typed_objective)
                elapsed = (perf_counter() - started) * 1000
                metric = evaluate_path(environment, path.nodes, vehicle)
                objective_nodes[objective] = path.nodes
                results.append(
                    RouteResult(
                        id=f"{cycle[:10]}-{pair.id}-{objective}",
                        pair_id=pair.id,
                        algorithm=objective,
                        forecast_cycle=cycle,
                        departure_time=departure,
                        path_length_m=metric.path_length_m,
                        travel_time_s=path.travel_time_s,
                        modelled_propulsion_energy_wh=path.energy_wh,
                        minimum_depth_m=metric.minimum_depth_m,
                        mean_current_mps=path.mean_current_mps,
                        risk_score=path.risk_score,
                        compute_time_ms=elapsed,
                        coordinates=[environment.coordinate(node) for node in path.nodes],
                    )
                )
            if cycle_index == 0:
                primary_paths[f"{pair.id}:shortest"] = distance_path.nodes
                for objective, nodes in objective_nodes.items():
                    primary_paths[f"{pair.id}:{objective}"] = nodes

    if primary_environment is None:
        raise RuntimeError("No forecast cycles were evaluated")
    return EvaluationBundle(results, primary_environment, primary_paths, cycles)
