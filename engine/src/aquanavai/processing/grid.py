from __future__ import annotations

from dataclasses import dataclass
from math import cos, radians


@dataclass(frozen=True)
class GridSpec:
    bbox: tuple[float, float, float, float]
    resolution_m: float
    width: int
    height: int

    @classmethod
    def from_bbox(cls, bbox: tuple[float, float, float, float], resolution_m: float) -> GridSpec:
        west, south, east, north = bbox
        mean_latitude = (south + north) / 2
        width_m = (east - west) * 111_320 * cos(radians(mean_latitude))
        height_m = (north - south) * 110_540
        return cls(
            bbox=bbox,
            resolution_m=resolution_m,
            width=max(2, round(width_m / resolution_m) + 1),
            height=max(2, round(height_m / resolution_m) + 1),
        )

    def coordinate(self, row: int, column: int) -> tuple[float, float]:
        west, south, east, north = self.bbox
        longitude = west + (east - west) * column / (self.width - 1)
        latitude = south + (north - south) * row / (self.height - 1)
        return longitude, latitude

    def nearest_cell(self, coordinate: tuple[float, float]) -> tuple[int, int]:
        longitude, latitude = coordinate
        west, south, east, north = self.bbox
        column = round((longitude - west) / (east - west) * (self.width - 1))
        row = round((latitude - south) / (north - south) * (self.height - 1))
        return min(max(row, 0), self.height - 1), min(max(column, 0), self.width - 1)

    def node(self, row: int, column: int) -> int:
        return row * self.width + column

    def cell(self, node: int) -> tuple[int, int]:
        return divmod(node, self.width)
