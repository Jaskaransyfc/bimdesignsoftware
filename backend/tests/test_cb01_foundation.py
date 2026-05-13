from __future__ import annotations

import unittest

from app.services.category_registry import category_registry_service
from app.services.element_registry import element_registry_service
from app.services.parameter_service import parameter_service
from app.services.unit_engine import unit_conversion_service
from app.services.validation_engine import validation_engine


class CB01FoundationTest(unittest.TestCase):
    def test_unit_conversion_uses_canonical_meters(self) -> None:
        self.assertAlmostEqual(
            unit_conversion_service.convert_to_internal(230, "mm", "length"),
            0.23,
        )
        self.assertAlmostEqual(
            unit_conversion_service.convert_for_display(0.23, "mm", "length"),
            230,
        )

    def test_category_registry_classifies_core_bim_types(self) -> None:
        self.assertEqual(category_registry_service.classify_element_type("Wall"), "walls")
        self.assertEqual(category_registry_service.classify_element_type("HVAC"), "hvac")
        self.assertEqual(category_registry_service.classify_element_type("Unknown"), "custom")

    def test_parameter_service_separates_type_instance_and_shared_values(self) -> None:
        normalized = parameter_service.normalize_parameters(
            element_type="Wall",
            category="walls",
            incoming={
                "thickness": 0.23,
                "height": 3.0,
                "fire_rating": "2hr",
                "level_id": "level_01",
            },
        )
        cb01 = normalized["_cb01"]
        self.assertEqual(cb01["type_parameters"]["thickness"], 0.23)
        self.assertEqual(cb01["instance_parameters"]["height"], 3.0)
        self.assertEqual(cb01["instance_parameters"]["level_id"], "level_01")
        self.assertEqual(cb01["shared_parameters"]["fire_rating"], "2hr")

    def test_element_registry_builds_cb01_object_model(self) -> None:
        normalized = element_registry_service.normalize_payload(
            project_id="project_01",
            payload_data={
                "type": "Door",
                "name": "D-01",
                "parameters": {"width": 0.9, "height": 2.1, "host_wall_id": "wall_01"},
            },
        )
        self.assertEqual(normalized["category"], "doors")
        self.assertEqual(normalized["relationships"]["hosted_by"]["element_id"], "wall_01")
        self.assertEqual(normalized["metadata_json"]["cb01"]["schema_version"], "CB-01")

    def test_validation_reports_dimension_failures(self) -> None:
        issues = validation_engine.validate_element(
            {
                "id": "wall_bad",
                "type": "Wall",
                "category": "walls",
                "name": "Too Thin",
                "parameters": {"thickness": 0.01, "height": 3.0},
                "metadata": {"cb01": {"schema_version": "CB-01"}},
            }
        )
        self.assertTrue(any(issue.code == "minimum_dimension" for issue in issues))


if __name__ == "__main__":
    unittest.main()

