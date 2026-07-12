from __future__ import annotations

import heapq
from dataclasses import dataclass
from math import hypot, inf

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.routing.costs import environmental_edge_cost
from aquanavai.routing.graph import GridEnvironment

State = tuple[int, int]


@dataclass(frozen=True)
class EnvironmentalPath:
    nodes: list[int]
    energy_wh: float
    travel_time_s: float
    mean_current_mps: float


def _heuristic(
    environment: GridEnvironment,
    node: int,
    goal: int,
    vehicle: VehicleModel,
    maximum_favourable_current_mps: float,
) -> float:
    row, column = environment.grid.cell(node)
    goal_row, goal_column = environment.grid.cell(goal)
    distance = environment.grid.resolution_m * hypot(goal_row - row, goal_column - column)
    optimistic_speed = vehicle.cruise_speed_mps + max(maximum_favourable_current_mps, 0.0)
    return vehicle.energy_wh(distance / optimistic_speed)


def environmental_astar(
    environment: GridEnvironment,
    start: int,
    goal: int,
    vehicle: VehicleModel,
    time_bin_seconds: int = 3600,
) -> EnvironmentalPath:
    if time_bin_seconds <= 0:
        raise ValueError("time_bin_seconds must be positive")
    maximum_current = float(
        max(abs(environment.current_east_mps).max(), abs(environment.current_north_mps).max())
    )
    start_state: State = (start, 0)
    energy: dict[State, float] = {start_state: 0.0}
    arrival: dict[State, float] = {start_state: 0.0}
    current_sum: dict[State, float] = {start_state: 0.0}
    edge_count: dict[State, int] = {start_state: 0}
    parent: dict[State, State] = {}
    queue: list[tuple[float, float, State]] = [
        (_heuristic(environment, start, goal, vehicle, maximum_current), 0.0, start_state)
    ]

    while queue:
        _, cost_so_far, state = heapq.heappop(queue)
        if cost_so_far != energy.get(state, inf):
            continue
        node, _ = state
        if node == goal:
            states = [state]
            while states[-1] in parent:
                states.append(parent[states[-1]])
            states.reverse()
            nodes = [item[0] for item in states]
            count = edge_count[state]
            return EnvironmentalPath(
                nodes=nodes,
                energy_wh=energy[state],
                travel_time_s=arrival[state],
                mean_current_mps=current_sum[state] / count if count else 0.0,
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
            next_state: State = (neighbor, candidate_bin)
            candidate_energy = cost_so_far + edge.energy_wh
            if candidate_energy < energy.get(next_state, inf):
                energy[next_state] = candidate_energy
                arrival[next_state] = candidate_arrival
                current_sum[next_state] = current_sum[state] + edge.current_speed_mps
                edge_count[next_state] = edge_count[state] + 1
                parent[next_state] = state
                priority = candidate_energy + _heuristic(
                    environment, neighbor, goal, vehicle, maximum_current
                )
                heapq.heappush(queue, (priority, candidate_energy, next_state))
    raise ValueError("No forecast-feasible environmental path exists between start and goal")
