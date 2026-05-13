from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .category_registry import category_registry_service
from .parameter_service import parameter_service
from .shared_parameter_service import shared_parameter_service


@dataclass
class ValidationIssue:
    code: str
    severity: str
    message: str
    element_id: str | None = None
    path: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ValidationEngine:
    minimum_dimensions = {
        "Wall": {"height": 1.5, "thickness": 0.05, "length": 0.1},
        "Door": {"width": 0.3, "height": 1.5},
        "Window": {"width": 0.3, "height": 0.3},
        "Slab": {"height": 0.05},
        "Beam": {"width": 0.1, "height": 0.1, "depth": 0.1},
        "Column": {"width": 0.1, "height": 0.5, "depth": 0.1},
    }

    required_by_category = {
        "walls": ["thickness", "height"],
        "doors": ["width", "height"],
        "windows": ["width", "height"],
        "slabs": ["height"],
        "beams": ["width", "height", "depth"],
        "columns": ["width", "height", "depth"],
    }

    def default_rules(self) -> list[dict[str, Any]]:
        return [
            {
                "code": "required_parameters",
                "name": "Required Parameters",
                "severity": "error",
                "rule_type": "parameters",
                "target_categories": list(self.required_by_category.keys()),
                "config": {"required_by_category": self.required_by_category},
            },
            {
                "code": "minimum_dimensions",
                "name": "Minimum Dimensions",
                "severity": "error",
                "rule_type": "geometry",
                "target_categories": ["walls", "doors", "windows", "slabs", "beams", "columns"],
                "config": {"minimum_dimensions": self.minimum_dimensions},
            },
            {
                "code": "category_consistency",
                "name": "Category Consistency",
                "severity": "warning",
                "rule_type": "metadata",
                "target_categories": [],
                "config": {},
            },
            {
                "code": "naming_standard",
                "name": "Naming Standard",
                "severity": "warning",
                "rule_type": "metadata",
                "target_categories": [],
                "config": {},
            },
        ]

    def validate_element(self, element: Any | dict[str, Any]) -> list[ValidationIssue]:
        element_id = self._get(element, "id")
        element_type = self._enum_to_value(self._get(element, "type") or self._get(element, "element_type"))
        category = self._get(element, "category") or category_registry_service.classify_element_type(element_type)
        parameters = parameter_service.resolve_parameters(self._get(element, "parameters") or {})
        metadata = self._get(element, "metadata_json") or self._get(element, "metadata") or {}

        issues: list[ValidationIssue] = []
        issues.extend(self._validate_required(element_id, category, parameters))
        issues.extend(self._validate_minimum_dimensions(element_id, element_type, parameters))
        issues.extend(self._validate_category(element_id, element_type, category))
        issues.extend(self._validate_naming(element_id, self._get(element, "name")))
        issues.extend(self._validate_metadata_consistency(element_id, metadata))
        issues.extend(
            ValidationIssue(**issue)
            for issue in shared_parameter_service.validate_shared_values(
                category,
                (parameters.get("_cb01") or {}).get("shared_parameters") or {},
            )
        )
        return issues

    def validate_template(self, template: Any | dict[str, Any]) -> list[ValidationIssue]:
        family = self._get(template, "family") or self._get(template, "name")
        category = self._get(template, "category")
        schema = self._get(template, "schema") or {}
        issues: list[ValidationIssue] = []
        if not family:
            issues.append(ValidationIssue("template_name_missing", "error", "Family/template name is required."))
        if not category:
            issues.append(ValidationIssue("template_category_missing", "error", "Family/template category is required."))
        if not schema.get("type") and not schema.get("element_type"):
            issues.append(ValidationIssue("template_type_missing", "error", "Family schema must define an element type."))
        return issues

    def validate_elements(self, elements: list[Any | dict[str, Any]]) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        for element in elements:
            issues.extend(issue.to_dict() for issue in self.validate_element(element))
        return issues

    def _validate_required(
        self,
        element_id: str | None,
        category: str,
        parameters: dict[str, Any],
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        for key in self.required_by_category.get(category, []):
            if parameters.get(key) in (None, ""):
                issues.append(
                    ValidationIssue(
                        code="required_parameter_missing",
                        severity="error",
                        element_id=element_id,
                        path=f"parameters.{key}",
                        message=f"Required parameter '{key}' is missing.",
                    )
                )
        return issues

    def _validate_minimum_dimensions(
        self,
        element_id: str | None,
        element_type: str,
        parameters: dict[str, Any],
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        for key, minimum in self.minimum_dimensions.get(element_type, {}).items():
            value = parameters.get(key)
            if value is None:
                continue
            try:
                numeric = float(value)
            except (TypeError, ValueError):
                issues.append(
                    ValidationIssue(
                        code="dimension_not_numeric",
                        severity="error",
                        element_id=element_id,
                        path=f"parameters.{key}",
                        message=f"Dimension '{key}' must be numeric.",
                    )
                )
                continue
            if numeric < minimum:
                issues.append(
                    ValidationIssue(
                        code="minimum_dimension",
                        severity="error",
                        element_id=element_id,
                        path=f"parameters.{key}",
                        message=f"{element_type} {key} must be at least {minimum} m.",
                        metadata={"actual": numeric, "minimum": minimum},
                    )
                )
        return issues

    def _validate_category(
        self,
        element_id: str | None,
        element_type: str,
        category: str,
    ) -> list[ValidationIssue]:
        expected = category_registry_service.classify_element_type(element_type)
        if expected != "custom" and category != expected:
            return [
                ValidationIssue(
                    code="category_mismatch",
                    severity="warning",
                    element_id=element_id,
                    path="category",
                    message=f"{element_type} is classified as '{expected}', but element category is '{category}'.",
                    metadata={"expected": expected, "actual": category},
                )
            ]
        return []

    def _validate_naming(self, element_id: str | None, name: str | None) -> list[ValidationIssue]:
        if not name:
            return [
                ValidationIssue(
                    code="name_missing",
                    severity="warning",
                    element_id=element_id,
                    path="name",
                    message="Element name is empty; schedules and exports work better with a stable name.",
                )
            ]
        return []

    def _validate_metadata_consistency(
        self,
        element_id: str | None,
        metadata: dict[str, Any],
    ) -> list[ValidationIssue]:
        cb01 = metadata.get("cb01") if isinstance(metadata, dict) else None
        if not cb01:
            return [
                ValidationIssue(
                    code="cb01_metadata_missing",
                    severity="warning",
                    element_id=element_id,
                    path="metadata.cb01",
                    message="CB-01 metadata envelope is missing.",
                )
            ]
        return []

    def _get(self, element: Any | dict[str, Any], key: str) -> Any:
        if isinstance(element, dict):
            return element.get(key)
        return getattr(element, key, None)

    def _enum_to_value(self, value: Any) -> str:
        if hasattr(value, "value"):
            return str(value.value)
        if value is None:
            return "Custom"
        return str(value)


validation_engine = ValidationEngine()

