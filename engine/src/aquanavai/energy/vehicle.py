from __future__ import annotations

from dataclasses import dataclass

from aquanavai.config import VehicleConfig


@dataclass(frozen=True)
class VehicleModel:
    cruise_speed_mps: float
    hotel_power_w: float
    propulsion_coefficient_w_per_mps3: float

    @classmethod
    def from_config(cls, config: VehicleConfig) -> VehicleModel:
        return cls(
            cruise_speed_mps=config.cruise_speed_mps,
            hotel_power_w=config.hotel_power_w,
            propulsion_coefficient_w_per_mps3=config.propulsion_coefficient_w_per_mps3,
        )

    @property
    def propulsion_power_w(self) -> float:
        return self.propulsion_coefficient_w_per_mps3 * self.cruise_speed_mps**3

    @property
    def total_power_w(self) -> float:
        return self.hotel_power_w + self.propulsion_power_w

    def energy_wh(self, duration_s: float) -> float:
        if duration_s < 0:
            raise ValueError("duration_s cannot be negative")
        return self.total_power_w * duration_s / 3600
