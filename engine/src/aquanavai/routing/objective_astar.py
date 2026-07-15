from __future__ import annotations

import heapq
from dataclasses import dataclass
from math import inf
from typing import Literal

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.routing.costs import environmental_edge_cost
from aquanavai.routing.graph import GridEnvironment

RouteObjective = Literal["fastest", "energy", "balanced"]
State = tuple[int, int]


@dataclass(frozen=True)
class ObjectivePath:
    nodes: list[int]
    travel_time_s: float
    energy_wh: float
    mean_current_mps: float
    risk_score: float


def objective_astar(
    environment: GridEnvironment,
    start: int,
    goal: int,
    vehicle: VehicleModel,
    objective: RouteObjective,
    time_bin_seconds: int = 3600,
) -> ObjectivePath:
    """Deterministic time-expanded search for Navigation V2 objectives.

    Balanced cost uses documented dimensionless components normalized to a fixed
    grid-resolution reference step: travel time 0.35, modelled energy 0.35,
    current exposure 0.15, and shallow-water context 0.15.
    A zero heuristic is used so the result remains admissible for every objective.
    """
    if time_bin_seconds <= 0:
        raise ValueError("time_bin_seconds must be positive")
    start_state: State = (start, 0)
    score: dict[State, float] = {start_state: 0.0}
    arrival: dict[State, float] = {start_state: 0.0}
    energy: dict[State, float] = {start_state: 0.0}
    current_sum: dict[State, float] = {start_state: 0.0}
    risk_sum: dict[State, float] = {start_state: 0.0}
    edge_count: dict[State, int] = {start_state: 0}
    parent: dict[State, State] = {}
    queue: list[tuple[float, State]] = [(0.0, start_state)]

    while queue:
        cost_so_far, state = heapq.heappop(queue)
        if cost_so_far != score.get(state, inf):
            continue
        node, _ = state
        if node == goal:
            states = [state]
            while states[-1] in parent:
                states.append(parent[states[-1]])
            states.reverse()
            count = edge_count[state]
            return ObjectivePath(
                nodes=[item[0] for item in states],
                travel_time_s=arrival[state],
                energy_wh=energy[state],
                mean_current_mps=current_sum[state] / count if count else 0.0,
                risk_score=risk_sum[state] / count if count else 0.0,
            )

        time_bin = int(arrival[state] // time_bin_seconds)
        if time_bin >= environment.forecast_bins:
            continue
        current_east, current_north = environment.current(time_bin, node)
        for neighbor, distance, direction_east, direction_north in environment.neighbors(node):
            edge = environmental_edge_cost(
                distance,
                direction_east,
                direction_north,
                current_east,
                current_north,
                vehicle,
            )
            if edge is None:
                continue
            candidate_arrival = arrival[state] + edge.travel_time_s
            candidate_bin = int(candidate_arrival // time_bin_seconds)
            if candidate_bin >= environment.forecast_bins:
                continue
            next_state = (neighbor, candidate_bin)
            current_risk = min(1.0, edge.current_speed_mps / vehicle.cruise_speed_mps)
            depth = float(environment.depth_m[environment.grid.cell(neighbor)])
            shallow_risk = max(0.0, min(1.0, (20.0 - depth) / 15.0))
            combined_risk = 0.6 * current_risk + 0.4 * shallow_risk
            nominal_time = environment.grid.resolution_m / vehicle.cruise_speed_mps
            nominal_energy = vehicle.energy_wh(nominal_time)
            distance_factor = distance / environment.grid.resolution_m
            if objective == "fastest":
                increment = edge.travel_time_s
            elif objective == "energy":
                increment = edge.energy_wh
            else:
                increment = (
                    0.35 * edge.travel_time_s / nominal_time
                    + 0.35 * edge.energy_wh / nominal_energy
                    + 0.15 * current_risk * distance_factor
                    + 0.15 * shallow_risk * distance_factor
                )
            candidate_score = cost_so_far + increment
            if candidate_score < score.get(next_state, inf):
                score[next_state] = candidate_score
                arrival[next_state] = candidate_arrival
                energy[next_state] = energy[state] + edge.energy_wh
                current_sum[next_state] = current_sum[state] + edge.current_speed_mps
                risk_sum[next_state] = risk_sum[state] + combined_risk
                edge_count[next_state] = edge_count[state] + 1
                parent[next_state] = state
                heapq.heappush(queue, (candidate_score, next_state))
    raise ValueError(f"No forecast-feasible {objective} path exists between start and goal")
