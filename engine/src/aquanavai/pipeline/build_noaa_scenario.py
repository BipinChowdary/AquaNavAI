from __future__ import annotations

import argparse
import base64
import json
from datetime import UTC, datetime
from itertools import pairwise
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import rasterio
import yaml
from jsonschema import Draft202012Validator
from PIL import Image
from pyproj import Transformer
from rasterio.features import shapes
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from scipy.ndimage import distance_transform_edt
from shapely.geometry import mapping, shape
from shapely.ops import transform as transform_geometry

from aquanavai.config import load_scenario, load_vehicle, repository_root
from aquanavai.energy.vehicle import VehicleModel
from aquanavai.evaluation.metrics import evaluate_path
from aquanavai.evaluation.runner import DISCLAIMER
from aquanavai.processing.mask import feasible_water_mask, snap_to_feasible
from aquanavai.provenance import sha256_file, write_json
from aquanavai.routing.environmental_astar import environmental_astar
from aquanavai.routing.graph import GridEnvironment
from aquanavai.routing.shortest_path import shortest_path

SCENARIO_ID = "south-florida-noaa-v1"
GENERATED_AT = datetime(2026, 7, 13, 0, 0, tzinfo=UTC)


def _read_catalog(path: Path) -> dict[str, Any]:
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Catalog must be a YAML mapping")
    return value


def _acquire_and_validate_raw(catalog: dict[str, Any], raw: Path, *, allow_network: bool) -> None:
    sources = catalog["scenarios"][SCENARIO_ID]["sources"]
    downloads: list[tuple[str, Path, str]] = []
    for source in sources:
        source_id = str(source["id"])
        if source_id == "wavewatch-iii":
            continue
        for record in source.get("files", []):
            url = str(record["url"])
            downloads.append((url, raw / source_id / Path(url).name, str(record["sha256"])))
        if source_id == "rtofs":
            url = str(source["retrievalUrl"])
            downloads.append(
                (url, raw / source_id / Path(url).name, str(source["sourceFileChecksum"]))
            )
    for url, path, expected in downloads:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            if not allow_network:
                raise FileNotFoundError(
                    f"Offline cache is missing {path.name}; run 'aquanav data fetch' explicitly."
                )
            with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as response:
                response.raise_for_status()
                with path.open("wb") as handle:
                    for block in response.iter_bytes(1024 * 1024):
                        handle.write(block)
        observed = sha256_file(path)
        if observed.lower() != expected.lower():
            raise ValueError(
                f"Checksum mismatch for {path.name}: expected {expected}, observed {observed}"
            )


def _projected_grid(
    bbox: tuple[float, float, float, float], resolution_m: float
) -> tuple[rasterio.Affine, int, int, np.ndarray, np.ndarray]:
    west, south, east, north = bbox
    to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32617", always_xy=True)
    to_wgs84 = Transformer.from_crs("EPSG:32617", "EPSG:4326", always_xy=True)
    corners = [to_utm.transform(x, y) for x in (west, east) for y in (south, north)]
    min_x = min(point[0] for point in corners)
    max_x = max(point[0] for point in corners)
    min_y = min(point[1] for point in corners)
    max_y = max(point[1] for point in corners)
    width = int(np.ceil((max_x - min_x) / resolution_m))
    height = int(np.ceil((max_y - min_y) / resolution_m))
    transform = from_origin(min_x, max_y, resolution_m, resolution_m)
    columns, rows = np.meshgrid(np.arange(width), np.arange(height))
    x = transform.c + (columns + 0.5) * resolution_m
    y = transform.f - (rows + 0.5) * resolution_m
    longitude, latitude = to_wgs84.transform(x, y)
    return transform, width, height, np.asarray(longitude), np.asarray(latitude)


def _reproject_cudem(
    paths: list[Path], transform: rasterio.Affine, width: int, height: int
) -> np.ndarray:
    destination = np.full((height, width), np.nan, dtype=np.float32)
    for path in paths:
        with rasterio.open(path) as source:
            reproject(
                source=rasterio.band(source, 1),
                destination=destination,
                src_transform=source.transform,
                src_crs=source.crs,
                src_nodata=source.nodata,
                dst_transform=transform,
                dst_crs="EPSG:32617",
                dst_nodata=np.nan,
                resampling=Resampling.bilinear,
                init_dest_nodata=False,
            )
    return destination


