from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.room_detection_engine import room_detection_engine


def wall(
    wall_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    level_id: str = "level_0",
    thickness_mm: float = 200,
    height_mm: float = 3200,
) -> dict:
    return {
        "id": wall_id,
        "type": "wall",
        "startPoint": {"x": start[0] / 0.05, "y": start[1] / 0.05},
        "endPoint": {"x": end[0] / 0.05, "y": end[1] / 0.05},
        "thickness": thickness_mm,
        "height": height_mm,
        "levelId": level_id,
        "metadata": {},
    }


def separator(
    separator_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    level_id: str = "level_0",
) -> dict:
    return {
        "id": separator_id,
        "type": "polyline",
        "points": [start[0] / 0.05, start[1] / 0.05, end[0] / 0.05, end[1] / 0.05],
        "levelId": level_id,
        "metadata": {"boundary_type": "room_separator"},
    }


class CB05RoomIntelligenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.level = SimpleNamespace(id="level_0", name="Ground Floor", order=0, floor_height_m=3.2)

    def test_detects_rectangular_room_with_area_and_volume(self) -> None:
        elements = [
            wall("w1", (0, 0), (5, 0)),
            wall("w2", (5, 0), (5, 5)),
            wall("w3", (5, 5), (0, 5)),
            wall("w4", (0, 5), (0, 0)),
        ]
        result = room_detection_engine.detect_rooms(
            project_id="project_01",
            drawing_elements=elements,
            levels=[self.level],
            area_scheme="usable_area",
        )
        self.assertEqual(result["summary"]["detected_rooms"], 1)
        room = result["rooms"][0]
        self.assertAlmostEqual(room["properties"]["grossArea"], 25.0, places=3)
        self.assertLess(room["properties"]["area"], room["properties"]["grossArea"])
        self.assertAlmostEqual(room["properties"]["heightM"], 3.2, places=3)
        self.assertGreater(room["properties"]["volume"], 70.0)

    def test_detects_irregular_non_rectangular_room(self) -> None:
        points = [(0, 0), (6, 0), (6, 3), (3, 3), (3, 6), (0, 6)]
        elements = [
            wall(f"w{index}", points[index], points[(index + 1) % len(points)])
            for index in range(len(points))
        ]
        result = room_detection_engine.detect_rooms(
            project_id="project_01",
            drawing_elements=elements,
            levels=[self.level],
            area_scheme="gross_area",
        )
        self.assertEqual(result["summary"]["detected_rooms"], 1)
        self.assertAlmostEqual(result["rooms"][0]["properties"]["area"], 27.0, places=3)
        self.assertEqual(result["issues"], [])

    def test_separator_splits_room_and_creates_adjacency(self) -> None:
        elements = [
            wall("w1", (0, 0), (6, 0)),
            wall("w2", (6, 0), (6, 3)),
            wall("w3", (6, 3), (0, 3)),
            wall("w4", (0, 3), (0, 0)),
            separator("s1", (3, 0), (3, 3)),
        ]
        result = room_detection_engine.detect_rooms(
            project_id="project_01",
            drawing_elements=elements,
            levels=[self.level],
            area_scheme="gross_area",
        )
        self.assertEqual(result["summary"]["detected_rooms"], 2)
        self.assertTrue(all(room["relationships"]["adjacent_rooms"] for room in result["rooms"]))
        self.assertFalse(any(issue["code"] == "dangling_room_boundary" for issue in result["issues"]))


if __name__ == "__main__":
    unittest.main()

