from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any

try:
    from shapely.geometry import LineString, Polygon
    from shapely.geometry.base import BaseGeometry
    from shapely.geometry.polygon import orient
    from shapely.ops import polygonize, unary_union
except Exception:  # pragma: no cover - exercised only when optional dependency is missing
    LineString = None  # type: ignore[assignment]
    Polygon = None  # type: ignore[assignment]
    BaseGeometry = object  # type: ignore[assignment]
    orient = None  # type: ignore[assignment]
    polygonize = None  # type: ignore[assignment]
    unary_union = None  # type: ignore[assignment]


@dataclass(frozen=True)
class Point2D:
    x: float
    y: float

    def rounded(self, precision: int = 5) -> tuple[float, float]:
        return (round(float(self.x), precision), round(float(self.y), precision))


@dataclass(frozen=True)
class BoundarySegment:
    id: str
    source_id: str
    source_type: str
    level_id: str | None
    start: Point2D
    end: Point2D
    thickness_m: float = 0.0
    height_m: float | None = None
    boundary_kind: str = "wall"
    room_bounding: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def length_m(self) -> float:
        return math.hypot(self.end.x - self.start.x, self.end.y - self.start.y)


@dataclass
class EnclosedPolygon:
    id: str
    level_id: str | None
    points: list[Point2D]
    area_m2: float
    perimeter_m: float
    centroid: Point2D
    geometry_hash: str
    source_segment_ids: list[str] = field(default_factory=list)


