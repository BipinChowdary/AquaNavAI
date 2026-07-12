from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, model_validator


class RoutePair(BaseModel):
    id: str
    label: str
    start: tuple[float, float]
    goal: tuple[float, float]


class ScenarioConfig(BaseModel):
    id: str
    title: str
    version: str
    bbox: tuple[float, float, float, float]
    analysis_crs: str = "EPSG:32617"
    interchange_crs: str = "EPSG:4326"
    grid_resolution_m: float = Field(gt=0)
    minimum_depth_m: float = Field(ge=0)
    land_buffer_m: float = Field(ge=0)
    forecast_time_bin_hours: int = Field(gt=0)
    route_pairs: list[RoutePair]
    offline_proxy: bool = True

    @model_validator(mode="after")
    def validate_bounds(self) -> ScenarioConfig:
        west, south, east, north = self.bbox
        if west >= east or south >= north:
            raise ValueError("bbox must be [west, south, east, north]")
        if len(self.route_pairs) != 3:
            raise ValueError("south-florida-v1 requires exactly three route pairs")
        return self


class VehicleConfig(BaseModel):
    id: str
    label: str
    cruise_speed_mps: float = Field(gt=0)
    hotel_power_w: float = Field(ge=0)
    propulsion_coefficient_w_per_mps3: float = Field(gt=0)
    waiting_enabled: bool = False


def engine_root() -> Path:
    return Path(__file__).resolve().parents[2]


def repository_root() -> Path:
    return engine_root().parent


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a mapping in {path}")
    return value


def load_scenario(scenario_id: str) -> ScenarioConfig:
    path = engine_root() / "config" / "scenarios" / f"{scenario_id.replace('-', '_')}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Unknown scenario '{scenario_id}': {path}")
    return ScenarioConfig.model_validate(_load_yaml(path))


def load_vehicle(vehicle_id: str = "reference-asv-v1") -> VehicleConfig:
    path = engine_root() / "config" / "vehicles" / f"{vehicle_id.replace('-', '_')}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Unknown vehicle '{vehicle_id}': {path}")
    return VehicleConfig.model_validate(_load_yaml(path))
