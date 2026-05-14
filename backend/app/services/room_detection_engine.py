from __future__ import annotations

from typing import Any

from .area_calculation_service import area_calculation_service
from .area_scheme_service import area_scheme_service
from .enclosed_polygon_service import BoundarySegment, EnclosedPolygon, enclosed_polygon_service
from .room_boundary_service import CANVAS_UNIT_TO_M, room_boundary_service
from .room_validation_service import room_validation_service
from .room_volume_service import room_volume_service


class RoomDetectionEngine:
    """Orchestrates CB-05 spatial room intelligence."""

    schema_version = "CB-05"

    def detect_rooms(
        self,
        *,
        project_id: str,
        drawing_elements: list[dict[str, Any]] | None = None,
        model_elements: list[Any] | None = None,
        levels: list[Any] | None = None,
        area_scheme: str = "usable_area",
    ) -> dict[str, Any]:
        drawing_elements = drawing_elements or []
        levels = levels or []
        level_by_id = {getattr(level, "id", None): level for level in levels}
        level_order = {
            getattr(level, "id", None): index + 1
            for index, level in enumerate(sorted(levels, key=lambda item: float(getattr(item, "order", 0) or 0)))
        }
        existing_by_hash = self._existing_rooms_by_hash(drawing_elements)
        extraction = room_boundary_service.extract(
            drawing_elements=drawing_elements,
            model_elements=model_elements or [],
        )

        rooms: list[dict[str, Any]] = []
        polygons: list[EnclosedPolygon] = []
        grouped_segments = room_boundary_service.group_by_level(extraction.segments)
        selected_scheme = area_scheme_service.get_scheme(area_scheme)

        for level_id, segments in sorted(grouped_segments.items(), key=lambda item: str(item[0] or "")):
            level_polygons = enclosed_polygon_service.polygonize_segments(
                segments,
                level_id=level_id,
            )
            polygons.extend(level_polygons)
            for index, polygon in enumerate(level_polygons, start=1):
                boundary_refs = room_boundary_service.boundary_references(polygon, segments)
                avg_thickness = room_boundary_service.average_wall_thickness(boundary_refs, segments)
                area_result = area_calculation_service.calculate(
                    polygon,
                    selected_scheme_code=selected_scheme.code,
                    average_wall_thickness_m=avg_thickness,
                )
                level = level_by_id.get(level_id)
                volume_result = room_volume_service.calculate(
                    area=area_result,
                    boundary_refs=boundary_refs,
                    segments=segments,
                    level=level,
                    explicit_height_m=None,
                )
                existing = existing_by_hash.get(polygon.geometry_hash, {})
                room = self._room_payload(
                    project_id=project_id,
                    polygon=polygon,
                    index=index,
                    level_order=level_order.get(level_id, 1),
                    level=level,
                    existing=existing,
                    boundary_refs=boundary_refs,
                    area_result=area_result.to_dict(),
                    volume_result=volume_result.to_dict(),
                    area_scheme=selected_scheme.code,
                )
                rooms.append(room)

        adjacency = self._build_adjacency(polygons, rooms)
        for room in rooms:
            adjacent = adjacency.get(room["id"], [])
            room.setdefault("relationships", {})["adjacent_rooms"] = adjacent
            room["metadata"]["cb05"]["adjacent_room_ids"] = adjacent

        issues = room_validation_service.validate(
            rooms=rooms,
            polygons=polygons,
            segments=extraction.segments,
        )
        issue_dicts = [issue.to_dict() for issue in issues]
        self._attach_issue_metadata(rooms, issue_dicts)

        return {
            "schema_version": self.schema_version,
            "project_id": project_id,
            "area_scheme": selected_scheme.to_dict(),
            "rooms": rooms,
            "issues": issue_dicts,
            "summary": {
                "detected_rooms": len(rooms),
                "boundary_segments": len(extraction.segments),
                "openings": len(extraction.openings),
                "columns": len(extraction.columns),
                "slabs": len(extraction.slabs),
                "ceilings": len(extraction.ceilings),
                "levels": len(grouped_segments),
                "total_area_m2": round(sum(float(room["properties"]["area"] or 0) for room in rooms), 4),
                "total_volume_m3": round(sum(float(room["properties"]["volume"] or 0) for room in rooms), 4),
            },
        }

    def merge_generated_rooms(
        self,
        source_elements: list[dict[str, Any]],
        generated_rooms: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        preserved = [
            element
            for element in source_elements
            if not self._is_cb05_generated_room(element)
        ]
        return preserved + generated_rooms

    def drawing_elements(self, drawing: Any) -> list[dict[str, Any]]:
        if isinstance(drawing, list):
            return [item for item in drawing if isinstance(item, dict)]
        if isinstance(drawing, dict):
            items = drawing.get("elements") or drawing.get("items") or []
            return [item for item in items if isinstance(item, dict)]
        return []

    def _room_payload(
        self,
        *,
        project_id: str,
        polygon: EnclosedPolygon,
        index: int,
        level_order: int,
        level: Any | None,
        existing: dict[str, Any],
        boundary_refs: list[dict[str, Any]],
        area_result: dict[str, Any],
        volume_result: dict[str, Any],
        area_scheme: str,
    ) -> dict[str, Any]:
        room_id = existing.get("id") or f"room_auto_{polygon.geometry_hash[:12]}"
        room_number = (
            existing.get("roomNumber")
            or existing.get("number")
            or self._metadata_cb05(existing).get("room_number")
            or f"{level_order:02d}-{index:03d}"
        )
        name = existing.get("name") or f"Room {room_number}"
        room_type = existing.get("roomType") or self._metadata_cb05(existing).get("room_type") or "Space"
        height_mm = round(float(volume_result["height_m"]) * 1000)
        vertices = [
            {
                "x": round(point.x / CANVAS_UNIT_TO_M, 4),
                "y": round(point.y / CANVAS_UNIT_TO_M, 4),
            }
            for point in polygon.points
        ]
        centroid_canvas = {
            "x": round(polygon.centroid.x / CANVAS_UNIT_TO_M, 4),
            "y": round(polygon.centroid.y / CANVAS_UNIT_TO_M, 4),
        }
        source_ids = sorted({str(ref.get("source_id")) for ref in boundary_refs if ref.get("source_id")})

        return {
            "id": room_id,
            "type": "room",
            "name": name,
            "roomNumber": room_number,
            "roomType": room_type,
            "vertices": vertices,
            "height": height_mm,
            "levelId": polygon.level_id,
            "floorMaterial": existing.get("floorMaterial") or "By Area Scheme",
            "ceilingMaterial": existing.get("ceilingMaterial") or "By Level",
            "properties": {
                "area": area_result["selected_area_m2"],
                "grossArea": area_result["gross_area_m2"],
                "netUsableArea": area_result["net_usable_area_m2"],
                "carpetArea": area_result["carpet_area_m2"],
                "builtUpArea": area_result["built_up_area_m2"],
                "perimeter": area_result["perimeter_m"],
                "volume": volume_result["volume_m3"],
                "heightM": volume_result["height_m"],
                "schemeAreas": area_result["scheme_areas_m2"],
                "averageWallThicknessM": area_result["average_wall_thickness_m"],
            },
            "metadata": {
                **(existing.get("metadata") if isinstance(existing.get("metadata"), dict) else {}),
                "cb05": {
                    "schema_version": self.schema_version,
                    "generated": True,
                    "project_id": project_id,
                    "geometry_hash": polygon.geometry_hash,
                    "level_id": polygon.level_id,
                    "level_name": getattr(level, "name", None) if level else None,
                    "room_number": room_number,
                    "room_type": room_type,
                    "centroid_m": {"x": round(polygon.centroid.x, 4), "y": round(polygon.centroid.y, 4)},
                    "centroid": centroid_canvas,
                    "boundary_refs": boundary_refs,
                    "source_element_ids": source_ids,
                    "area_scheme": area_scheme,
                    "volume_source": volume_result["source"],
                    "space_intelligence": {
                        "ifc_class": "IfcSpace",
                        "mep_zone_ready": True,
                        "occupancy_ready": True,
                        "fire_zone_ready": True,
                        "ai_space_ready": True,
                    },
                },
            },
            "relationships": {
                "boundaries": source_ids,
                "level_id": polygon.level_id,
            },
        }

    def _build_adjacency(
        self,
        polygons: list[EnclosedPolygon],
        rooms: list[dict[str, Any]],
    ) -> dict[str, list[str]]:
        hash_to_room_id = {
            self._metadata_cb05(room).get("geometry_hash"): room["id"]
            for room in rooms
        }
        adjacency: dict[str, set[str]] = {room["id"]: set() for room in rooms}
        for index, polygon in enumerate(polygons):
            for other_index in range(index + 1, len(polygons)):
                other = polygons[other_index]
                if polygon.level_id != other.level_id:
                    continue
                shared = enclosed_polygon_service.polygon_boundary_intersection_length(
                    polygon.points,
                    other.points,
                )
                if shared <= 0.05:
                    continue
                room_id = hash_to_room_id.get(polygon.geometry_hash)
                other_room_id = hash_to_room_id.get(other.geometry_hash)
                if not room_id or not other_room_id:
                    continue
                adjacency[room_id].add(other_room_id)
                adjacency[other_room_id].add(room_id)
        return {room_id: sorted(values) for room_id, values in adjacency.items()}

    def _attach_issue_metadata(self, rooms: list[dict[str, Any]], issues: list[dict[str, Any]]) -> None:
        by_room: dict[str, list[dict[str, Any]]] = {}
        for issue in issues:
            room_id = issue.get("room_id")
            if room_id:
                by_room.setdefault(str(room_id), []).append(issue)
        for room in rooms:
            room_issues = by_room.get(room["id"], [])
            highest = "ok"
            if any(issue.get("severity") == "error" for issue in room_issues):
                highest = "error"
            elif any(issue.get("severity") == "warning" for issue in room_issues):
                highest = "warning"
            room["metadata"]["cb05"]["validation_status"] = highest
            room["metadata"]["cb05"]["validation_issues"] = room_issues

    def _existing_rooms_by_hash(self, elements: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for element in elements:
            if str(element.get("type")).lower() != "room":
                continue
            geometry_hash = self._metadata_cb05(element).get("geometry_hash")
            if geometry_hash:
                result[str(geometry_hash)] = element
        return result

    def _is_cb05_generated_room(self, element: dict[str, Any]) -> bool:
        if str(element.get("type")).lower() != "room":
            return False
        cb05 = self._metadata_cb05(element)
        return cb05.get("schema_version") == self.schema_version and cb05.get("generated") is True

    def _metadata_cb05(self, element: dict[str, Any]) -> dict[str, Any]:
        metadata = element.get("metadata") if isinstance(element.get("metadata"), dict) else {}
        cb05 = metadata.get("cb05") if isinstance(metadata.get("cb05"), dict) else {}
        return cb05


room_detection_engine = RoomDetectionEngine()

