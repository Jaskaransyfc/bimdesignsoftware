from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_CATEGORIES: list[dict[str, Any]] = [
    {
        "code": "walls",
        "name": "Walls",
        "discipline": "architecture",
        "ifc_class": "IfcWall",
        "element_types": ["Wall", "wall"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "doors",
        "name": "Doors",
        "discipline": "architecture",
        "ifc_class": "IfcDoor",
        "element_types": ["Door", "door", "Opening"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "windows",
        "name": "Windows",
        "discipline": "architecture",
        "ifc_class": "IfcWindow",
        "element_types": ["Window", "window"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "slabs",
        "name": "Slabs",
        "discipline": "structure",
        "ifc_class": "IfcSlab",
        "element_types": ["Slab", "slab", "floor"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "ceilings",
        "name": "Ceilings",
        "discipline": "architecture",
        "ifc_class": "IfcCovering",
        "element_types": ["Ceiling", "ceiling", "roof"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "beams",
        "name": "Beams",
        "discipline": "structure",
        "ifc_class": "IfcBeam",
        "element_types": ["Beam", "beam"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "columns",
        "name": "Columns",
        "discipline": "structure",
        "ifc_class": "IfcColumn",
        "element_types": ["Column", "column"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "rooms",
        "name": "Rooms",
        "discipline": "architecture",
        "ifc_class": "IfcSpace",
        "element_types": ["Room", "room"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "furniture",
        "name": "Furniture",
        "discipline": "interiors",
        "ifc_class": "IfcFurniture",
        "element_types": ["Furniture", "furniture"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "electrical",
        "name": "Electrical",
        "discipline": "electrical",
        "ifc_class": "IfcDistributionElement",
        "element_types": ["Electrical", "electrical", "electrical_fixture"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "hvac",
        "name": "HVAC",
        "discipline": "mechanical",
        "ifc_class": "IfcDistributionElement",
        "element_types": ["HVAC", "hvac"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "plumbing",
        "name": "Plumbing",
        "discipline": "plumbing",
        "ifc_class": "IfcDistributionElement",
        "element_types": ["Plumbing", "plumbing"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "fire_fighting",
        "name": "Fire Fighting",
        "discipline": "fire",
        "ifc_class": "IfcDistributionElement",
        "element_types": ["FireFighting", "fire_fighting"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "generic_mep",
        "name": "Generic MEP",
        "discipline": "mep",
        "ifc_class": "IfcDistributionElement",
        "element_types": ["MEP", "mep"],
        "default_visible": True,
        "schedule_enabled": True,
    },
    {
        "code": "custom",
        "name": "Custom",
        "discipline": "coordination",
        "ifc_class": "IfcBuildingElementProxy",
        "element_types": ["Custom", "custom"],
        "default_visible": True,
        "schedule_enabled": True,
    },
]


class CategoryRegistryService:
    def __init__(self) -> None:
        self._by_code = {category["code"]: category for category in DEFAULT_CATEGORIES}
        self._by_type: dict[str, str] = {}
        for category in DEFAULT_CATEGORIES:
            for element_type in category.get("element_types", []):
                self._by_type[self._normalize(element_type)] = category["code"]

    def default_categories(self) -> list[dict[str, Any]]:
        return deepcopy(DEFAULT_CATEGORIES)

    def classify_element_type(self, element_type: str | None) -> str:
        if not element_type:
            return "custom"
        return self._by_type.get(self._normalize(element_type), "custom")

    def get_category(self, code: str | None) -> dict[str, Any]:
        if not code:
            code = "custom"
        return deepcopy(self._by_code.get(code, self._by_code["custom"]))

    def category_codes(self) -> list[str]:
        return [category["code"] for category in DEFAULT_CATEGORIES]

    def category_for_ifc(self, ifc_class: str | None) -> str:
        if not ifc_class:
            return "custom"
        raw = ifc_class.lower()
        for category in DEFAULT_CATEGORIES:
            category_ifc = str(category.get("ifc_class") or "").lower()
            if category_ifc and raw == category_ifc.lower():
                return category["code"]
        if "distribution" in raw:
            return "generic_mep"
        return "custom"

    def _normalize(self, value: str) -> str:
        return value.strip().lower().replace("-", "_").replace(" ", "_")


category_registry_service = CategoryRegistryService()

