from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_SHARED_PARAMETERS: list[dict[str, Any]] = [
    {
        "key": "fire_rating",
        "name": "Fire Rating",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["walls", "doors", "windows", "slabs", "ceilings"],
        "default_value": "-",
        "required": False,
        "visible": True,
        "ifc_property": "Pset_FireRating.FireRating",
    },
    {
        "key": "manufacturer",
        "name": "Manufacturer",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["doors", "windows", "furniture", "electrical", "hvac", "plumbing"],
        "default_value": "",
        "required": False,
        "visible": True,
        "ifc_property": "Pset_ManufacturerTypeInformation.Manufacturer",
    },
    {
        "key": "cost_code",
        "name": "Cost Code",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["walls", "doors", "windows", "slabs", "ceilings", "beams", "columns", "furniture", "electrical", "hvac", "plumbing"],
        "default_value": "",
        "required": False,
        "visible": True,
        "ifc_property": "BIMDesign.CostCode",
    },
    {
        "key": "phase",
        "name": "Phase",
        "data_type": "enum",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["walls", "doors", "windows", "slabs", "ceilings", "beams", "columns", "rooms", "furniture", "electrical", "hvac", "plumbing"],
        "default_value": "new",
        "required": False,
        "visible": True,
        "validation": {"allowed_values": ["existing", "new", "demolish", "temporary"]},
        "ifc_property": "BIMDesign.Phase",
    },
    {
        "key": "asset_code",
        "name": "Asset Code",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["furniture", "electrical", "hvac", "plumbing", "fire_fighting"],
        "default_value": "",
        "required": False,
        "visible": True,
        "ifc_property": "BIMDesign.AssetCode",
    },
    {
        "key": "system_type",
        "name": "System Type",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["electrical", "hvac", "plumbing", "fire_fighting", "generic_mep"],
        "default_value": "",
        "required": False,
        "visible": True,
        "ifc_property": "Pset_DistributionSystemCommon.SystemType",
    },
    {
        "key": "mark",
        "name": "Mark",
        "data_type": "string",
        "unit_type": None,
        "internal_unit": None,
        "categories": ["walls", "doors", "windows", "slabs", "ceilings", "beams", "columns", "rooms", "furniture", "electrical", "hvac", "plumbing"],
        "default_value": "",
        "required": False,
        "visible": True,
        "ifc_property": "BIMDesign.Mark",
    },
]


class SharedParameterService:
    def __init__(self) -> None:
        self._definitions = {item["key"]: item for item in DEFAULT_SHARED_PARAMETERS}

    def default_definitions(self) -> list[dict[str, Any]]:
        return deepcopy(DEFAULT_SHARED_PARAMETERS)

    def definition(self, key: str) -> dict[str, Any] | None:
        definition = self._definitions.get(key)
        return deepcopy(definition) if definition else None

    def applicable_definitions(self, category: str | None) -> list[dict[str, Any]]:
        if not category:
            category = "custom"
        return [
            deepcopy(definition)
            for definition in DEFAULT_SHARED_PARAMETERS
            if category in definition.get("categories", [])
        ]

    def default_values_for_category(self, category: str | None) -> dict[str, Any]:
        return {
            definition["key"]: deepcopy(definition.get("default_value"))
            for definition in self.applicable_definitions(category)
            if definition.get("default_value") is not None
        }

    def is_shared_key(self, key: str) -> bool:
        return key in self._definitions

    def validate_shared_values(
        self,
        category: str,
        values: dict[str, Any],
    ) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        definitions = self.applicable_definitions(category)
        for definition in definitions:
            key = definition["key"]
            value = values.get(key)
            if definition.get("required") and value in (None, ""):
                issues.append(
                    {
                        "severity": "error",
                        "code": "shared_parameter_required",
                        "path": f"parameters.shared_parameters.{key}",
                        "message": f"{definition['name']} is required.",
                    }
                )
            allowed = (definition.get("validation") or {}).get("allowed_values")
            if allowed and value not in (None, "") and value not in allowed:
                issues.append(
                    {
                        "severity": "warning",
                        "code": "shared_parameter_value",
                        "path": f"parameters.shared_parameters.{key}",
                        "message": f"{definition['name']} must be one of: {', '.join(allowed)}.",
                    }
                )
        return issues


shared_parameter_service = SharedParameterService()

