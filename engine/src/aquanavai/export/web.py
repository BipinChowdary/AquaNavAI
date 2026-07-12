from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from aquanavai.config import ScenarioConfig, VehicleConfig, repository_root
from aquanavai.evaluation.runner import DISCLAIMER, EvaluationBundle, evaluate_scenario
from aquanavai.provenance import sha256_file, write_json
from aquanavai.schemas import ScenarioManifest


def _feature_collection(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


def _write_bathymetry(bundle: EvaluationBundle, path: Path) -> None:
    depth = bundle.environment.depth_m
    feasible = bundle.environment.feasible
    normalized = np.clip(depth / 90.0, 0.0, 1.0)
    red = (5 + 10 * normalized).astype(np.uint8)
    green = (35 + 70 * normalized).astype(np.uint8)
    blue = (58 + 115 * normalized).astype(np.uint8)
    image = np.stack((red, green, blue), axis=-1)
    image[~feasible] = np.array([238, 233, 218], dtype=np.uint8)
    rendered = Image.fromarray(np.flipud(image), mode="RGB").resize(
        (960, 720), Image.Resampling.BICUBIC
    )
    rendered.save(path, "WEBP", quality=86, method=6)


def _coastline(scenario: ScenarioConfig) -> dict[str, Any]:
    west, south, _, north = scenario.bbox
    points = []
    for index in range(81):
        latitude = south + (north - south) * index / 80
        longitude = -80.085 + 0.006 * np.sin((latitude - 26.0) * 6 * np.pi)
        points.append([float(longitude), float(latitude)])
    polygon = [[west, south], *points, [west, north], [west, south]]
    return _feature_collection(
        [
            {
                "type": "Feature",
                "properties": {"kind": "land", "source": "deterministic proxy fixture"},
                "geometry": {"type": "Polygon", "coordinates": [polygon]},
            }
        ]
    )


def _currents(bundle: EvaluationBundle) -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    grid = bundle.environment.grid
    for row in range(0, grid.height, 8):
        for column in range(0, grid.width, 6):
            if not bundle.environment.feasible[row, column]:
                continue
            node = grid.node(row, column)
            east, north = bundle.environment.current(0, node)
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "east_mps": round(east, 3),
                        "north_mps": round(north, 3),
                        "speed_mps": round(float((east**2 + north**2) ** 0.5), 3),
                    },
                    "geometry": {"type": "Point", "coordinates": grid.coordinate(row, column)},
                }
            )
    return _feature_collection(features)


def export_web_scenario(
    scenario: ScenarioConfig,
    vehicle: VehicleConfig,
    output_root: Path | None = None,
) -> Path:
    scenario_root = output_root or repository_root() / "public" / "scenarios"
    output = scenario_root / scenario.id
    output.mkdir(parents=True, exist_ok=True)
    bundle = evaluate_scenario(scenario, vehicle, all_cycles=True)

    _write_bathymetry(bundle, output / "bathymetry.webp")
    write_json(output / "coastline.geojson", _coastline(scenario))
    write_json(output / "currents.geojson", _currents(bundle))
    write_json(
        output / "stations.geojson",
        _feature_collection([]),
    )

    route_features = []
    for result in bundle.results:
        route_features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": result.id,
                    "pairId": result.pair_id,
                    "algorithm": result.algorithm,
                    "forecastCycle": result.forecast_cycle,
                    "pathLengthM": round(result.path_length_m, 2),
                    "travelTimeS": round(result.travel_time_s, 2),
                    "energyWh": round(result.modelled_propulsion_energy_wh, 2),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [round(lon, 6), round(lat, 6)] for lon, lat in result.coordinates
                    ],
                },
            }
        )
    write_json(output / "routes.geojson", _feature_collection(route_features))

    serializable_results = []
    for result in bundle.results:
        value = result.model_dump(mode="json", exclude={"coordinates"})
        value["compute_time_ms"] = 0.0
        serializable_results.append(value)
    write_json(
        output / "metrics.json",
        {
            "scenarioId": scenario.id,
            "dataMode": "offline-proxy",
            "computeTimingIncluded": False,
            "results": serializable_results,
        },
    )

    citations = [
        "NOAA NCEI ETOPO 2022 Global Relief Model",
        "NOAA NCEI Continuously Updated Digital Elevation Model (CUDEM)",
        "NOAA NCEP Global Real-Time Ocean Forecast System (RTOFS)",
        "NOAA National Data Buoy Center (NDBC)",
    ]
    provenance = {
        "scenarioId": scenario.id,
        "status": "proxy",
        "warning": (
            "This fixture exercises the complete software path but is not a NOAA-derived result."
        ),
        "analysisGrid": {
            "crs": scenario.analysis_crs,
            "resolutionM": scenario.grid_resolution_m,
            "nativeSourceResolutionPreservedInMetadata": True,
        },
        "sources": [
            {
                "id": "cudem",
                "provider": "NOAA NCEI",
                "product": "CUDEM",
                "role": "planned primary feasibility mask",
                "status": "pending",
                "url": "https://www.ncei.noaa.gov/products/coastal-elevation-models",
            },
            {
                "id": "rtofs",
                "provider": "NOAA NCEP",
                "product": "Global RTOFS",
                "role": "planned surface-current forcing",
                "status": "pending",
                "url": "https://polar.ncep.noaa.gov/global/about/index.shtml?text=",
            },
            {
                "id": "ndbc",
                "provider": "NOAA NDBC",
                "product": "Realtime observations",
                "role": "planned observational context and validation",
                "status": "pending",
                "url": "https://www.ndbc.noaa.gov/faq/rt_data_access.shtml",
            },
        ],
        "transformations": [
            "deterministic analytic coastline/depth fixture",
            "deterministic time-varying current fixture",
            "500 m eight-neighbour routing grid",
        ],
    }
    write_json(output / "provenance.json", provenance)

    filenames = [
        "bathymetry.webp",
        "coastline.geojson",
        "currents.geojson",
        "stations.geojson",
        "routes.geojson",
        "metrics.json",
        "provenance.json",
    ]
    files = {Path(name).stem: name for name in filenames}
    checksums = {name: sha256_file(output / name) for name in filenames}
    manifest = ScenarioManifest(
        id=scenario.id,
        title=scenario.title,
        version=scenario.version,
        generatedAt=datetime(2026, 7, 12, tzinfo=UTC),
        dataMode="offline-proxy",
        immutable=True,
        bbox=list(scenario.bbox),
        crs={"interchange": scenario.interchange_crs, "analysis": scenario.analysis_crs},
        forecastCycles=bundle.forecast_cycles,
        departureTimes=[
            datetime.fromisoformat(item.replace("Z", "+00:00")) for item in bundle.forecast_cycles
        ],
        referenceVehicleId=vehicle.id,
        disclaimer=DISCLAIMER,
        citations=citations,
        files=files,
        checksums=checksums,
    )
    write_json(output / "manifest.json", manifest.model_dump(mode="json"))
    write_json(
        scenario_root / "index.json",
        {
            "schemaVersion": "1.0.0",
            "scenarios": [
                {
                    "id": scenario.id,
                    "title": scenario.title,
                    "version": scenario.version,
                    "manifest": f"/scenarios/{scenario.id}/manifest.json",
                    "dataMode": "offline-proxy",
                }
            ],
        },
    )
    return output
