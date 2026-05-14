from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .enclosed_polygon_service import Point2D, enclosed_polygon_service


@dataclass(frozen=True)
class AreaScheme:
    code: str
    name: str
    boundary_rule: str
    description: str
    offset_m: float = 0.0
    multiplier: float = 1.0
    standard: str = "platform"
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AreaSchemeService:
    """Registry for BIM-style area boundary rules."""

    DEFAULT_SCHEMES: tuple[AreaScheme, ...] = (
        AreaScheme(
            code="gross_area",
            name="Gross Area",
            boundary_rule="wall_centerline",
            description="Area measured to wall centerlines.",
        ),
        AreaScheme(
            code="usable_area",
            name="Usable Area",
            boundary_rule="inner_face",
            description="Area measured to the inside face of room-bounding walls.",
        ),
        AreaScheme(
            code="carpet_area",
            name="Carpet Area",
            boundary_rule="finish_face",
            description="Usable floor area after nominal finish allowance.",
            offset_m=-0.012,
            standard="india-ready",
        ),
        AreaScheme(
            code="built_up_area",
            name="Built-up Area",
            boundary_rule="outer_face",
            description="Area expanded to outside face of enclosing walls.",
        ),
        AreaScheme(
            code="rentable_area",
            name="Rentable Area",
            boundary_rule="wall_centerline",
            description="Commercial rentable area with configurable gross-up factor.",
            multiplier=1.05,
        ),
        AreaScheme(
            code="departmental_area",
            name="Departmental Area",
            boundary_rule="wall_centerline",
            description="Department planning area by enclosed room loop.",
        ),
        AreaScheme(
            code="fire_zone_area",
            name="Fire Zone Area",
            boundary_rule="outer_face",
            description="Fire-zone-ready area using outer enclosure rule.",
            standard="nbc-ready",
        ),
        AreaScheme(
            code="occupancy_area",
            name="Occupancy Area",
            boundary_rule="inner_face",
            description="Occupancy/load calculations measured to usable boundary.",
            standard="nbc-ready",
        ),
    )

    def __init__(self) -> None:
        self._schemes = {scheme.code: scheme for scheme in self.DEFAULT_SCHEMES}

    def list_schemes(self) -> list[dict[str, Any]]:
        return [scheme.to_dict() for scheme in self.DEFAULT_SCHEMES]

    def get_scheme(self, code: str | None) -> AreaScheme:
        if not code:
            return self._schemes["usable_area"]
        return self._schemes.get(code, self._schemes["usable_area"])

    def calculate_area(
        self,
        points: list[Point2D],
        *,
        scheme_code: str,
        average_wall_thickness_m: float = 0.0,
    ) -> float:
        scheme = self.get_scheme(scheme_code)
        offset = self._rule_offset_m(scheme, average_wall_thickness_m)
        area = enclosed_polygon_service.offset_polygon_area(points, offset)
        return max(0.0, area * float(scheme.multiplier or 1.0))

    def _rule_offset_m(self, scheme: AreaScheme, average_wall_thickness_m: float) -> float:
        half_wall = max(0.0, average_wall_thickness_m) * 0.5
        if scheme.boundary_rule == "wall_centerline":
            base = 0.0
        elif scheme.boundary_rule == "inner_face":
            base = -half_wall
        elif scheme.boundary_rule == "finish_face":
            base = -half_wall
        elif scheme.boundary_rule == "outer_face":
            base = half_wall
        elif scheme.boundary_rule == "custom_offset":
            base = 0.0
        else:
            base = 0.0
        return base + float(scheme.offset_m or 0.0)


area_scheme_service = AreaSchemeService()

