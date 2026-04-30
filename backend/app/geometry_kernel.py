from __future__ import annotations

from dataclasses import dataclass
from typing import Any


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

        normalized_geometry = {
            **incoming_geometry,
            "position": position,
        }
        normalized_parameters = {
            **incoming_parameters,
            "geometry_kernel": self.kernel_name,
            "occt_enabled": False,
        }
        return KernelResult(
            geometry=normalized_geometry,
            parameters=normalized_parameters,
            kernel=self.kernel_name,
        )


geometry_kernel_service = GeometryKernelService()
