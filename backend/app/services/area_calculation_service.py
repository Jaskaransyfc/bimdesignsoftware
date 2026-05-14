from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .area_scheme_service import area_scheme_service
from .enclosed_polygon_service import EnclosedPolygon


@dataclass
class RoomAreaResult:
    gross_area_m2: float
    net_usable_area_m2: float
    carpet_area_m2: float
    built_up_area_m2: float
    selected_area_m2: float
    perimeter_m: float
    scheme_areas_m2: dict[str, float]
    average_wall_thickness_m: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "gross_area_m2": round(self.gross_area_m2, 4),
            "net_usable_area_m2": round(self.net_usable_area_m2, 4),
            "carpet_area_m2": round(self.carpet_area_m2, 4),
            "built_up_area_m2": round(self.built_up_area_m2, 4),
            "selected_area_m2": round(self.selected_area_m2, 4),
            "perimeter_m": round(self.perimeter_m, 4),
            "scheme_areas_m2": {
                key: round(value, 4) for key, value in self.scheme_areas_m2.items()
            },
            "average_wall_thickness_m": round(self.average_wall_thickness_m, 4),
        }


class AreaCalculationService:
    """Canonical room area calculations in square meters."""

    def calculate(
        self,
        polygon: EnclosedPolygon,
        *,
        selected_scheme_code: str = "usable_area",
        average_wall_thickness_m: float = 0.0,
    ) -> RoomAreaResult:
        scheme_areas = {
            scheme["code"]: area_scheme_service.calculate_area(
                polygon.points,
                scheme_code=scheme["code"],
                average_wall_thickness_m=average_wall_thickness_m,
            )
            for scheme in area_scheme_service.list_schemes()
        }
        gross_area = scheme_areas.get("gross_area", polygon.area_m2)
        net_area = scheme_areas.get("usable_area", gross_area)
        carpet_area = scheme_areas.get("carpet_area", net_area)
        built_up_area = scheme_areas.get("built_up_area", gross_area)
        selected = scheme_areas.get(selected_scheme_code, net_area)
        return RoomAreaResult(
            gross_area_m2=float(gross_area),
            net_usable_area_m2=float(net_area),
            carpet_area_m2=float(carpet_area),
            built_up_area_m2=float(built_up_area),
            selected_area_m2=float(selected),
            perimeter_m=float(polygon.perimeter_m),
            scheme_areas_m2=scheme_areas,
            average_wall_thickness_m=float(average_wall_thickness_m or 0.0),
        )


area_calculation_service = AreaCalculationService()

