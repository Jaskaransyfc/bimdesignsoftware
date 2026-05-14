from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .area_calculation_service import RoomAreaResult
from .enclosed_polygon_service import BoundarySegment


@dataclass
class RoomVolumeResult:
    height_m: float
    volume_m3: float
    source: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "height_m": round(self.height_m, 4),
            "volume_m3": round(self.volume_m3, 4),
            "source": self.source,
            "metadata": self.metadata,
        }


class RoomVolumeService:
    """Room volume calculations prepared for HVAC/load systems."""

    def calculate(
        self,
        *,
        area: RoomAreaResult,
        boundary_refs: list[dict[str, Any]],
        segments: list[BoundarySegment],
        level: Any | None = None,
        explicit_height_m: float | None = None,
    ) -> RoomVolumeResult:
        height, source = self._resolve_height(
            boundary_refs=boundary_refs,
            segments=segments,
            level=level,
            explicit_height_m=explicit_height_m,
        )
        return RoomVolumeResult(
            height_m=height,
            volume_m3=area.net_usable_area_m2 * height,
            source=source,
            metadata={
                "sloped_ceiling_ready": True,
                "double_height_ready": True,
                "hvac_load_ready": True,
            },
        )

    def _resolve_height(
        self,
        *,
        boundary_refs: list[dict[str, Any]],
        segments: list[BoundarySegment],
        level: Any | None,
        explicit_height_m: float | None,
    ) -> tuple[float, str]:
        if explicit_height_m and explicit_height_m > 0:
            return float(explicit_height_m), "room_override"

        ref_ids = {ref.get("segment_id") for ref in boundary_refs}
        wall_heights = [
            float(segment.height_m)
            for segment in segments
            if segment.id in ref_ids and segment.height_m and segment.height_m > 0
        ]
        if wall_heights:
            return min(wall_heights), "boundary_wall_height"

        if level is not None:
            floor_height = getattr(level, "floor_height_m", None)
            if floor_height and float(floor_height) > 0:
                return float(floor_height), "level_floor_height"

        return 3.0, "default_floor_height"


room_volume_service = RoomVolumeService()

