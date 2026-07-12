from __future__ import annotations

import heapq
from dataclasses import dataclass
from math import inf

from aquanavai.routing.graph import GridEnvironment


@dataclass(frozen=True)
class DistancePath:
    nodes: list[int]
    distance_m: float


def _reconstruct(parent: dict[int, int], goal: int) -> list[int]:
    path = [goal]
    while path[-1] in parent:
        path.append(parent[path[-1]])
    path.reverse()
    return path


def shortest_path(environment: GridEnvironment, start: int, goal: int) -> DistancePath:
    if not environment.feasible[environment.grid.cell(start)]:
        raise ValueError("Start is not feasible")
    if not environment.feasible[environment.grid.cell(goal)]:
        raise ValueError("Goal is not feasible")
    distances: dict[int, float] = {start: 0.0}
    parent: dict[int, int] = {}
    queue = [(0.0, start)]
    while queue:
        distance, node = heapq.heappop(queue)
        if distance != distances.get(node, inf):
            continue
        if node == goal:
            return DistancePath(_reconstruct(parent, goal), distance)
        for neighbor, edge_distance, _, _ in environment.neighbors(node):
            candidate = distance + edge_distance
            if candidate < distances.get(neighbor, inf):
                distances[neighbor] = candidate
                parent[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    raise ValueError("No feasible path exists between start and goal")
