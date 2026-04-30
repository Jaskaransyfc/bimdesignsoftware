from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import math


@dataclass
class KernelResult:
    geometry: dict[str, Any]
    parameters: dict[str, Any]
    kernel: str


class GeometryKernelService:
    """
    OCCT-ready geometry service.
    - Today: provides deterministic fallback geometry for live rendering.
    - Next: replace fallback builders with pythonOCC/OCCT solid generation.
    """

    def __init__(self) -> None:
        self.kernel_name = "fallback-kernel (occt-ready)"

    def build_element_geometry(
        self,
        *,
        element_type: str,
        element_name: str | None,
        geometry: dict[str, Any] | None,
        parameters: dict[str, Any] | None,
    ) -> KernelResult:
        incoming_geometry = geometry or {}
        incoming_parameters = parameters or {}

        # Keep explicit coordinates if already provided by client.
        if "position" in incoming_geometry:
            position = incoming_geometry["position"]
        else:
            # Deterministic fallback placement from element name hash.
            seed = sum(ord(ch) for ch in (element_name or element_type))
            x = (seed % 12) - 6
            z = ((seed // 7) % 12) - 6
            y = 0.15 if element_type == "Slab" else 1.5
            position = [float(x), float(y), float(z)]

        normalized_geometry = {**incoming_geometry, "position": position}
        normalized_parameters = {
            **incoming_parameters,
            "geometry_kernel": self.kernel_name,
            "occt_enabled": False,
        }
        normalized_geometry, normalized_parameters = self._apply_parametric_defaults(
            element_type=element_type,
            geometry=normalized_geometry,
            parameters=normalized_parameters,
        )
        return KernelResult(
            geometry=normalized_geometry,
            parameters=normalized_parameters,
            kernel=self.kernel_name,
        )

    def update_opening_from_wall(
        self,
        *,
        wall_geometry: dict[str, Any] | None,
        wall_parameters: dict[str, Any] | None,
        opening_geometry: dict[str, Any] | None,
        opening_parameters: dict[str, Any] | None,
    ) -> KernelResult:
        wall_geometry = wall_geometry or {}
        wall_parameters = wall_parameters or {}
        opening_geometry = opening_geometry or {}
        opening_parameters = opening_parameters or {}

        wall_start = wall_geometry.get("start") or wall_parameters.get("start") or [0.0, 0.0, 0.0]
        wall_end = wall_geometry.get("end") or wall_parameters.get("end") or [3.0, 0.0, 0.0]
        dx = float(wall_end[0]) - float(wall_start[0])
        dz = float(wall_end[2]) - float(wall_start[2])
        length = math.hypot(dx, dz) or 0.001
        ux = dx / length
        uz = dz / length
        wall_height = float(wall_parameters.get("height", 3.0))
        wall_thickness = float(wall_parameters.get("thickness", 0.2))

        offset_raw = float(opening_parameters.get("offset", length * 0.5))
        half_width = float(opening_parameters.get("width", 1.0)) * 0.5
        offset = max(half_width, min(length - half_width, offset_raw))
        center_x = float(wall_start[0]) + ux * offset
        center_z = float(wall_start[2]) + uz * offset

        height = float(opening_parameters.get("height", 2.1))
        sill_height = float(opening_parameters.get("sill_height", 0.0))
        max_sill = max(0.0, wall_height - height)
        sill_height = max(0.0, min(max_sill, sill_height))
        center_y = sill_height + height * 0.5

        thickness = float(opening_parameters.get("thickness", wall_thickness * 0.8))
        rotation_y = math.atan2(uz, ux)

        normalized_geometry = {
            **opening_geometry,
            "position": [center_x, center_y, center_z],
            "rotationY": rotation_y,
        }
        normalized_parameters = {
            **opening_parameters,
            "offset": offset,
            "sill_height": sill_height,
            "thickness": thickness,
            "wall_thickness": wall_thickness,
        }
        return KernelResult(
            geometry=normalized_geometry,
            parameters=normalized_parameters,
            kernel=self.kernel_name,
        )

    def _apply_parametric_defaults(
        self,
        *,
        element_type: str,
        geometry: dict[str, Any],
        parameters: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        et = (element_type or "").lower()
        if et == "wall":
            return self._normalize_wall(geometry, parameters)
        if et in {"door", "window", "opening"}:
            return self._normalize_opening_like(et, geometry, parameters)
        return self._normalize_generic(et, geometry, parameters)

    def _normalize_wall(
        self, geometry: dict[str, Any], parameters: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        start = geometry.get("start") or parameters.get("start") or [0.0, 0.0, 0.0]
        end = geometry.get("end") or parameters.get("end") or [3.0, 0.0, 0.0]
        height = float(parameters.get("height", 3.0))
        thickness = float(parameters.get("thickness", 0.2))
        dx = float(end[0]) - float(start[0])
        dz = float(end[2]) - float(start[2])
        length = max(0.1, math.hypot(dx, dz))
        mid_x = (float(start[0]) + float(end[0])) * 0.5
        mid_z = (float(start[2]) + float(end[2])) * 0.5
        rotation_y = math.atan2(dz, dx)
        normalized_geometry = {
            **geometry,
            "start": [float(start[0]), float(start[1]), float(start[2])],
            "end": [float(end[0]), float(end[1]), float(end[2])],
            "position": [mid_x, height * 0.5, mid_z],
            "rotationY": rotation_y,
        }
        normalized_parameters = {
            **parameters,
            "start": normalized_geometry["start"],
            "end": normalized_geometry["end"],
            "height": height,
            "thickness": thickness,
            "length": length,
        }
        return normalized_geometry, normalized_parameters

    def _normalize_opening_like(
        self,
        element_type: str,
        geometry: dict[str, Any],
        parameters: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        defaults = {
            "door": {"width": 1.0, "height": 2.1, "thickness": 0.12, "sill_height": 0.0},
            "window": {"width": 1.2, "height": 1.2, "thickness": 0.12, "sill_height": 1.0},
            "opening": {"width": 1.0, "height": 1.0, "thickness": 0.12, "sill_height": 0.0},
        }[element_type]
        width = float(parameters.get("width", defaults["width"]))
        height = float(parameters.get("height", defaults["height"]))
        thickness = float(parameters.get("thickness", defaults["thickness"]))
        sill_height = float(parameters.get("sill_height", defaults["sill_height"]))
        pos = geometry.get("position") or [0.0, sill_height + height * 0.5, 0.0]
        normalized_geometry = {
            **geometry,
            "position": [float(pos[0]), float(pos[1]), float(pos[2])],
            "rotationY": float(geometry.get("rotationY", 0.0)),
        }
        normalized_parameters = {
            **parameters,
            "width": width,
            "height": height,
            "thickness": thickness,
            "sill_height": sill_height,
        }
        return normalized_geometry, normalized_parameters

    def _normalize_generic(
        self, element_type: str, geometry: dict[str, Any], parameters: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        default_dims = {
            "column": (0.4, 3.0, 0.4),
            "slab": (4.0, 0.3, 4.0),
            "beam": (3.0, 0.35, 0.35),
            "room": (4.0, 2.7, 4.0),
            "grid": (0.05, 0.05, 5.0),
            "level": (5.0, 0.05, 0.05),
        }.get(element_type, (3.0, 3.0, 0.23))
        width = float(parameters.get("width", default_dims[0]))
        height = float(parameters.get("height", default_dims[1]))
        depth = float(parameters.get("depth", default_dims[2]))
        normalized_parameters = {
            **parameters,
            "width": width,
            "height": height,
            "depth": depth,
        }
        return geometry, normalized_parameters


geometry_kernel_service = GeometryKernelService()
