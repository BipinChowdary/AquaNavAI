from __future__ import annotations

from dataclasses import dataclass
from math import hypot, sqrt

from aquanavai.energy.vehicle import VehicleModel


@dataclass(frozen=True)
class EdgeCost:
    travel_time_s: float
    energy_wh: float
    current_speed_mps: float
    ground_speed_mps: float


def environmental_edge_cost(
    distance_m: float,
    direction_east: float,
    direction_north: float,
    current_east_mps: float,
    current_north_mps: float,
    vehicle: VehicleModel,
) -> EdgeCost | None:
    current_along = current_east_mps * direction_east + current_north_mps * direction_north
    current_cross = -current_east_mps * direction_north + current_north_mps * direction_east
    if abs(current_cross) >= vehicle.cruise_speed_mps:
        return None
    vehicle_along = sqrt(vehicle.cruise_speed_mps**2 - current_cross**2)
    ground_speed = vehicle_along + current_along
    if ground_speed <= 0:
        return None
    travel_time = distance_m / ground_speed
    return EdgeCost(
        travel_time_s=travel_time,
        energy_wh=vehicle.energy_wh(travel_time),
        current_speed_mps=hypot(current_east_mps, current_north_mps),
        ground_speed_mps=ground_speed,
    )
