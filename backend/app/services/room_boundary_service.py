from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any

from .enclosed_polygon_service import BoundarySegment, EnclosedPolygon, Point2D, enclosed_polygon_service

CANVAS_UNIT_TO_M = 0.05


@dataclass
class BoundaryExtractionResult:
    segments: list[BoundarySegment] = field(default_factory=list)
    openings: list[dict[str, Any]] = field(default_factory=list)
    columns: list[dict[str, Any]] = field(default_factory=list)
    slabs: list[dict[str, Any]] = field(default_factory=list)
    ceilings: list[dict[str, Any]] = field(default_factory=list)


class RoomBoundaryService:
    """Extract room-bounding 2D geometry from drawing JSON and model elements."""

    def extract(
        self,
        *,
        drawing_elements: list[dict[str, Any]] | None = None,
        model_elements: list[Any] | None = None,
    ) -> BoundaryExtractionResult:
        result = BoundaryExtractionResult()
        counter = itertools.count(1)
        for element in drawing_elements or []:
            self._extract_drawing_element(element, result, counter)
        for element in model_elements or []:
            self._extract_model_element(element, result, counter)
        return result

    def group_by_level(self, segments: list[BoundarySegment]) -> dict[str | None, list[BoundarySegment]]:
        grouped: dict[str | None, list[BoundarySegment]] = {}
        for segment in segments:
            grouped.setdefault(segment.level_id, []).append(segment)
        return grouped

    def boundary_references(
        self,
        polygon: EnclosedPolygon,
        segments: list[BoundarySegment],
        *,
        tolerance_m: float = 0.025,
    ) -> list[dict[str, Any]]:
        boundary_ids = enclosed_polygon_service.boundary_segment_ids(
            polygon,
            segments,
            tolerance_m=tolerance_m,
        )
        by_id = {segment.id: segment for segment in segments}
        references: list[dict[str, Any]] = []
        for segment_id in boundary_ids:
            segment = by_id.get(segment_id)
            if not segment:
                continue
            references.append(
                {
                    "segment_id": segment.id,
                    "source_id": segment.source_id,
                    "source_type": segment.source_type,
                    "boundary_kind": segment.boundary_kind,
                    "thickness_m": round(float(segment.thickness_m or 0.0), 4),
                    "height_m": round(float(segment.height_m), 4) if segment.height_m else None,
                }
            )
        return references

    def average_wall_thickness(
        self,
        boundary_refs: list[dict[str, Any]],
        segments: list[BoundarySegment],
    ) -> float:
        ref_ids = {ref.get("segment_id") for ref in boundary_refs}
        values = [
            segment.thickness_m
            for segment in segments
            if segment.id in ref_ids and segment.thickness_m > 0
        ]
        if not values:
            values = [segment.thickness_m for segment in segments if segment.thickness_m > 0]
        return sum(values) / len(values) if values else 0.0

    def _extract_drawing_element(
        self,
        element: dict[str, Any],
        result: BoundaryExtractionResult,
        counter: Any,
    ) -> None:
        element_type = str(element.get("type") or "").lower()
        metadata = element.get("metadata") if isinstance(element.get("metadata"), dict) else {}
        cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
        if cb05.get("generated"):
            return
        level_id = self._level_id(element)
        source_id = str(element.get("id") or f"drawing_{next(counter)}")

        if element_type == "wall":
            start = element.get("startPoint")
            end = element.get("endPoint")
            if not self._valid_point(start) or not self._valid_point(end):
                return
            if self._room_bounding(element, metadata):
                result.segments.append(
                    BoundarySegment(
                        id=f"seg_{next(counter)}",
                        source_id=source_id,
                        source_type="wall",
                        level_id=level_id,
                        start=self._canvas_point(start),
                        end=self._canvas_point(end),
                        thickness_m=self._mm_to_m(element.get("thickness"), 230.0),
                        height_m=self._mm_to_m(element.get("height"), 3000.0),
                        boundary_kind=str(metadata.get("boundary_kind") or "wall"),
                        metadata=metadata,
                    )
                )
            return

        if element_type in {"door", "window", "opening"}:
            result.openings.append({"id": source_id, "type": element_type, "level_id": level_id, **element})
            return

        if element_type in {"floor", "slab"}:
            result.slabs.append({"id": source_id, "level_id": level_id, **element})
            return

        if element_type in {"roof", "ceiling"}:
            result.ceilings.append({"id": source_id, "level_id": level_id, **element})
            return

        if element_type == "polyline":
            if not self._polyline_is_room_boundary(element, metadata):
                return
            points = element.get("points") or []
            for index in range(0, max(0, len(points) - 2), 2):
                start = {"x": points[index], "y": points[index + 1]}
                end = {"x": points[index + 2], "y": points[index + 3]}
                result.segments.append(
                    BoundarySegment(
                        id=f"seg_{next(counter)}",
                        source_id=source_id,
                        source_type="room_separator",
                        level_id=level_id,
                        start=self._canvas_point(start),
                        end=self._canvas_point(end),
                        boundary_kind="room_separator",
                        thickness_m=0.0,
                        metadata=metadata,
                    )
                )
            return

        if element_type in {"line", "room_separator", "room_separation", "area_boundary", "boundary_line"}:
            if element_type == "line" and not self._polyline_is_room_boundary(element, metadata):
                return
            start = element.get("startPoint") or element.get("start")
            end = element.get("endPoint") or element.get("end")
            if not self._valid_point(start) or not self._valid_point(end):
                return
            result.segments.append(
                BoundarySegment(
                    id=f"seg_{next(counter)}",
                    source_id=source_id,
                    source_type=element_type,
                    level_id=level_id,
                    start=self._canvas_point(start),
                    end=self._canvas_point(end),
                    boundary_kind="room_separator" if "separator" in element_type else "area_boundary",
                    thickness_m=0.0,
                    metadata=metadata,
                )
            )

    def _extract_model_element(
        self,
        element: Any,
        result: BoundaryExtractionResult,
        counter: Any,
    ) -> None:
        element_type = self._model_type(element).lower()
        geometry = getattr(element, "geometry", None) or {}
        parameters = getattr(element, "parameters", None) or {}
        metadata = getattr(element, "metadata_json", None) or {}
        level_id = getattr(element, "level_id", None) or parameters.get("level_id")
        source_id = str(getattr(element, "id", None) or f"model_{next(counter)}")

        if element_type == "wall":
            start = geometry.get("start") or parameters.get("start")
            end = geometry.get("end") or parameters.get("end")
            if not self._valid_xyz(start) or not self._valid_xyz(end):
                return
            result.segments.append(
                BoundarySegment(
                    id=f"seg_{next(counter)}",
                    source_id=source_id,
                    source_type="model_wall",
                    level_id=level_id,
                    start=Point2D(float(start[0]), float(start[2])),
                    end=Point2D(float(end[0]), float(end[2])),
                    thickness_m=float(parameters.get("thickness") or getattr(element, "thickness", None) or 0.2),
                    height_m=float(parameters.get("height") or getattr(element, "height", None) or 3.0),
                    boundary_kind="wall",
                    metadata=metadata,
                )
            )
        elif element_type in {"door", "window", "opening"}:
            result.openings.append({"id": source_id, "type": element_type, "level_id": level_id})
        elif element_type == "column":
            result.columns.append({"id": source_id, "type": element_type, "level_id": level_id})
        elif element_type in {"slab", "floor"}:
            result.slabs.append({"id": source_id, "type": element_type, "level_id": level_id})
        elif element_type in {"ceiling", "roof"}:
            result.ceilings.append({"id": source_id, "type": element_type, "level_id": level_id})

    def _room_bounding(self, element: dict[str, Any], metadata: dict[str, Any]) -> bool:
        cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
        if cb05.get("room_bounding") is False:
            return False
        if metadata.get("room_bounding") is False:
            return False
        return element.get("roomBounding", True) is not False

    def _polyline_is_room_boundary(self, element: dict[str, Any], metadata: dict[str, Any]) -> bool:
        cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
        flags = {
            cb05.get("room_boundary"),
            cb05.get("area_boundary"),
            metadata.get("room_boundary"),
            metadata.get("area_boundary"),
            metadata.get("roomSeparator"),
            element.get("roomBoundary"),
        }
        if any(value is True for value in flags):
            return True
        boundary_type = str(metadata.get("boundary_type") or metadata.get("kind") or "").lower()
        return boundary_type in {"room_separator", "room_boundary", "area_boundary"}

    def _level_id(self, element: dict[str, Any]) -> str | None:
        metadata = element.get("metadata") if isinstance(element.get("metadata"), dict) else {}
        cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
        return (
            element.get("levelId")
            or element.get("level_id")
            or metadata.get("level_id")
            or cb05.get("level_id")
        )

    def _model_type(self, element: Any) -> str:
        value = getattr(element, "type", None)
        if hasattr(value, "value"):
            return str(value.value)
        return str(value or "Custom")

    def _canvas_point(self, point: dict[str, Any]) -> Point2D:
        return Point2D(float(point["x"]) * CANVAS_UNIT_TO_M, float(point["y"]) * CANVAS_UNIT_TO_M)

    def _valid_point(self, point: Any) -> bool:
        return isinstance(point, dict) and point.get("x") is not None and point.get("y") is not None

    def _valid_xyz(self, point: Any) -> bool:
        return isinstance(point, (list, tuple)) and len(point) >= 3

    def _mm_to_m(self, value: Any, default_mm: float) -> float:
        try:
            return float(value) / 1000.0
        except (TypeError, ValueError):
            return default_mm / 1000.0


room_boundary_service = RoomBoundaryService()
