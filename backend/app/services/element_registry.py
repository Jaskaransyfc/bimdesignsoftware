from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .category_registry import category_registry_service
from .parameter_service import parameter_service


class ElementRegistryService:
    """Central object model normalizer for CB-01 BIM elements."""

    def normalize_payload(
        self,
        *,
        project_id: str,
        payload_data: dict[str, Any],
        existing: Any | None = None,
        type_definition: Any | None = None,
    ) -> dict[str, Any]:
        data = deepcopy(payload_data)
        element_type = self._enum_to_value(data.get("type") or getattr(existing, "type", None) or "Custom")
        category = (
            data.get("category")
            or getattr(existing, "category", None)
            or getattr(type_definition, "category", None)
            or category_registry_service.classify_element_type(element_type)
        )

        incoming_metadata = data.pop("metadata", None)
        metadata = deepcopy(
            incoming_metadata
            if incoming_metadata is not None
            else data.get("metadata_json")
            if data.get("metadata_json") is not None
            else getattr(existing, "metadata_json", None)
            or {}
        )

        type_defaults = deepcopy(getattr(type_definition, "type_parameters", None) or {})
        parameters = parameter_service.normalize_parameters(
            element_type=element_type,
            category=category,
            incoming=data.get("parameters") or getattr(existing, "parameters", None),
            type_defaults=type_defaults,
        )

        geometry = deepcopy(data.get("geometry") or getattr(existing, "geometry", None) or {})
        relationships = deepcopy(
            data.get("relationships") or getattr(existing, "relationships", None) or {}
        )
        transform = deepcopy(data.get("transform") or getattr(existing, "transform", None) or {})
        classification = deepcopy(
            data.get("classification") or getattr(existing, "classification", None) or {}
        )

        self._hydrate_relationships(relationships, parameters)
        transform = self._derive_transform(transform, geometry)
        classification = self._derive_classification(
            classification=classification,
            element_type=element_type,
            category=category,
        )

        metadata["cb01"] = {
            **deepcopy(metadata.get("cb01") or {}),
            "schema_version": "CB-01",
            "project_id": project_id,
            "element_type": element_type,
            "category": category,
            "object_model": "BIMElement",
            "type_definition_id": data.get("type_definition_id")
            or getattr(existing, "type_definition_id", None),
            "family_definition_id": data.get("family_definition_id")
            or getattr(existing, "family_definition_id", None),
            "ifc_ready": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        data["type"] = data.get("type") or element_type
        data["category"] = category
        data["parameters"] = parameters
        data["metadata_json"] = metadata
        data["relationships"] = relationships
        data["transform"] = transform
        data["classification"] = classification
        data["visible"] = bool(data.get("visible", getattr(existing, "visible", True)))
        return data

    def to_bim_object(self, element: Any) -> dict[str, Any]:
        element_type = self._enum_to_value(getattr(element, "type", None))
        category = getattr(element, "category", None) or category_registry_service.classify_element_type(element_type)
        geometry = deepcopy(getattr(element, "geometry", None) or {})
        return {
            "id": getattr(element, "id", None),
            "project_id": getattr(element, "project_id", None),
            "element_type": element_type,
            "object_type": element_type,
            "category": category,
            "geometry_reference": {
                "storage": "model_elements.geometry",
                "element_id": getattr(element, "id", None),
            },
            "geometry": geometry,
            "parameters": deepcopy(getattr(element, "parameters", None) or {}),
            "metadata": deepcopy(getattr(element, "metadata_json", None) or {}),
            "relationships": deepcopy(getattr(element, "relationships", None) or {}),
            "transform": deepcopy(getattr(element, "transform", None) or self._derive_transform({}, geometry)),
            "level_id": getattr(element, "level_id", None),
            "visible": bool(getattr(element, "visible", True)),
            "classification": deepcopy(getattr(element, "classification", None) or {}),
            "created_at": self._iso(getattr(element, "created_at", None)),
            "updated_at": self._iso(getattr(element, "updated_at", None)),
        }

    def _hydrate_relationships(self, relationships: dict[str, Any], parameters: dict[str, Any]) -> None:
        if parameters.get("host_wall_id"):
            relationships["hosted_by"] = {
                "element_id": parameters["host_wall_id"],
                "relationship": "opening_host",
            }
        if parameters.get("attach_slab_id"):
            relationships["attached_to"] = {
                "element_id": parameters["attach_slab_id"],
                "relationship": "base_constraint",
            }
        if parameters.get("start_column_id") or parameters.get("end_column_id"):
            relationships["spans_between"] = [
                value
                for value in [parameters.get("start_column_id"), parameters.get("end_column_id")]
                if value
            ]

    def _derive_transform(
        self,
        transform: dict[str, Any],
        geometry: dict[str, Any],
    ) -> dict[str, Any]:
        position = transform.get("position") or geometry.get("position") or [0.0, 0.0, 0.0]
        rotation = transform.get("rotation") or [0.0, float(geometry.get("rotationY", 0.0)), 0.0]
        scale = transform.get("scale") or [1.0, 1.0, 1.0]
        return {
            **transform,
            "position": position,
            "rotation": rotation,
            "scale": scale,
        }

    def _derive_classification(
        self,
        *,
        classification: dict[str, Any],
        element_type: str,
        category: str,
    ) -> dict[str, Any]:
        category_def = category_registry_service.get_category(category)
        return {
            "category": category,
            "discipline": category_def.get("discipline"),
            "ifc_class": classification.get("ifc_class") or category_def.get("ifc_class"),
            **classification,
            "element_type": element_type,
        }

    def _enum_to_value(self, value: Any) -> str:
        if hasattr(value, "value"):
            return str(value.value)
        if value is None:
            return "Custom"
        text = str(value)
        return text[0].upper() + text[1:] if text.islower() else text

    def _iso(self, value: Any) -> str | None:
        return value.isoformat() if hasattr(value, "isoformat") else None


element_registry_service = ElementRegistryService()

