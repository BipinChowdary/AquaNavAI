import pytest

from aquanavai.energy.vehicle import VehicleModel
from aquanavai.routing.costs import environmental_edge_cost

VEHICLE = VehicleModel(1.5, 30.0, 44.44)


def test_favourable_current_reduces_edge_energy() -> None:
    still = environmental_edge_cost(1500, 1, 0, 0, 0, VEHICLE)
    favourable = environmental_edge_cost(1500, 1, 0, 0.5, 0, VEHICLE)
    assert still is not None and favourable is not None
    assert favourable.energy_wh < still.energy_wh


def test_uncounterable_cross_current_is_infeasible() -> None:
    assert environmental_edge_cost(500, 1, 0, 0, 1.5, VEHICLE) is None


def test_negative_distance_energy_is_rejected() -> None:
    with pytest.raises(ValueError):
        VEHICLE.energy_wh(-1)
