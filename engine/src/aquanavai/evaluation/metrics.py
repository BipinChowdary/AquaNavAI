from __future__ import annotations

from dataclasses import dataclass
from itertools import pairwise
from math import hypot

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.routing.costs import environmental_edge_cost
from aquanavai.routing.graph import GridEnvironment


@dataclass(frozen=True)
class PathMetrics:
    path_length_m: float
    travel_time_s: float
    energy_wh: float
    mean_current_mps: float
    minimum_depth_m: float


def evaluate_path(
    environment: GridEnvironment,
    path: list[int],
    vehicle: VehicleModel,
    time_bin_seconds: int = 3600,
) -> PathMetrics:
    if not path:
        raise ValueError("Path cannot be empty")
    length = time_s = energy_wh = current_sum = 0.0
    edges = 0
    for source, target in pairwise(path):
        source_row, source_column = environment.grid.cell(source)
        target_row, target_column = environment.grid.cell(target)
        dr, dc = target_row - source_row, target_column - source_column
        norm = hypot(dr, dc)
        distance = environment.grid.resolution_m * norm
        time_bin = int(time_s // time_bin_seconds)
        if time_bin >= environment.forecast_bins:
            raise ValueError("Path extends beyond the pinned forecast horizon")
        east, north = environment.current(time_bin, source)
        edge = environmental_edge_cost(distance, dc / norm, dr / norm, east, north, vehicle)
        if edge is None:
            raise ValueError("Path contains an environmentally infeasible edge")
        length += distance
        time_s += edge.travel_time_s
        energy_wh += edge.energy_wh
        current_sum += edge.current_speed_mps
        edges += 1
    return PathMetrics(
        path_length_m=length,
        travel_time_s=time_s,
        energy_wh=energy_wh,
        mean_current_mps=current_sum / edges if edges else 0.0,
        minimum_depth_m=environment.minimum_depth(path),
    )