def _surface_current_bands(source: rasterio.DatasetReader) -> list[tuple[int, int, str]]:
    east: dict[int, tuple[int, str]] = {}
    north: dict[int, tuple[int, str]] = {}
    for index in range(1, source.count + 1):
        tags = source.tags(index)
        if tags.get("GRIB_SHORT_NAME") != "0-DBSL":
            continue
        valid = int(tags.get("GRIB_VALID_TIME", "0").split()[0])
        stamp = datetime.fromtimestamp(valid, UTC).isoformat().replace("+00:00", "Z")
        if tags.get("GRIB_ELEMENT") == "UOGRD":
            east[valid] = (index, stamp)
        elif tags.get("GRIB_ELEMENT") == "VOGRD":
            north[valid] = (index, stamp)
    common = sorted(east.keys() & north.keys())
    if not common:
        raise ValueError("RTOFS file has no paired surface UOGRD/VOGRD bands")
    return [(east[key][0], north[key][0], east[key][1]) for key in common]


def _reproject_rtofs(
    path: Path, transform: rasterio.Affine, width: int, height: int
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    east_slices: list[np.ndarray] = []
    north_slices: list[np.ndarray] = []
    times: list[str] = []
    with rasterio.open(path) as source:
        for east_band, north_band, valid_time in _surface_current_bands(source):
            components = []
            for band in (east_band, north_band):
                destination = np.full((height, width), np.nan, dtype=np.float32)
                reproject(
                    source=rasterio.band(source, band),
                    destination=destination,
                    src_transform=source.transform,
                    src_crs=source.crs,
                    src_nodata=source.nodata,
                    dst_transform=transform,
                    dst_crs="EPSG:32617",
                    dst_nodata=np.nan,
                    resampling=Resampling.bilinear,
                )
                components.append(destination)
            east_slices.append(components[0])
            north_slices.append(components[1])
            times.append(valid_time)
    return np.stack(east_slices), np.stack(north_slices), times


def _fill_nearest_rtofs_wet_cell(component: np.ndarray) -> np.ndarray:
    """Fill RTOFS coastal-mask gaps from the nearest regridded model wet cell.

    RTOFS and CUDEM use different coastlines. This operation is spatial gap filling,
    not temporal forecast extrapolation, and is limited later to CUDEM-valid water.
    """
    filled = component.copy()
    for time_index in range(filled.shape[0]):
        invalid = ~np.isfinite(filled[time_index])
        if invalid.all():
            raise ValueError("RTOFS time slice contains no valid wet cells")
        nearest = distance_transform_edt(invalid, return_distances=False, return_indices=True)
        filled[time_index][invalid] = filled[time_index][tuple(nearest[:, invalid])]
    return filled


def _encode_array(array: np.ndarray, dtype: str, scale: float = 1.0) -> str:
    target = np.dtype(dtype).newbyteorder("<")
    encoded = (
        array.astype(target, copy=False)
        if np.issubdtype(target, np.floating)
        else np.rint(array / scale).astype(target, copy=False)
    )
    return base64.b64encode(encoded.tobytes(order="C")).decode("ascii")


def _feature_collection(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


def _coastline_geojson(elevation: np.ndarray, transform: rasterio.Affine) -> dict[str, Any]:
    land = (np.isfinite(elevation) & (elevation >= 0)).astype(np.uint8)
    to_wgs84 = Transformer.from_crs("EPSG:32617", "EPSG:4326", always_xy=True).transform
    features: list[dict[str, Any]] = []
    for geometry, value in shapes(land, mask=land.astype(bool), transform=transform):
        if value != 1:
            continue
        simplified = transform_geometry(to_wgs84, shape(geometry)).simplify(0.00025)
        if not simplified.is_empty:
            features.append(
                {
                    "type": "Feature",
                    "properties": {"kind": "land", "source": "NOAA CUDEM"},
                    "geometry": mapping(simplified),
                }
            )
    return _feature_collection(features)


def _write_bathymetry(depth: np.ndarray, feasible: np.ndarray, path: Path) -> None:
    normalized = np.nan_to_num(np.clip(depth / 100.0, 0.0, 1.0), nan=0.0)
    image = np.stack(
        (
            6 + 10 * normalized,
            38 + 60 * normalized,
            67 + 110 * normalized,
        ),
        axis=-1,
    ).astype(np.uint8)
    image[~feasible] = np.array([226, 220, 202], dtype=np.uint8)
    Image.fromarray(image, mode="RGB").resize((900, 1500), Image.Resampling.NEAREST).save(
        path, "WEBP", quality=88, method=6
    )


def _parse_ndbc(path: Path, station_id: str, coordinate: tuple[float, float]) -> dict[str, Any]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    header = lines[0].lstrip("#").split()
    values = lines[2].split()
    row = dict(zip(header, values, strict=False))
    timestamp = f"{row['YY']}-{row['MM']}-{row['DD']}T{row['hh']}:{row['mm']}:00Z"
    observed = {
        key: (None if row.get(key) in {None, "MM"} else row[key])
        for key in ("WSPD", "GST", "WVHT", "DPD", "MWD", "WTMP", "ATMP")
    }
    return {
        "type": "Feature",
        "properties": {
            "stationId": station_id,
            "observedAt": timestamp,
            "observations": observed,
            "role": "contextual observation; not route-current ground truth",
        },
        "geometry": {"type": "Point", "coordinates": list(coordinate)},
    }


def _evaluate(
    environment: GridEnvironment,
    pairs: list[Any],
    valid_times: list[str],
    vehicle: VehicleModel,
) -> tuple[dict[str, Any], dict[str, Any]]:
    route_features: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    for time_index, valid_time in enumerate(valid_times):
        shifted = GridEnvironment(
            environment.grid,
            environment.feasible,
            environment.depth_m,
            environment.current_east_mps[time_index:],
            environment.current_north_mps[time_index:],
            environment.longitude,
            environment.latitude,
        )
        for pair in pairs:
            start_cell = snap_to_feasible(shifted.feasible, *shifted.nearest_cell(pair.start))
            goal_cell = snap_to_feasible(shifted.feasible, *shifted.nearest_cell(pair.goal))
            start = shifted.grid.node(*start_cell)
            goal = shifted.grid.node(*goal_cell)
            for algorithm in ("distance", "environmental"):
                if algorithm == "distance":
                    distance_path = shortest_path(shifted, start, goal)
                    nodes = distance_path.nodes
                    metric = evaluate_path(shifted, nodes, vehicle)
                    distance_m = metric.path_length_m
                    travel_s = metric.travel_time_s
                    energy_wh = metric.energy_wh
                    mean_current = metric.mean_current_mps
                else:
                    environmental_path = environmental_astar(shifted, start, goal, vehicle)
                    nodes = environmental_path.nodes
                    distance_m = sum(
                        shifted.grid.resolution_m
                        * float(
                            np.hypot(*(np.subtract(shifted.grid.cell(b), shifted.grid.cell(a))))
                        )
                        for a, b in pairwise(nodes)
                    )
                    travel_s = environmental_path.travel_time_s
                    energy_wh = environmental_path.energy_wh
                    mean_current = environmental_path.mean_current_mps
                result_id = f"{valid_time[:13]}-{pair.id}-{algorithm}"
                coordinates = [shifted.coordinate(node) for node in nodes]
                route_features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "id": result_id,
                            "pairId": pair.id,
                            "algorithm": algorithm,
                            "forecastCycle": valid_time,
                        },
                        "geometry": {"type": "LineString", "coordinates": coordinates},
                    }
                )
                results.append(
                    {
                        "id": result_id,
                        "pair_id": pair.id,
                        "algorithm": algorithm,
                        "forecast_cycle": valid_time,
                        "departure_time": valid_time,
                        "path_length_m": round(distance_m, 2),
                        "travel_time_s": round(travel_s, 2),
                        "modelled_propulsion_energy_wh": round(energy_wh, 2),
                        "minimum_depth_m": round(shifted.minimum_depth(nodes), 2),
                        "mean_current_mps": round(mean_current, 4),
                        "compute_time_ms": 0.0,
                        "compute_emissions_kg": None,
                    }
                )
    return _feature_collection(route_features), {
        "scenarioId": SCENARIO_ID,
        "dataMode": "pinned-noaa",
        "computeTimingIncluded": False,
        "results": results,
    }


