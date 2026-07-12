import pytest

from aquanavai.energy.vehicle import VehicleModel


def test_reference_power_and_energy_are_separate_from_compute_emissions() -> None:
    vehicle = VehicleModel(1.5, 30.0, 44.44)
    assert vehicle.propulsion_power_w == pytest.approx(149.985)
    assert vehicle.total_power_w == pytest.approx(179.985)
    assert vehicle.energy_wh(3600) == pytest.approx(179.985)