class EnclosedPolygonService:
    """Detect enclosed 2D faces from room-boundary segments."""

    def polygonize_segments(
        self,
        segments: list[BoundarySegment],
        *,
        level_id: str | None = None,
        tolerance_m: float = 0.01,
        min_area_m2: float = 0.35,
    ) -> list[EnclosedPolygon]:
        if LineString is None or Polygon is None or unary_union is None or polygonize is None:
            raise RuntimeError("Room detection requires shapely to be installed")

        usable_segments = [
            segment
            for segment in segments
            if segment.room_bounding and segment.length_m > tolerance_m
        ]
        if len(usable_segments) < 3:
            return []

        lines = [
            LineString(
                [
                    self._snap_xy(segment.start, tolerance_m),
                    self._snap_xy(segment.end, tolerance_m),
                ]
            )
            for segment in usable_segments
        ]
        noded_network = unary_union(lines)
        polygons = list(polygonize(noded_network))

        rooms: list[EnclosedPolygon] = []
        seen: set[str] = set()
        for raw_polygon in polygons:
            if raw_polygon.is_empty:
                continue
            polygon = orient(raw_polygon, sign=1.0)
            if polygon.area < min_area_m2:
                continue
            points = self._clean_points(
                [Point2D(float(x), float(y)) for x, y in list(polygon.exterior.coords)[:-1]],
                tolerance_m=tolerance_m,
            )
            if len(points) < 3:
                continue
            geometry_hash = self.geometry_hash(points, level_id)
            if geometry_hash in seen:
                continue
            seen.add(geometry_hash)
            centroid = polygon.centroid
            enclosed = EnclosedPolygon(
                id=f"poly_{geometry_hash[:12]}",
                level_id=level_id,
                points=points,
                area_m2=float(polygon.area),
                perimeter_m=float(polygon.length),
                centroid=Point2D(float(centroid.x), float(centroid.y)),
                geometry_hash=geometry_hash,
            )
            enclosed.source_segment_ids = self.boundary_segment_ids(enclosed, usable_segments)
            rooms.append(enclosed)

        rooms.sort(key=lambda item: (item.centroid.y, item.centroid.x, item.area_m2))
        return rooms

    def boundary_segment_ids(
        self,
        polygon: EnclosedPolygon,
        segments: list[BoundarySegment],
        *,
        tolerance_m: float = 0.025,
    ) -> list[str]:
        boundary = self._polygon_geometry(polygon.points).boundary
        refs: list[tuple[str, float]] = []
        for segment in segments:
            if segment.length_m <= tolerance_m:
                continue
            line = LineString([(segment.start.x, segment.start.y), (segment.end.x, segment.end.y)])
            if boundary.distance(line) > tolerance_m:
                continue
            overlap = boundary.intersection(line).length
            if overlap > tolerance_m:
                refs.append((segment.id, float(overlap)))
        refs.sort(key=lambda item: item[1], reverse=True)
        return [segment_id for segment_id, _ in refs]

    def polygon_area(self, points: list[Point2D]) -> float:
        return float(self._polygon_geometry(points).area)

    def polygon_perimeter(self, points: list[Point2D]) -> float:
        return float(self._polygon_geometry(points).length)

    def polygon_centroid(self, points: list[Point2D]) -> Point2D:
        centroid = self._polygon_geometry(points).centroid
        return Point2D(float(centroid.x), float(centroid.y))

    def polygon_is_valid(self, points: list[Point2D]) -> bool:
        if len(points) < 3:
            return False
        polygon = self._polygon_geometry(points)
        return bool(polygon.is_valid and polygon.area > 0)

    def polygon_overlap_area(self, a: list[Point2D], b: list[Point2D]) -> float:
        return float(self._polygon_geometry(a).intersection(self._polygon_geometry(b)).area)

    def polygon_boundary_intersection_length(self, a: list[Point2D], b: list[Point2D]) -> float:
        return float(self._polygon_geometry(a).boundary.intersection(self._polygon_geometry(b).boundary).length)

    def offset_polygon_area(
        self,
        points: list[Point2D],
        offset_m: float,
        *,
        min_area_m2: float = 0.0,
    ) -> float:
        polygon = self._polygon_geometry(points)
        if abs(offset_m) < 1e-9:
            return float(polygon.area)
        buffered = polygon.buffer(offset_m, join_style=2, mitre_limit=5.0)
        if buffered.is_empty:
            return 0.0
        if buffered.geom_type == "MultiPolygon":
            buffered = max(buffered.geoms, key=lambda geom: geom.area)
        area = float(buffered.area)
        return area if area >= min_area_m2 else 0.0

    def geometry_hash(self, points: list[Point2D], level_id: str | None) -> str:
        normalized = self._canonical_ring(points)
        payload = "|".join(
            [str(level_id or "unassigned")]
            + [f"{x:.4f},{y:.4f}" for x, y in normalized]
        )
        return hashlib.sha1(payload.encode("ascii")).hexdigest()

    def _polygon_geometry(self, points: list[Point2D]) -> "BaseGeometry":
        if Polygon is None:
            raise RuntimeError("Room geometry operations require shapely to be installed")
        return Polygon([(point.x, point.y) for point in points])

    def _snap_xy(self, point: Point2D, tolerance_m: float) -> tuple[float, float]:
        if tolerance_m <= 0:
            return (float(point.x), float(point.y))
        return (
            round(float(point.x) / tolerance_m) * tolerance_m,
            round(float(point.y) / tolerance_m) * tolerance_m,
        )

    def _clean_points(self, points: list[Point2D], *, tolerance_m: float) -> list[Point2D]:
        without_duplicates: list[Point2D] = []
        for point in points:
            if without_duplicates:
                prev = without_duplicates[-1]
                if math.hypot(point.x - prev.x, point.y - prev.y) <= tolerance_m * 0.5:
                    continue
            without_duplicates.append(point)
        if len(without_duplicates) > 1:
            first = without_duplicates[0]
            last = without_duplicates[-1]
            if math.hypot(first.x - last.x, first.y - last.y) <= tolerance_m * 0.5:
                without_duplicates.pop()
        return self._remove_collinear(without_duplicates, tolerance_m=tolerance_m)

    def _remove_collinear(self, points: list[Point2D], *, tolerance_m: float) -> list[Point2D]:
        if len(points) <= 3:
            return points
        cleaned: list[Point2D] = []
        for index, point in enumerate(points):
            prev = points[index - 1]
            nxt = points[(index + 1) % len(points)]
            area2 = abs(
                (point.x - prev.x) * (nxt.y - prev.y)
                - (point.y - prev.y) * (nxt.x - prev.x)
            )
            base = math.hypot(nxt.x - prev.x, nxt.y - prev.y)
            distance = area2 / base if base else area2
            if distance > tolerance_m * 0.5:
                cleaned.append(point)
        return cleaned if len(cleaned) >= 3 else points

    def _canonical_ring(self, points: list[Point2D]) -> list[tuple[float, float]]:
        ring = [point.rounded(4) for point in points]
        if not ring:
            return []
        rotations = [ring[index:] + ring[:index] for index in range(len(ring))]
        reversed_ring = list(reversed(ring))
        rotations.extend(reversed_ring[index:] + reversed_ring[:index] for index in range(len(ring)))
        return min(rotations)


enclosed_polygon_service = EnclosedPolygonService()

