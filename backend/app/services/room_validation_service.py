from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .enclosed_polygon_service import BoundarySegment, EnclosedPolygon, enclosed_polygon_service


@dataclass
class RoomValidationIssue:
    code: str
    severity: str
    message: str
    room_id: str | None = None
    element_id: str | None = None
    level_id: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RoomValidationService:
    """QA checks for BIM room/space intelligence."""

    def validate(
        self,
        *,
        rooms: list[dict[str, Any]],
        polygons: list[EnclosedPolygon],
        segments: list[BoundarySegment],
    ) -> list[RoomValidationIssue]:
        issues: list[RoomValidationIssue] = []
        issues.extend(self._validate_room_geometry(rooms, polygons))
        issues.extend(self._validate_overlaps(rooms, polygons))
        issues.extend(self._validate_duplicate_rooms(rooms))
        issues.extend(self._validate_unbounded_network(segments))
        return issues

    def _validate_room_geometry(
        self,
        rooms: list[dict[str, Any]],
        polygons: list[EnclosedPolygon],
    ) -> list[RoomValidationIssue]:
        issues: list[RoomValidationIssue] = []
        by_hash = {
            polygon.geometry_hash: polygon
            for polygon in polygons
        }
        for room in rooms:
            metadata = room.get("metadata") if isinstance(room.get("metadata"), dict) else {}
            cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
            polygon = by_hash.get(str(cb05.get("geometry_hash") or ""))
            if not polygon:
                issues.append(
                    RoomValidationIssue(
                        code="room_polygon_missing",
                        severity="error",
                        room_id=room.get("id"),
                        level_id=room.get("levelId"),
                        message="Room is missing a resolved boundary polygon.",
                    )
                )
                continue
            if not enclosed_polygon_service.polygon_is_valid(polygon.points):
                issues.append(
                    RoomValidationIssue(
                        code="invalid_room_polygon",
                        severity="error",
                        room_id=room.get("id"),
                        level_id=room.get("levelId"),
                        message="Room boundary polygon is invalid or self-intersecting.",
                    )
                )
            if polygon.area_m2 < 0.35:
                issues.append(
                    RoomValidationIssue(
                        code="room_area_too_small",
                        severity="warning",
                        room_id=room.get("id"),
                        level_id=room.get("levelId"),
                        message="Detected room area is below the minimum usable threshold.",
                        metadata={"area_m2": polygon.area_m2},
                    )
                )
            boundary_refs = cb05.get("boundary_refs") or []
            if len(boundary_refs) < 3:
                issues.append(
                    RoomValidationIssue(
                        code="insufficient_boundary_refs",
                        severity="warning",
                        room_id=room.get("id"),
                        level_id=room.get("levelId"),
                        message="Room has fewer than three source boundary references.",
                    )
                )
        return issues

    def _validate_overlaps(
        self,
        rooms: list[dict[str, Any]],
        polygons: list[EnclosedPolygon],
    ) -> list[RoomValidationIssue]:
        issues: list[RoomValidationIssue] = []
        for index, polygon in enumerate(polygons):
            for other_index in range(index + 1, len(polygons)):
                other = polygons[other_index]
                if polygon.level_id != other.level_id:
                    continue
                overlap = enclosed_polygon_service.polygon_overlap_area(polygon.points, other.points)
                if overlap > 0.05:
                    issues.append(
                        RoomValidationIssue(
                            code="overlapping_rooms",
                            severity="error",
                            room_id=self._room_id_for_hash(rooms, polygon.geometry_hash),
                            level_id=polygon.level_id,
                            message="Detected room overlaps another room on the same level.",
                            metadata={
                                "overlap_m2": round(overlap, 4),
                                "other_room_id": self._room_id_for_hash(rooms, other.geometry_hash),
                            },
                        )
                    )
        return issues

    def _validate_duplicate_rooms(self, rooms: list[dict[str, Any]]) -> list[RoomValidationIssue]:
        issues: list[RoomValidationIssue] = []
        seen: dict[str, str] = {}
        for room in rooms:
            metadata = room.get("metadata") if isinstance(room.get("metadata"), dict) else {}
            cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
            key = str(cb05.get("geometry_hash") or "")
            if not key:
                continue
            if key in seen:
                issues.append(
                    RoomValidationIssue(
                        code="duplicate_room",
                        severity="error",
                        room_id=room.get("id"),
                        level_id=room.get("levelId"),
                        message="Duplicate room detected for the same boundary loop.",
                        metadata={"original_room_id": seen[key]},
                    )
                )
            seen[key] = str(room.get("id"))
        return issues

    def _validate_unbounded_network(self, segments: list[BoundarySegment]) -> list[RoomValidationIssue]:
        dangling: list[tuple[BoundarySegment, float, float]] = []
        for segment in segments:
            for point in (segment.start, segment.end):
                if not self._point_connects_to_other_segment(segment, point.x, point.y, segments):
                    dangling.append((segment, point.x, point.y))
        issues: list[RoomValidationIssue] = []
        for segment, x_m, y_m in dangling[:20]:
            issues.append(
                RoomValidationIssue(
                    code="dangling_room_boundary",
                    severity="warning",
                    element_id=segment.source_id,
                    level_id=segment.level_id,
                    message="Room boundary endpoint is not connected to another boundary.",
                    metadata={"x_m": round(x_m, 2), "y_m": round(y_m, 2)},
                )
            )
        return issues

    def _point_connects_to_other_segment(
        self,
        segment: BoundarySegment,
        x_m: float,
        y_m: float,
        segments: list[BoundarySegment],
        *,
        tolerance_m: float = 0.035,
    ) -> bool:
        for other in segments:
            if other.id == segment.id or other.level_id != segment.level_id:
                continue
            if self._point_to_segment_distance(x_m, y_m, other) <= tolerance_m:
                return True
        return False

    def _point_to_segment_distance(self, x_m: float, y_m: float, segment: BoundarySegment) -> float:
        ax, ay = segment.start.x, segment.start.y
        bx, by = segment.end.x, segment.end.y
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        if length2 <= 1e-12:
            return ((x_m - ax) ** 2 + (y_m - ay) ** 2) ** 0.5
        t = max(0.0, min(1.0, ((x_m - ax) * dx + (y_m - ay) * dy) / length2))
        px = ax + t * dx
        py = ay + t * dy
        return ((x_m - px) ** 2 + (y_m - py) ** 2) ** 0.5

    def _room_id_for_hash(self, rooms: list[dict[str, Any]], geometry_hash: str) -> str | None:
        for room in rooms:
            metadata = room.get("metadata") if isinstance(room.get("metadata"), dict) else {}
            cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
            if cb05.get("geometry_hash") == geometry_hash:
                return str(room.get("id"))
        return None


room_validation_service = RoomValidationService()
