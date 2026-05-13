from __future__ import annotations

from copy import deepcopy
from typing import Any

from .shared_parameter_service import shared_parameter_service


TYPE_PARAMETER_KEYS: dict[str, set[str]] = {
    "Wall": {"thickness", "material", "fire_rating", "compound_structure"},
    "Door": {"width", "height", "thickness", "material", "fire_rating", "frame_material"},
    "Window": {"width", "height", "thickness", "material", "glazing", "frame_material"},
    "Slab": {"height", "thickness", "material", "structural_material"},
    "Beam": {"width", "height", "depth", "material", "structural_material"},
    "Column": {"width", "height", "depth", "material", "structural_material"},
    "Ceiling": {"height", "thickness", "material"},
    "Furniture": {"width", "height", "depth", "material", "manufacturer"},
}

INSTANCE_PARAMETER_KEYS = {
    "position",
    "rotation",
    "rotationY",
    "level",
    "level_id",
    "base_elevation",
    "top_offset",
    "offset",
    "sill_height",
    "host_wall_id",
    "attach_slab_id",
    "start",
    "end",
    "length",
    "visible",
    "centered",
    "snap_to_grid",
    "grid_snap_distance",
    "start_column_id",
    "end_column_id",
    "source",
    "geometry_kernel",
    "occt_enabled",
}

MEASUREMENT_KEY_TYPES = {
    "width": "length",
    "height": "length",
    "depth": "length",
    "thickness": "length",
    "length": "length",
    "offset": "length",
    "sill_height": "length",
    "base_elevation": "length",
    "top_offset": "length",
    "area": "area",
    "volume": "volume",
    "pressure": "pressure",
    "power": "power",
    "force": "force",
}


class ParameterService:
    def normalize_parameters(
        self,
        *,
        element_type: str,
        category: str,
        incoming: dict[str, Any] | None,
        type_defaults: dict[str, Any] | None = None,
        instance_defaults: dict[str, Any] | None = None,
        shared_defaults: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        incoming = deepcopy(incoming or {})
        cb01 = deepcopy(incoming.pop("_cb01", {}) or {})

        incoming_type = deepcopy(incoming.pop("type_parameters", cb01.get("type_parameters", {})) or {})
        incoming_instance = deepcopy(
            incoming.pop("instance_parameters", cb01.get("instance_parameters", {})) or {}
        )
        incoming_shared = deepcopy(
            incoming.pop("shared_parameters", cb01.get("shared_parameters", {})) or {}
        )

        type_parameters = {
            **deepcopy(type_defaults or {}),
            **incoming_type,
        }
        instance_parameters = {
            **deepcopy(instance_defaults or {}),
            **incoming_instance,
        }
        shared_parameters = {
            **shared_parameter_service.default_values_for_category(category),
            **deepcopy(shared_defaults or {}),
            **incoming_shared,
        }

        type_keys = TYPE_PARAMETER_KEYS.get(element_type, set())
        for key, value in list(incoming.items()):
            if key.startswith("_"):
                continue
            if shared_parameter_service.is_shared_key(key):
                shared_parameters[key] = value
            elif key in type_keys:
                type_parameters[key] = value
            elif key in INSTANCE_PARAMETER_KEYS:
                instance_parameters[key] = value
            else:
                instance_parameters[key] = value

        resolved: dict[str, Any] = {
            **type_parameters,
            **instance_parameters,
            **shared_parameters,
        }
        parameter_sources = {
            **{key: "type" for key in type_parameters.keys()},
            **{key: "instance" for key in instance_parameters.keys()},
            **{key: "shared" for key in shared_parameters.keys()},
        }

        resolved["_cb01"] = {
            "schema_version": "CB-01",
            "element_type": element_type,
            "category": category,
            "type_parameters": type_parameters,
            "instance_parameters": instance_parameters,
            "shared_parameters": shared_parameters,
            "parameter_sources": parameter_sources,
            "measurement_key_types": {
                key: MEASUREMENT_KEY_TYPES[key]
                for key in resolved.keys()
                if key in MEASUREMENT_KEY_TYPES
            },
        }
        return resolved

    def resolve_parameters(
        self,
        parameters: dict[str, Any] | None,
        type_parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        parameters = deepcopy(parameters or {})
        cb01 = parameters.get("_cb01") or {}
        resolved = {
            **deepcopy(type_parameters or cb01.get("type_parameters") or {}),
            **deepcopy(cb01.get("instance_parameters") or {}),
            **deepcopy(cb01.get("shared_parameters") or {}),
        }
        for key, value in parameters.items():
            if not key.startswith("_") and key not in resolved:
                resolved[key] = value
        return resolved

    def update_parameter(
        self,
        *,
        parameters: dict[str, Any] | None,
        scope: str,
        key: str,
        value: Any,
        element_type: str,
        category: str,
    ) -> dict[str, Any]:
        parameters = deepcopy(parameters or {})
        cb01 = deepcopy(parameters.get("_cb01") or {})
        type_parameters = deepcopy(cb01.get("type_parameters") or {})
        instance_parameters = deepcopy(cb01.get("instance_parameters") or {})
        shared_parameters = deepcopy(cb01.get("shared_parameters") or {})

        if scope == "type":
            type_parameters[key] = value
        elif scope == "shared":
            shared_parameters[key] = value
        else:
            instance_parameters[key] = value

        return self.normalize_parameters(
            element_type=element_type,
            category=category,
            incoming={
                "type_parameters": type_parameters,
                "instance_parameters": instance_parameters,
                "shared_parameters": shared_parameters,
            },
        )


parameter_service = ParameterService()