def build(config_path: Path, *, allow_network: bool = True) -> Path:
    catalog = _read_catalog(config_path)
    scenario = load_scenario(SCENARIO_ID)
    vehicle_config = load_vehicle()
    vehicle = VehicleModel.from_config(vehicle_config)
    root = repository_root()
    raw = root / "data" / "raw" / SCENARIO_ID
    output = root / "public" / "scenarios" / SCENARIO_ID
    output.mkdir(parents=True, exist_ok=True)
    _acquire_and_validate_raw(catalog, raw, allow_network=allow_network)
    cudem_paths = sorted((raw / "cudem").glob("*.tif"))
    rtofs_path = raw / "rtofs" / "rtofs_glo.t00z.f024_west_atl_std.grb2"
    required = [*cudem_paths, rtofs_path, raw / "ndbc" / "41122.txt", raw / "ndbc" / "LKWF1.txt"]
    if len(cudem_paths) != 5 or not all(path.exists() for path in required):
        missing = [str(path) for path in required if not path.exists()]
        raise FileNotFoundError(f"Pinned raw cache is incomplete: {missing}")

    transform, width, height, longitude, latitude = _projected_grid(
        scenario.bbox, scenario.grid_resolution_m
    )
    north_up_elevation = _reproject_cudem(cudem_paths, transform, width, height)
    north_up_depth = np.maximum(-north_up_elevation, 0.0)
    north_up_feasible = feasible_water_mask(
        north_up_depth, scenario.minimum_depth_m, scenario.grid_resolution_m, scenario.land_buffer_m
    )
    east, north, valid_times = _reproject_rtofs(rtofs_path, transform, width, height)
    east = _fill_nearest_rtofs_wet_cell(east)
    north = _fill_nearest_rtofs_wet_cell(north)
    # GridEnvironment defines positive row direction as north. Rasterio arrays are
    # north-up (row zero is north), so every routing array is flipped together.
    depth = np.flipud(north_up_depth)
    feasible = np.flipud(north_up_feasible)
    east = east[:, ::-1, :]
    north = north[:, ::-1, :]
    longitude = np.flipud(longitude)
    latitude = np.flipud(latitude)
    east[:, ~feasible] = 0.0
    north[:, ~feasible] = 0.0
    from aquanavai.processing.grid import GridSpec

    grid = GridSpec(scenario.bbox, scenario.grid_resolution_m, width, height)
    environment = GridEnvironment(grid, feasible, depth, east, north, longitude, latitude)
    departure_times = valid_times[:10]
    routes, metrics = _evaluate(environment, scenario.route_pairs, departure_times, vehicle)

    _write_bathymetry(north_up_depth, north_up_feasible, output / "bathymetry.webp")
    write_json(output / "coastline.geojson", _coastline_geojson(north_up_elevation, transform))
    write_json(
        output / "currents.geojson",
        _feature_collection(
            [
                {
                    "type": "Feature",
                    "properties": {
                        "east_mps": round(float(east[0, row, column]), 3),
                        "north_mps": round(float(north[0, row, column]), 3),
                        "speed_mps": round(
                            float(np.hypot(east[0, row, column], north[0, row, column])), 3
                        ),
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            float(longitude[row, column]),
                            float(latitude[row, column]),
                        ],
                    },
                }
                for row in range(0, height, 10)
                for column in range(0, width, 4)
                if feasible[row, column]
            ]
        ),
    )
    write_json(
        output / "stations.geojson",
        _feature_collection(
            [
                _parse_ndbc(raw / "ndbc" / "41122.txt", "41122", (-80.096, 26.001)),
                _parse_ndbc(raw / "ndbc" / "LKWF1.txt", "LKWF1", (-80.034, 26.613)),
            ]
        ),
    )
    write_json(output / "routes.geojson", routes)
    write_json(output / "metrics.json", metrics)
    grid_artifact = {
        "version": 1,
        "width": width,
        "height": height,
        "resolutionM": scenario.grid_resolution_m,
        "forecastTimes": valid_times,
        "vehicle": {
            "cruiseSpeedMps": vehicle.cruise_speed_mps,
            "hotelPowerW": vehicle.hotel_power_w,
            "propulsionCoefficient": vehicle.propulsion_coefficient_w_per_mps3,
        },
        "encoding": {"byteOrder": "little", "depthScaleM": 0.1, "currentScaleMps": 0.01},
        "feasible": _encode_array(feasible.astype(np.uint8), "u1"),
        "depth": _encode_array(np.nan_to_num(depth, nan=0.0), "u2", 0.1),
        "longitude": _encode_array(longitude, "f4"),
        "latitude": _encode_array(latitude, "f4"),
        "currentEast": _encode_array(east, "i2", 0.01),
        "currentNorth": _encode_array(north, "i2", 0.01),
        "missions": [pair.model_dump(mode="json") for pair in scenario.route_pairs],
    }
    write_json(output / "navigation-grid.json", grid_artifact)

    source_records = catalog["scenarios"][SCENARIO_ID]["sources"]
    provenance = {
        "scenarioId": SCENARIO_ID,
        "status": "verified-noaa-derived",
        "warning": (
            "Verified NOAA-derived environmental snapshot. Research demonstrator; "
            "not for operational navigation."
        ),
        "generatedAt": GENERATED_AT.isoformat().replace("+00:00", "Z"),
        "processingVersion": "aquanavai-engine 0.2.0",
        "analysisGrid": {
            "crs": "EPSG:32617",
            "resolutionM": scenario.grid_resolution_m,
            "width": width,
            "height": height,
            "nativeSourceResolutionPreservedInMetadata": True,
        },
        "sources": source_records,
        "transformations": [
            "CUDEM NAD83 elevation reprojected to EPSG:32617 by bilinear interpolation at 500 m",
            (
                "depth derived as max(-elevation, 0); minimum depth 5 m; "
                "250 m exclusion buffer rounded to one 500 m cell"
            ),
            (
                "RTOFS surface UOGRD/VOGRD reprojected independently by bilinear "
                "interpolation; coastal model-mask gaps filled from the nearest RTOFS "
                "wet cell only where CUDEM confirms navigable water"
            ),
            (
                "all routing arrays flipped together from raster north-up row order "
                "so increasing graph row is geographic north"
            ),
            "NDBC latest records retained as contextual observations only",
        ],
        "energyModel": {
            "status": "modelled proxy, not measured vessel energy",
            "cruiseSpeedMps": vehicle.cruise_speed_mps,
            "hotelPowerW": vehicle.hotel_power_w,
            "propulsionFormula": "P = 44.44 * v^3 W",
        },
        "limitations": [
            (
                "CUDEM is not a navigation chart and the 500 m analysis grid cannot "
                "represent all coastal hazards."
            ),
            (
                "RTOFS is an ocean forecast model; interpolating does not increase "
                "its native resolution."
            ),
            (
                "No tides, traffic, regulations, collision avoidance, or verified "
                "wave field are included."
            ),
            "NDBC observations do not validate the spatial RTOFS current field.",
        ],
    }
    write_json(output / "provenance.json", provenance)
    report = [
        "# South Florida NOAA v1 provenance",
        "",
        (
            "This immutable scenario uses official NOAA CUDEM elevation, NOAA RTOFS "
            "modelled surface currents, and NDBC contextual observations."
        ),
        "It is a research demonstrator, not an operational navigation product.",
        "",
        f"- Generated: {provenance['generatedAt']}",
        f"- Grid: {width} x {height} cells at {scenario.grid_resolution_m:.0f} m in EPSG:32617",
        f"- Navigable cells: {int(feasible.sum())} / {feasible.size}",
        f"- RTOFS valid times: {valid_times[0]} through {valid_times[-1]}",
        "- Propulsion energy: modelled reference proxy, not measured performance",
    ]
    with (output / "PROVENANCE.md").open("w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(report) + "\n")

    artifact_names = [
        "bathymetry.webp",
        "coastline.geojson",
        "currents.geojson",
        "stations.geojson",
        "routes.geojson",
        "metrics.json",
        "navigation-grid.json",
        "provenance.json",
        "PROVENANCE.md",
    ]
    files = {Path(name).stem: name for name in artifact_names}
    files["grid"] = files.pop("navigation-grid")
    files["provenanceReport"] = files.pop("PROVENANCE")
    checksums = {name: sha256_file(output / name) for name in artifact_names}
    manifest = {
        "schemaVersion": "1.0.0",
        "id": SCENARIO_ID,
        "title": scenario.title,
        "version": scenario.version,
        "generatedAt": provenance["generatedAt"],
        "dataMode": "pinned-noaa",
        "immutable": True,
        "bbox": list(scenario.bbox),
        "crs": {"analysis": "EPSG:32617", "interchange": "EPSG:4326"},
        "forecastCycles": departure_times,
        "departureTimes": departure_times,
        "referenceVehicleId": vehicle_config.id,
        "disclaimer": DISCLAIMER,
        "citations": [record["citation"] for record in source_records],
        "files": files,
        "checksums": checksums,
    }
    write_json(output / "manifest.json", manifest)
    schema = json.loads((root / "public" / "schemas" / "scenario.schema.json").read_text())
    errors = sorted(
        Draft202012Validator(schema).iter_errors(manifest), key=lambda error: error.path
    )
    if errors:
        raise ValueError(
            "Generated manifest failed schema validation: "
            + "; ".join(error.message for error in errors)
        )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the pinned NOAA South Florida scenario")
    parser.add_argument("--config", type=Path, default=Path("data/catalog.yaml"))
    arguments = parser.parse_args()
    output = build(arguments.config.resolve())
    print(f"Built {SCENARIO_ID}: {output}")


if __name__ == "__main__":
    main()
