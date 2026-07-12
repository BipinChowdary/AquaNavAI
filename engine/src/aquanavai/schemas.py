from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SourceRecord(BaseModel):
    id: str
    provider: str
    product: str
    role: str
    url: str
    citation: str
    retrieved_at: datetime | None = None
    checksum_sha256: str | None = None
    status: Literal["pinned", "pending", "proxy"]
    variables: list[str]
    units: dict[str, str]
    spatial_subset: list[float]
    temporal_subset: list[str]
    crs: str
    vertical_datum: str | None = None
    transformations: list[str] = Field(default_factory=list)


class RouteResult(BaseModel):
    id: str
    pair_id: str
    algorithm: Literal["distance", "environmental"]
    forecast_cycle: str
    departure_time: datetime
    path_length_m: float = Field(ge=0)
    travel_time_s: float = Field(ge=0)
    modelled_propulsion_energy_wh: float = Field(ge=0)
    minimum_depth_m: float = Field(ge=0)
    mean_current_mps: float = Field(ge=0)
    compute_time_ms: float = Field(ge=0)
    compute_emissions_kg: float | None = Field(default=None, ge=0)
    coordinates: list[tuple[float, float]]


class ScenarioManifest(BaseModel):
    schemaVersion: Literal["1.0.0"] = "1.0.0"
    id: str
    title: str
    version: str
    generatedAt: datetime
    dataMode: Literal["offline-proxy", "pinned-noaa"]
    immutable: bool
    bbox: list[float]
    crs: dict[str, str]
    forecastCycles: list[str]
    departureTimes: list[datetime]
    referenceVehicleId: str
    disclaimer: str
    citations: list[str]
    files: dict[str, str]
    checksums: dict[str, str]
