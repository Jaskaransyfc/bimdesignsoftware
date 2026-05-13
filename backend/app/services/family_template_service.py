from __future__ import annotations

from copy import deepcopy
from typing import Any

from .category_registry import category_registry_service
from .parameter_service import parameter_service


DEFAULT_FAMILY_TEMPLATES: list[dict[str, Any]] = [
    {
        "family": "Basic 230mm Brick Wall",
        "category": "walls",
        "schema": {"type": "Wall", "ifc_entity": "IfcWall"},
        "type_parameters": {"thickness": 0.23, "material": "Red Brick", "fire_rating": "2hr"},
        "instance_defaults": {"height": 3.0, "base_elevation": 0.0},
        "shared_parameters": {"phase": "new", "cost_code": ""},
    },
    {
        "family": "RCC Slab 150mm",
        "category": "slabs",
        "schema": {"type": "Slab", "ifc_entity": "IfcSlab"},
        "type_parameters": {"height": 0.15, "material": "RCC"},
        "instance_defaults": {"width": 4.0, "depth": 4.0},
        "shared_parameters": {"phase": "new", "cost_code": ""},
    },
    {
        "family": "Indian Flush Door",
        "category": "doors",
        "schema": {"type": "Door", "ifc_entity": "IfcDoor"},
        "type_parameters": {
            "width": 0.9,
            "height": 2.1,
            "thickness": 0.12,
            "material": "Wood",
            "fire_rating": "1hr",
        },
        "instance_defaults": {"sill_height": 0.0},
        "shared_parameters": {"phase": "new", "manufacturer": "", "cost_code": ""},
    },
    {
        "family": "Sliding Window",
        "category": "windows",
        "schema": {"type": "Window", "ifc_entity": "IfcWindow"},
        "type_parameters": {
            "width": 1.2,
            "height": 1.2,
            "thickness": 0.12,
            "material": "Aluminum",
            "glazing": "Clear",
        },
        "instance_defaults": {"sill_height": 1.0},
        "shared_parameters": {"phase": "new", "manufacturer": "", "cost_code": ""},
    },
    {
        "family": "RCC Column",
        "category": "columns",
        "schema": {"type": "Column", "ifc_entity": "IfcColumn"},
        "type_parameters": {"width": 0.4, "height": 3.0, "depth": 0.4, "material": "RCC"},
        "instance_defaults": {"snap_to_grid": True},
        "shared_parameters": {"phase": "new", "cost_code": ""},
    },
    {
        "family": "RCC Beam",
        "category": "beams",
        "schema": {"type": "Beam", "ifc_entity": "IfcBeam"},
        "type_parameters": {"width": 3.0, "height": 0.45, "depth": 0.3, "material": "RCC"},
        "instance_defaults": {},
        "shared_parameters": {"phase": "new", "cost_code": ""},
    },
]


class FamilyTemplateService:
    def default_templates(self) -> list[dict[str, Any]]:
        return deepcopy(DEFAULT_FAMILY_TEMPLATES)

    def normalize_family_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = deepcopy(payload)
        schema = deepcopy(data.get("schema") or {})
        element_type = schema.get("type") or schema.get("element_type") or data.get("category") or "Custom"
        category = data.get("category") or category_registry_service.classify_element_type(element_type)
        data["category"] = category
        data["schema"] = {
            **schema,
            "type": element_type,
            "category": category,
            "cb01_schema_version": "CB-01",
        }
        data["type_parameters"] = deepcopy(
            data.get("type_parameters") or schema.get("type_parameters") or schema.get("parameters") or {}
        )
        data["instance_defaults"] = deepcopy(
            data.get("instance_defaults") or schema.get("instance_defaults") or {}
        )
        data["shared_parameters"] = deepcopy(
            data.get("shared_parameters") or schema.get("shared_parameters") or {}
        )
        metadata = data.pop("metadata", None)
        if metadata is None:
            metadata = data.get("metadata_json") or {}
        data["metadata_json"] = deepcopy(metadata)
        data["metadata_json"]["cb01"] = {
            **data["metadata_json"].get("cb01", {}),
            "schema_version": "CB-01",
            "template_type": "family_definition",
            "element_type": element_type,
            "category": category,
        }
        return data

    def instantiate_parameters(
        self,
        *,
        family: Any,
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        schema = deepcopy(getattr(family, "schema", None) or {})
        element_type = schema.get("type") or schema.get("element_type") or "Custom"
        category = getattr(family, "category", None) or category_registry_service.classify_element_type(element_type)
        incoming = {
            "type_parameters": deepcopy(getattr(family, "type_parameters", None) or schema.get("type_parameters") or schema.get("parameters") or {}),
            "instance_parameters": deepcopy(getattr(family, "instance_defaults", None) or schema.get("instance_defaults") or {}),
            "shared_parameters": deepcopy(getattr(family, "shared_parameters", None) or schema.get("shared_parameters") or {}),
        }
        for key, value in (overrides or {}).items():
            incoming["instance_parameters"][key] = value
        incoming["instance_parameters"]["family"] = getattr(family, "family", None)
        return parameter_service.normalize_parameters(
            element_type=element_type,
            category=category,
            incoming=incoming,
        )


family_template_service = FamilyTemplateService()
