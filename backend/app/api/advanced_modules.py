from __future__ import annotations

import heapq
import json
import math
from typing import Any, Literal

try:
    import networkx as nx  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    nx = None

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Material, ModelElement, Project
from ..storage import upload_file

router = APIRouter(prefix="/api/projects", tags=["advanced-modules"])

CANVAS_TO_MM = 50.0


class RebarBBSRequest(BaseModel):
    member_type: Literal["beam", "column", "slab", "footing"] = "beam"
    length_mm: float
    width_mm: float = 230.0
    depth_mm: float = 450.0
    bar_diameter_mm: float = 12.0
    main_bar_count: int = 4
    stirrup_diameter_mm: float = 8.0
    stirrup_spacing_mm: float = 150.0
    cover_mm: float = 25.0
    lap_type: Literal["tension", "compression"] = "tension"
    hook_length_mm: float = 90.0
    quantity: int = 1


class MEPPoint(BaseModel):
    x: float
    y: float


class MEPOstacleBox(BaseModel):
    id: str | None = None
    type: str = "obstacle"
    min: list[float]
    max: list[float]


class MEPRoutingRequest(BaseModel):
    system: Literal["pipe", "duct", "cable_tray"] = "pipe"
    start: MEPPoint
    end: MEPPoint
    clearance_mm: float = 150.0
    grid_mm: float = 500.0
    obstacles: list[MEPOstacleBox] = Field(default_factory=list)


class ClearanceFixture(BaseModel):
    id: str
    type: str
    min: list[float]
    max: list[float]


class ClearanceCheckRequest(BaseModel):
    fixtures: list[ClearanceFixture] = Field(default_factory=list)
    min_clearance_mm: float = 300.0


class FixturePlacementRequest(BaseModel):
    room_width_mm: float
    room_depth_mm: float
    count: int = 4
    fixture_clearance_mm: float = 300.0
    fixture_depth_mm: float = 450.0


class ElectricalTemplateRequest(BaseModel):
    """Educational / hospital / commercial electrical templates with Indian code references (conceptual)."""

    building_type: Literal[
        "college",
        "school",
        "university",
        "hospital",
        "commercial_complex",
        "mall",
        "government_office",
        "private_office",
        "residential_high_rise",
    ] = "school"
    mep_discipline: Literal[
        "electrical",
        "sewage",
        "fire_fighting_pipeline",
        "fire_alarm",
        "hvac",
    ] = "electrical"
    room_type: Literal[
        "classroom",
        "corridor",
        "staff_room",
        "library",
        "auditorium",
        "washroom",
        "lab",
        "reception",
        "chemistry_lab",
        "physics_lab",
        "computer_lab",
        "principal_office",
        "meeting_room",
        "icu",
        "emergency_ward",
        "patient_waiting",
        "blood_collection_lab",
        "operation_theatre",
    ] = "classroom"
    room_name: str | None = None
    room_width_mm: float
    room_depth_mm: float
    ceiling_height_mm: float = 3000.0
    occupancy: int = 0
    entry_side: Literal["north", "south", "east", "west"] = "south"
    teaching_wall_side: Literal["north", "south", "east", "west"] | None = None
    stage_depth_mm: float = 6000.0
    seating_rows: int = 0
    preferred_voltage_v: float = 230.0
    include_emergency_circuit: bool = True


INDIAN_ELECTRICAL_CODE_REFERENCES = [
    "NBC 2016 Part 8 — Electrical & allied installations (conceptual routing).",
    "IS 732:1989 — Electrical wiring installations (practice reference).",
    "IS 1646:2007 — Emergency lighting for buildings (egress / occupied zones).",
]


def _building_plan_skew_mm(building_type: str, width_mm: float, depth_mm: float) -> tuple[float, float]:
    """Deterministic asymmetry so templates differ by building typology (not always centered)."""
    skews: dict[str, tuple[float, float]] = {
        "college": (0.035, -0.018),
        "school": (0.0, 0.0),
        "university": (0.042, -0.022),
        "hospital": (-0.028, 0.032),
        "commercial_complex": (0.048, 0.022),
        "mall": (0.052, 0.028),
        "government_office": (0.018, 0.005),
        "private_office": (0.032, 0.018),
        "residential_high_rise": (0.014, 0.038),
    }
    sx, sy = skews.get(building_type, (0.02, 0.01))
    return sx * width_mm, sy * depth_mm


def _teaching_wall_shift_mm(
    teaching_wall_side: str | None,
    width_mm: float,
    depth_mm: float,
) -> tuple[float, float]:
    """Shift luminaire cluster away from the board wall toward the occupied zone."""
    if not teaching_wall_side:
        return 0.0, 0.0
    # Board on west → shift fixtures east; board on north → shift south, etc.
    table = {
        "west": (0.07 * width_mm, 0.0),
        "east": (-0.07 * width_mm, 0.0),
        "south": (0.0, 0.07 * depth_mm),
        "north": (0.0, -0.07 * depth_mm),
    }
    return table.get(teaching_wall_side, (0.0, 0.0))


def _point3(x: float, y: float, z: float = 0.0) -> dict[str, float]:
    return {"x": round(x, 2), "y": round(y, 2), "z": round(z, 2)}


def _template_fixture(
    fixture_id: str,
    kind: str,
    x_mm: float,
    y_mm: float,
    *,
    circuit_id: str,
    wall_side: str | None = None,
    note: str = "",
) -> dict[str, Any]:
    return {
        "id": fixture_id,
        "type": kind,
        "x_mm": round(x_mm, 2),
        "y_mm": round(y_mm, 2),
        "elevation_mm": 0.0,
        "circuit_id": circuit_id,
        "wall_side": wall_side,
        "note": note,
    }


def _template_route(start: tuple[float, float], end: tuple[float, float], *, clearance_mm: float = 300.0) -> list[dict[str, float]]:
    mid_x = (start[0] + end[0]) / 2.0
    mid_y = (start[1] + end[1]) / 2.0
    if abs(start[0] - end[0]) >= abs(start[1] - end[1]):
        bend = (mid_x, start[1])
    else:
        bend = (start[0], mid_y)
    route = [start, bend, end]
    cleaned: list[dict[str, float]] = []
    for x, y in route:
        cleaned.append(_point3(x, y, 0.0))
    if clearance_mm > 0:
        cleaned[1]["clearance_mm"] = round(clearance_mm, 2)
    return cleaned


class PipeFlowCheckRequest(BaseModel):
    system: Literal["pipe", "duct", "cable_tray"] = "pipe"
    flow_lps: float = 2.0
    pipe_diameter_mm: float = 100.0
    length_m: float = 10.0
    allowable_velocity_mps: float = 2.5


class EnergyAnalysisRequest(BaseModel):
    floor_area_m2: float
    wall_area_m2: float = 0.0
    window_area_m2: float = 0.0
    occupancy: int = 4
    climate_factor: float = 1.0
    roof_exposure: float = 1.0
    shading_factor: float = 1.0


class RenderingPresetRequest(BaseModel):
    quality: Literal["draft", "client", "presentation"] = "client"
    walkthrough: bool = True
    sun_study: bool = True
    material_preview: bool = True


def _project_not_found(project_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Project {project_id} not found")


def _safe_load_json(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return []
    return []


def _drawing_elements(project: Project) -> list[dict[str, Any]]:
    drawing = _safe_load_json(project.drawing)
    if isinstance(drawing, dict):
        for key in ("elements", "items", "data"):
            items = drawing.get(key)
            if isinstance(items, list):
                return [item for item in items if isinstance(item, dict)]
        return [drawing] if drawing else []
    if isinstance(drawing, list):
        return [item for item in drawing if isinstance(item, dict)]
    return []


def _element_type(element: dict[str, Any]) -> str:
    value = element.get("type") or element.get("kind") or element.get("elementType") or ""
    return str(value).strip().lower()


def _point_from(value: Any) -> tuple[float, float] | None:
    if isinstance(value, dict):
        if "x" in value and "y" in value:
            return float(value["x"]), float(value["y"])
        if "0" in value and "1" in value:
            return float(value["0"]), float(value["1"])
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return float(value[0]), float(value[1])
    return None


def _element_points(element: dict[str, Any]) -> tuple[tuple[float, float] | None, tuple[float, float] | None]:
    start = element.get("startPoint") or element.get("start") or element.get("from")
    end = element.get("endPoint") or element.get("end") or element.get("to")
    return _point_from(start), _point_from(end)


def _dimensions_to_mm(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _weight_per_meter(diameter_mm: float) -> float:
    return (diameter_mm * diameter_mm) / 162.0


def _lap_length_mm(diameter_mm: float, lap_type: str) -> float:
    multiplier = 40.0 if lap_type == "tension" else 50.0
    return max(300.0, multiplier * diameter_mm)


def _stirrup_cut_length_mm(
    width_mm: float,
    depth_mm: float,
    cover_mm: float,
    stirrup_diameter_mm: float,
    hook_length_mm: float,
) -> float:
    inner_width = max(width_mm - 2.0 * cover_mm, 0.0)
    inner_depth = max(depth_mm - 2.0 * cover_mm, 0.0)
    bend_allowance = 24.0 * stirrup_diameter_mm
    return 2.0 * (inner_width + inner_depth) + 2.0 * hook_length_mm + bend_allowance


def _aabb_expand(box: dict[str, Any], expand_mm: float) -> dict[str, Any]:
    return {
        "id": box.get("id"),
        "type": box.get("type", "obstacle"),
        "min": [float(box["min"][0]) - expand_mm, float(box["min"][1]) - expand_mm],
        "max": [float(box["max"][0]) + expand_mm, float(box["max"][1]) + expand_mm],
    }


def _aabb_overlap_2d(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return not (
        a["max"][0] < b["min"][0]
        or a["min"][0] > b["max"][0]
        or a["max"][1] < b["min"][1]
        or a["min"][1] > b["max"][1]
    )


def _aabb_clearance_2d(a: dict[str, Any], b: dict[str, Any]) -> float:
    dx = max(0.0, max(a["min"][0] - b["max"][0], b["min"][0] - a["max"][0]))
    dy = max(0.0, max(a["min"][1] - b["max"][1], b["min"][1] - a["max"][1]))
    return math.hypot(dx, dy)


@router.post("/{project_id}/modules/mep/pressure-flow-check")
async def mep_pressure_flow_check(project_id: str, payload: PipeFlowCheckRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise _project_not_found(project_id)

    diameter_m = max(payload.pipe_diameter_mm, 1.0) / 1000.0
    area_m2 = math.pi * (diameter_m / 2.0) ** 2
    flow_m3s = max(payload.flow_lps, 0.0) / 1000.0
    velocity_mps = flow_m3s / max(area_m2, 1e-6)
    friction_factor = 0.02 if payload.system == "pipe" else 0.015
    pressure_drop_kpa = friction_factor * payload.length_m * velocity_mps * 12.0
    status = "ok" if velocity_mps <= payload.allowable_velocity_mps and pressure_drop_kpa <= 50.0 else "review"

    result = {
        "project_id": project_id,
        "system": payload.system,
        "flow_lps": payload.flow_lps,
        "pipe_diameter_mm": payload.pipe_diameter_mm,
        "length_m": payload.length_m,
        "velocity_mps": round(velocity_mps, 2),
        "pressure_drop_kpa": round(pressure_drop_kpa, 2),
        "allowable_velocity_mps": payload.allowable_velocity_mps,
        "status": status,
        "notes": [
            "This is a preliminary check intended for coordination and sizing review.",
            "Use vendor or code-verified calculations before construction issue.",
        ],
    }
    _persist_result(project_id, "module-22-mep-pressure-flow.json", result)
    return result


def _project_context(project: Project, elements: list[dict[str, Any]], model_elements: list[ModelElement]) -> dict[str, Any]:
    walls = [el for el in elements if _element_type(el) == "wall"]
    doors = [el for el in elements if _element_type(el) == "door"]
    windows = [el for el in elements if _element_type(el) == "window"]

    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    total_wall_length_mm = 0.0
    total_wall_area_m2 = 0.0
    total_opening_area_m2 = 0.0
    routing_obstacles: list[dict[str, Any]] = []

    for idx, wall in enumerate(walls):
        start, end = _element_points(wall)
        if start and end:
            sx, sy = start[0] * CANVAS_TO_MM, start[1] * CANVAS_TO_MM
            ex, ey = end[0] * CANVAS_TO_MM, end[1] * CANVAS_TO_MM
            thickness_mm = _dimensions_to_mm(wall.get("thickness"), 230.0)
            height_mm = _dimensions_to_mm(wall.get("height"), 3000.0)
            total_wall_length_mm += math.hypot(ex - sx, ey - sy)
            total_wall_area_m2 += (math.hypot(ex - sx, ey - sy) / 1000.0) * (height_mm / 1000.0)

            min_x = min(min_x, sx, ex)
            min_y = min(min_y, sy, ey)
            max_x = max(max_x, sx, ex)
            max_y = max(max_y, sy, ey)

            routing_obstacles.append(
                {
                    "id": wall.get("id") or f"wall_{idx}",
                    "type": "wall",
                    "min": [min(sx, ex) - thickness_mm / 2.0, min(sy, ey) - thickness_mm / 2.0],
                    "max": [max(sx, ex) + thickness_mm / 2.0, max(sy, ey) + thickness_mm / 2.0],
                }
            )

    for opening in doors + windows:
        width_mm = _dimensions_to_mm(opening.get("width"), 900.0)
        height_mm = _dimensions_to_mm(opening.get("height"), 2100.0 if _element_type(opening) == "door" else 1200.0)
        total_opening_area_m2 += (width_mm / 1000.0) * (height_mm / 1000.0)

    bbox_width_mm = 0.0 if math.isinf(min_x) or math.isinf(max_x) else max(max_x - min_x, 0.0)
    bbox_depth_mm = 0.0 if math.isinf(min_y) or math.isinf(max_y) else max(max_y - min_y, 0.0)
    floor_area_m2 = (bbox_width_mm / 1000.0) * (bbox_depth_mm / 1000.0)

    structural_counts: dict[str, int] = {"column": 0, "beam": 0, "slab": 0, "wall": len(walls)}
    for model_el in model_elements:
        model_type = str(model_el.type.value if hasattr(model_el.type, "value") else model_el.type).lower()
        if model_type in structural_counts:
            structural_counts[model_type] += 1

    return {
        "project_id": project.id,
        "project_name": project.name,
        "element_counts": {
            "walls": len(walls),
            "doors": len(doors),
            "windows": len(windows),
            "all": len(elements),
        },
        "structural_counts": structural_counts,
        "material_count": 0,
        "estimated_floor_area_m2": round(floor_area_m2, 2),
        "estimated_wall_length_m": round(total_wall_length_mm / 1000.0, 2),
        "estimated_wall_area_m2": round(total_wall_area_m2, 2),
        "estimated_opening_area_m2": round(total_opening_area_m2, 2),
        "routing_obstacles": routing_obstacles,
        "bbox_mm": {
            "width": round(bbox_width_mm, 2),
            "depth": round(bbox_depth_mm, 2),
        },
        "energy_defaults": {
            "floor_area_m2": round(floor_area_m2, 2),
            "wall_area_m2": round(total_wall_area_m2, 2),
            "window_area_m2": round(total_opening_area_m2, 2),
            "occupancy": max(2, int(round(floor_area_m2 / 12.0))) if floor_area_m2 > 0 else 4,
            "climate_factor": 1.0,
            "roof_exposure": 1.0,
            "shading_factor": 1.0,
        },
    }


async def _load_project_bundle(project_id: str, db: AsyncSession) -> tuple[Project, list[dict[str, Any]], list[ModelElement], list[Material]]:
    project = await db.get(Project, project_id)
    if not project:
        raise _project_not_found(project_id)
    elements = _drawing_elements(project)
    model_elements = (await db.execute(select(ModelElement).where(ModelElement.project_id == project_id))).scalars().all()
    materials = (await db.execute(select(Material).where(Material.project_id == project_id))).scalars().all()
    return project, elements, model_elements, materials


def _persist_result(project_id: str, filename: str, payload: dict[str, Any]) -> None:
    upload_file(f"viewable/{project_id}/{filename}", json.dumps(payload, ensure_ascii=True).encode("utf-8"))


@router.get("/{project_id}/modules/context")
async def get_module_context(project_id: str, db: AsyncSession = Depends(get_db)):
    project, elements, model_elements, materials = await _load_project_bundle(project_id, db)
    context = _project_context(project, elements, model_elements)
    context["material_count"] = len(materials)
    context["materials"] = [{"id": material.id, "name": material.name, "category": material.category} for material in materials[:8]]
    context["module_flags"] = {
        "rebar_bbs": context["structural_counts"]["column"] + context["structural_counts"]["beam"] + context["structural_counts"]["slab"] > 0,
        "mep": context["element_counts"]["walls"] > 0 or context["element_counts"]["doors"] > 0 or context["element_counts"]["windows"] > 0,
        "energy": context["estimated_floor_area_m2"] > 0,
        "rendering": len(materials) > 0 or context["element_counts"]["all"] > 0,
    }
    return context


@router.post("/{project_id}/modules/rebar-bbs/calculate")
async def calculate_rebar_bbs(project_id: str, payload: RebarBBSRequest, db: AsyncSession = Depends(get_db)):
    project, elements, model_elements, _materials = await _load_project_bundle(project_id, db)
    context = _project_context(project, elements, model_elements)

    effective_length_mm = max(payload.length_mm, 1.0)
    effective_width_mm = max(payload.width_mm, 1.0)
    effective_depth_mm = max(payload.depth_mm, 1.0)
    main_cut_length_mm = effective_length_mm + 2.0 * payload.hook_length_mm
    lap_length_mm = _lap_length_mm(payload.bar_diameter_mm, payload.lap_type)
    stirrup_cut_length_mm = _stirrup_cut_length_mm(
        effective_width_mm,
        effective_depth_mm,
        payload.cover_mm,
        payload.stirrup_diameter_mm,
        payload.hook_length_mm,
    )
    stirrup_count = max(1, int(math.ceil(effective_length_mm / max(payload.stirrup_spacing_mm, 1.0))) + 1)
    total_main_length_m = (main_cut_length_mm / 1000.0) * max(payload.main_bar_count, 1) * max(payload.quantity, 1)
    total_stirrup_length_m = (stirrup_cut_length_mm / 1000.0) * stirrup_count * max(payload.quantity, 1)
    steel_weight_kg = total_main_length_m * _weight_per_meter(payload.bar_diameter_mm) + total_stirrup_length_m * _weight_per_meter(payload.stirrup_diameter_mm)
    rcc_volume_m3 = (effective_length_mm * effective_width_mm * effective_depth_mm * max(payload.quantity, 1)) / 1_000_000_000.0

    schedule = [
        {
            "member": payload.member_type,
            "bar_type": "main bars",
            "diameter_mm": payload.bar_diameter_mm,
            "quantity": max(payload.main_bar_count, 1) * max(payload.quantity, 1),
            "cut_length_mm": round(main_cut_length_mm, 2),
            "lap_length_mm": round(lap_length_mm, 2),
            "weight_kg": round(total_main_length_m * _weight_per_meter(payload.bar_diameter_mm), 2),
        },
        {
            "member": payload.member_type,
            "bar_type": "stirrups/ties",
            "diameter_mm": payload.stirrup_diameter_mm,
            "quantity": stirrup_count * max(payload.quantity, 1),
            "cut_length_mm": round(stirrup_cut_length_mm, 2),
            "weight_kg": round(total_stirrup_length_m * _weight_per_meter(payload.stirrup_diameter_mm), 2),
        },
    ]

    result = {
        "project_id": project_id,
        "project_name": project.name,
        "context": {
            "estimated_floor_area_m2": context["estimated_floor_area_m2"],
            "estimated_wall_length_m": context["estimated_wall_length_m"],
            "structural_counts": context["structural_counts"],
        },
        "input": payload.model_dump(),
        "outputs": {
            "main_cut_length_mm": round(main_cut_length_mm, 2),
            "lap_length_mm": round(lap_length_mm, 2),
            "stirrup_cut_length_mm": round(stirrup_cut_length_mm, 2),
            "stirrup_count": stirrup_count,
            "rcc_volume_m3": round(rcc_volume_m3, 4),
            "steel_weight_kg": round(steel_weight_kg, 2),
        },
        "schedule": schedule,
        "notes": [
            "Lap length follows the conventional 40d tension / 50d compression rule of thumb.",
            "Stirrups are estimated with a rectangular tie length plus hook and bend allowances.",
        ],
    }
    _persist_result(project_id, "module-21-rebar-bbs.json", result)
    return result


@router.post("/{project_id}/modules/mep/route")
async def route_mep(project_id: str, payload: MEPRoutingRequest, db: AsyncSession = Depends(get_db)):
    project, elements, model_elements, _materials = await _load_project_bundle(project_id, db)
    context = _project_context(project, elements, model_elements)

    grid = max(100.0, payload.grid_mm)
    clearance = max(0.0, payload.clearance_mm)
    start = (float(payload.start.x), float(payload.start.y))
    end = (float(payload.end.x), float(payload.end.y))
    obstacles = [_aabb_expand(box.model_dump(), clearance / 2.0) for box in payload.obstacles]

    xs = [start[0], end[0]]
    ys = [start[1], end[1]]
    for box in obstacles:
        xs.extend([box["min"][0], box["max"][0]])
        ys.extend([box["min"][1], box["max"][1]])
    margin = max(grid * 2.0, clearance * 2.0, 500.0)
    min_x = math.floor((min(xs) - margin) / grid) * grid
    max_x = math.ceil((max(xs) + margin) / grid) * grid
    min_y = math.floor((min(ys) - margin) / grid) * grid
    max_y = math.ceil((max(ys) + margin) / grid) * grid

    def blocked(pt: tuple[float, float]) -> bool:
        box = {"min": [pt[0], pt[1]], "max": [pt[0], pt[1]]}
        return any(_aabb_overlap_2d(_aabb_expand(obs, 0.0), box) for obs in obstacles)

    def neighbors(pt: tuple[float, float]):
        for dx, dy in ((grid, 0.0), (-grid, 0.0), (0.0, grid), (0.0, -grid)):
            nxt = (pt[0] + dx, pt[1] + dy)
            if min_x <= nxt[0] <= max_x and min_y <= nxt[1] <= max_y and not blocked(nxt):
                yield nxt

    def heuristic(a: tuple[float, float], b: tuple[float, float]) -> float:
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    path: list[tuple[float, float]] = []
    used_networkx = False

    if nx is not None:
        try:
            graph = nx.Graph()

            def to_node(pt: tuple[float, float]) -> tuple[int, int]:
                return (int(round(pt[0])), int(round(pt[1])))

            start_node = to_node(start)
            end_node = to_node(end)
            queue = [start_node]
            seen = {start_node}
            while queue:
                node = queue.pop(0)
                pt = (float(node[0]), float(node[1]))
                graph.add_node(node)
                if node == end_node:
                    break
                for nxt in neighbors((round(pt[0] / grid) * grid, round(pt[1] / grid) * grid)):
                    nxt_node = to_node(nxt)
                    graph.add_edge(node, nxt_node, weight=math.hypot(nxt[0] - pt[0], nxt[1] - pt[1]))
                    if nxt_node not in seen:
                        seen.add(nxt_node)
                        queue.append(nxt_node)
            node_path = nx.shortest_path(graph, start_node, end_node, weight="weight")
            path = [(float(x), float(y)) for x, y in node_path]
            used_networkx = True
        except Exception:
            path = []

    if not path:
        open_set: list[tuple[float, tuple[float, float]]] = [(0.0, start)]
        came_from: dict[tuple[float, float], tuple[float, float]] = {}
        g_score: dict[tuple[float, float], float] = {start: 0.0}
        visited: set[tuple[float, float]] = set()

        while open_set:
            _priority, current = heapq.heappop(open_set)
            if current in visited:
                continue
            visited.add(current)
            if heuristic(current, end) <= grid:
                came_from[end] = current
                break

            for nxt in neighbors(current):
                tentative = g_score[current] + math.hypot(nxt[0] - current[0], nxt[1] - current[1])
                if tentative < g_score.get(nxt, float("inf")):
                    came_from[nxt] = current
                    g_score[nxt] = tentative
                    heapq.heappush(open_set, (tentative + heuristic(nxt, end), nxt))

        if end in came_from or start == end:
            node = end
            path = [end]
            while node in came_from:
                node = came_from[node]
                path.append(node)
            path.reverse()

    if not path:
        path = [start, end]
        status = "fallback-straight"
        warnings = ["No obstacle-free grid path was found, so a straight fallback route was returned."]
    else:
        status = "routed"
        warnings = []

    turn_count = 0
    prev_dir: tuple[float, float] | None = None
    length_mm = 0.0
    path_points = [{"x": round(p[0], 2), "y": round(p[1], 2), "z": 0.0} for p in path]
    for i in range(1, len(path)):
        dx = path[i][0] - path[i - 1][0]
        dy = path[i][1] - path[i - 1][1]
        length_mm += math.hypot(dx, dy)
        direction = (0.0 if dx == 0 else round(dx / abs(dx), 2), 0.0 if dy == 0 else round(dy / abs(dy), 2))
        if prev_dir is not None and direction != prev_dir:
            turn_count += 1
        prev_dir = direction

    result = {
        "project_id": project_id,
        "project_name": project.name,
        "system": payload.system,
        "status": status,
        "warnings": warnings,
        "used_networkx": used_networkx,
        "input": payload.model_dump(),
        "path": path_points,
        "length_mm": round(length_mm, 2),
        "length_m": round(length_mm / 1000.0, 2),
        "turn_count": turn_count,
        "obstacle_count": len(obstacles),
        "project_context": {
            "estimated_floor_area_m2": context["estimated_floor_area_m2"],
            "routing_obstacles": len(context["routing_obstacles"]),
        },
    }
    _persist_result(project_id, "module-22-mep-route.json", result)
    return result


@router.post("/{project_id}/modules/mep/clearance-check")
async def mep_clearance_check(project_id: str, payload: ClearanceCheckRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise _project_not_found(project_id)

    violations: list[dict[str, Any]] = []
    for idx, a in enumerate(payload.fixtures):
        box_a = {"min": list(map(float, a.min)), "max": list(map(float, a.max))}
        for b in payload.fixtures[idx + 1 :]:
            box_b = {"min": list(map(float, b.min)), "max": list(map(float, b.max))}
            clearance = _aabb_clearance_2d(box_a, box_b)
            if clearance < float(payload.min_clearance_mm) or _aabb_overlap_2d(box_a, box_b):
                violations.append(
                    {
                        "a_id": a.id,
                        "b_id": b.id,
                        "a_type": a.type,
                        "b_type": b.type,
                        "clearance_mm": round(clearance, 2),
                        "min_required_mm": float(payload.min_clearance_mm),
                        "overlap": _aabb_overlap_2d(box_a, box_b),
                    }
                )

    result = {
        "project_id": project_id,
        "checked": len(payload.fixtures),
        "violations": violations,
    }
    _persist_result(project_id, "module-22-mep-clearance.json", result)
    return result


@router.post("/{project_id}/modules/mep/fixture-placement")
async def mep_fixture_placement(project_id: str, payload: FixturePlacementRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise _project_not_found(project_id)

    room_width_mm = max(payload.room_width_mm, 1.0)
    room_depth_mm = max(payload.room_depth_mm, 1.0)
    count = max(1, payload.count)
    usable_width = max(room_width_mm - 2.0 * payload.fixture_clearance_mm, 1.0)
    spacing = usable_width / (count + 1)
    fixtures = []
    for idx in range(count):
        x = payload.fixture_clearance_mm + spacing * (idx + 1)
        fixtures.append(
            {
                "id": f"fixture_{idx + 1}",
                "type": "fixture",
                "x_mm": round(x, 2),
                "y_mm": round(payload.fixture_depth_mm, 2),
                "note": "Placed on the room perimeter with clearance maintained.",
            }
        )

    result = {
        "project_id": project_id,
        "fixtures": fixtures,
        "room": {
            "width_mm": room_width_mm,
            "depth_mm": room_depth_mm,
            "fixture_clearance_mm": payload.fixture_clearance_mm,
        },
    }
    _persist_result(project_id, "module-22-mep-fixture-placement.json", result)
    return result


@router.post("/{project_id}/modules/electrical/template-preview")
async def electrical_template_preview(
    project_id: str,
    payload: ElectricalTemplateRequest,
    db: AsyncSession = Depends(get_db),
):
    project, elements, model_elements, _materials = await _load_project_bundle(project_id, db)
    context = _project_context(project, elements, model_elements)

    if payload.mep_discipline != "electrical":
        raise HTTPException(
            status_code=400,
            detail="This preview generates Electrical layouts only (discipline='electrical'). Use other MEP tools for sewage, fire, or HVAC.",
        )

    width_mm = max(float(payload.room_width_mm), 1.0)
    depth_mm = max(float(payload.room_depth_mm), 1.0)
    ceiling_height_mm = max(float(payload.ceiling_height_mm), 2400.0)
    occupancy = max(int(payload.occupancy), 0)
    stage_depth_mm = max(float(payload.stage_depth_mm), 1200.0)

    room_type = payload.room_type
    template_id = f"mep_{payload.building_type}_{room_type}_v1"
    base_voltage = max(float(payload.preferred_voltage_v), 110.0)
    center_x = width_mm / 2.0
    center_y = depth_mm / 2.0
    entry_margin = min(900.0, max(450.0, width_mm * 0.12))

    plan_skew_x, plan_skew_y = _building_plan_skew_mm(payload.building_type, width_mm, depth_mm)
    tw_dx, tw_dy = _teaching_wall_shift_mm(payload.teaching_wall_side, width_mm, depth_mm)

    fixtures: list[dict[str, Any]] = []
    circuits: list[dict[str, Any]] = []
    manual_edit_hints: list[str] = []
    rules_used: list[str] = []
    rules_used.extend(INDIAN_ELECTRICAL_CODE_REFERENCES)
    if payload.building_type == "hospital":
        rules_used.append("Healthcare occupancy — coordinate IPS / medical earthing in detailed design.")
    if payload.teaching_wall_side:
        manual_edit_hints.append(
            f"Teaching wall set to {payload.teaching_wall_side}; luminaire cluster biased away from the board wall.",
        )

    def add_circuit(circuit_id: str, label: str, breaker: str, load_type: str, route_start: tuple[float, float], route_end: tuple[float, float]) -> dict[str, Any]:
        route = _template_route(route_start, route_end)
        circuit = {
            "id": circuit_id,
            "label": label,
            "breaker": breaker,
            "load_type": load_type,
            "voltage_v": round(base_voltage, 2),
            "route": route,
            "length_mm": round(sum(math.hypot(route[i]["x"] - route[i - 1]["x"], route[i]["y"] - route[i - 1]["y"]) for i in range(1, len(route))), 2),
        }
        circuits.append(circuit)
        return circuit

    db_point = (entry_margin, min(ceiling_height_mm * 0.15, depth_mm - 300.0))
    if payload.entry_side == "north":
        db_point = (entry_margin, depth_mm - 250.0)
    elif payload.entry_side == "east":
        db_point = (width_mm - 250.0, entry_margin)
    elif payload.entry_side == "west":
        db_point = (250.0, entry_margin)

    if room_type == "classroom":
        center_x = width_mm * 0.5 + plan_skew_x + tw_dx
        center_y = depth_mm * 0.5 + plan_skew_y + tw_dy
        offset_x = max(900.0, width_mm * 0.16)
        offset_y = max(700.0, depth_mm * 0.14)
        light_positions = [
            (center_x - offset_x, center_y - offset_y),
            (center_x + offset_x, center_y - offset_y),
            (center_x - offset_x, center_y + offset_y),
            (center_x + offset_x, center_y + offset_y),
        ]
        socket_y = depth_mm - 250.0
        socket_positions = [(width_mm * 0.12, socket_y), (width_mm * 0.88, socket_y), (width_mm * 0.12, 250.0), (width_mm * 0.88, 250.0)]
        switch_positions = [(entry_margin, 200.0), (entry_margin + 140.0, 200.0)]
        rules_used.extend([
            "Four ceiling luminaires on a teaching-biased grid (not purely symmetric when teaching wall is set).",
            "Socket outlets distributed across front/rear walls per classroom practice.",
            "Switchboard near entry; NBC/IS wiring discipline for routing.",
        ])
        manual_edit_hints.extend([
            "Move the rear sockets if the classroom has a teaching wall or projector screen.",
            "Add a dedicated projector or smart-board socket if needed.",
        ])
        add_circuit("ckt_lighting", "Lighting Circuit", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_power", "Socket Circuit", "16A MCB", "power", db_point, (width_mm * 0.88, socket_y))
        for idx, (x_mm, y_mm) in enumerate(light_positions, start=1):
            fixtures.append(_template_fixture(f"light_{idx}", "light", x_mm, y_mm, circuit_id="ckt_lighting", note="Ceiling light"))
        for idx, (x_mm, y_mm) in enumerate(socket_positions, start=1):
            fixtures.append(_template_fixture(f"socket_{idx}", "socket", x_mm, y_mm, circuit_id="ckt_power", wall_side="north" if y_mm > depth_mm / 2.0 else "south", note="Dual socket outlet"))
        for idx, (x_mm, y_mm) in enumerate(switch_positions, start=1):
            fixtures.append(_template_fixture(f"switch_{idx}", "switch", x_mm, y_mm, circuit_id="ckt_lighting", wall_side=payload.entry_side, note="Switch near entry"))

    elif room_type == "corridor":
        count = max(2, int(round(width_mm / 2400.0)))
        spacing = width_mm / (count + 1)
        rules_used.extend([
            "Linear lighting laid out along the corridor centerline.",
            "Emergency lights follow the entry-to-exit axis.",
        ])
        manual_edit_hints.append("Shift the centerline fixtures if the corridor is dog-legged or has a junction.")
        add_circuit("ckt_corridor_light", "Corridor Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        if payload.include_emergency_circuit:
            add_circuit("ckt_corridor_emg", "Emergency Circuit", "6A MCB", "emergency", db_point, (width_mm * 0.9, depth_mm * 0.5))
        corridor_y = depth_mm * (0.5 + 0.25 * (plan_skew_y / max(depth_mm, 1.0)))
        corridor_y = max(depth_mm * 0.28, min(depth_mm * 0.72, corridor_y))
        for idx in range(count):
            x_mm = spacing * (idx + 1)
            fixtures.append(_template_fixture(f"corridor_light_{idx + 1}", "light", x_mm, corridor_y, circuit_id="ckt_corridor_light", note="Linear corridor light"))
        if payload.include_emergency_circuit:
            fixtures.append(_template_fixture("corridor_emergency_1", "emergency_light", width_mm * 0.08, corridor_y, circuit_id="ckt_corridor_emg", note="Exit-side emergency light"))
            fixtures.append(_template_fixture("corridor_emergency_2", "emergency_light", width_mm * 0.92, corridor_y, circuit_id="ckt_corridor_emg", note="Exit-side emergency light"))

    elif room_type in ("staff_room", "principal_office", "meeting_room"):
        fixtures.extend([
            _template_fixture("staff_light_1", "light", width_mm * 0.33, depth_mm * 0.35, circuit_id="ckt_staff_light", note="Ceiling light"),
            _template_fixture("staff_light_2", "light", width_mm * 0.66, depth_mm * 0.65, circuit_id="ckt_staff_light", note="Ceiling light"),
            _template_fixture("staff_socket_1", "socket", width_mm * 0.12, depth_mm * 0.88, circuit_id="ckt_staff_power", wall_side="south", note="Workstation socket"),
            _template_fixture("staff_socket_2", "socket", width_mm * 0.88, depth_mm * 0.88, circuit_id="ckt_staff_power", wall_side="south", note="Workstation socket"),
            _template_fixture("staff_socket_3", "socket", width_mm * 0.12, depth_mm * 0.12, circuit_id="ckt_staff_power", wall_side="north", note="Printer socket"),
            _template_fixture("staff_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_staff_light", wall_side=payload.entry_side, note="Switch near entry"),
        ])
        if room_type == "principal_office":
            rules_used.append("Principal office — desk/task lighting with visitor-side power.")
        elif room_type == "meeting_room":
            rules_used.append("Meeting room — AV wall power and conferencing outlets (conceptual).")
        else:
            rules_used.append("Two lighting points and a small socket cluster for desks/printers.")
        manual_edit_hints.append("Add a dedicated AC or pantry outlet if the staff room needs it.")
        add_circuit("ckt_staff_light", "Staff Room Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_staff_power", "Staff Room Power", "16A MCB", "power", db_point, (width_mm * 0.88, depth_mm * 0.88))

    elif room_type == "library":
        grid_cols = 3 if width_mm >= 5000 else 2
        grid_rows = 2 if depth_mm >= 5000 else 1
        rules_used.extend([
            "Ceiling lighting is arranged as a reading grid.",
            "Power points are concentrated along study table edges.",
        ])
        manual_edit_hints.append("Increase the socket count if the library has computer workstations.")
        add_circuit("ckt_library_light", "Library Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_library_power", "Library Power", "16A MCB", "power", db_point, (width_mm * 0.85, depth_mm * 0.85))
        for r in range(grid_rows):
            for c in range(grid_cols):
                x_mm = (width_mm / (grid_cols + 1)) * (c + 1)
                y_mm = (depth_mm / (grid_rows + 1)) * (r + 1)
                fixtures.append(_template_fixture(f"library_light_{r + 1}_{c + 1}", "light", x_mm, y_mm, circuit_id="ckt_library_light", note="Reading light grid"))
        fixtures.append(_template_fixture("library_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_library_light", wall_side=payload.entry_side, note="Main switch"))
        for idx, x_mm in enumerate((width_mm * 0.12, width_mm * 0.5, width_mm * 0.88), start=1):
            fixtures.append(_template_fixture(f"library_socket_{idx}", "socket", x_mm, depth_mm * 0.86, circuit_id="ckt_library_power", wall_side="south", note="Study table socket"))

    elif room_type == "auditorium":
        rows = max(3, payload.seating_rows or int(round(depth_mm / 3500.0)))
        light_rows = max(3, min(6, rows))
        rules_used.extend([
            "Lighting tracks are distributed above seating rows and stage areas.",
            "A dedicated stage circuit is isolated from seating circuits.",
            "Emergency lighting is retained along the entry and exit edges.",
        ])
        manual_edit_hints.extend([
            "Move the stage sockets if there is a fixed projector screen or LED wall.",
            "If the auditorium is tiered, adjust the y positions to match the stepped seating layout.",
        ])
        add_circuit("ckt_auditorium_seating", "Auditorium Seating Lights", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.55))
        add_circuit("ckt_auditorium_stage", "Auditorium Stage Power", "20A MCB", "stage_power", db_point, (width_mm * 0.5, stage_depth_mm * 0.5))
        if payload.include_emergency_circuit:
            add_circuit("ckt_auditorium_emg", "Auditorium Emergency", "6A MCB", "emergency", db_point, (width_mm * 0.92, depth_mm * 0.5))
        for row in range(light_rows):
            y_mm = depth_mm * (0.2 + 0.12 * row)
            fixtures.append(_template_fixture(f"aud_light_{row + 1}", "light", width_mm * 0.5, y_mm, circuit_id="ckt_auditorium_seating", note="Seating bay light"))
        fixtures.extend([
            _template_fixture("aud_stage_light_1", "stage_light", width_mm * 0.25, stage_depth_mm * 0.4, circuit_id="ckt_auditorium_stage", note="Stage wash"),
            _template_fixture("aud_stage_light_2", "stage_light", width_mm * 0.75, stage_depth_mm * 0.4, circuit_id="ckt_auditorium_stage", note="Stage wash"),
            _template_fixture("aud_stage_socket_1", "socket", width_mm * 0.18, stage_depth_mm * 0.85, circuit_id="ckt_auditorium_stage", note="Projector / AV socket"),
            _template_fixture("aud_stage_socket_2", "socket", width_mm * 0.82, stage_depth_mm * 0.85, circuit_id="ckt_auditorium_stage", note="Backline socket"),
            _template_fixture("aud_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_auditorium_seating", wall_side=payload.entry_side, note="Lighting control"),
        ])
        if payload.include_emergency_circuit:
            fixtures.extend([
                _template_fixture("aud_emergency_1", "emergency_light", width_mm * 0.08, depth_mm * 0.18, circuit_id="ckt_auditorium_emg", note="Exit light"),
                _template_fixture("aud_emergency_2", "emergency_light", width_mm * 0.92, depth_mm * 0.18, circuit_id="ckt_auditorium_emg", note="Exit light"),
            ])

    elif room_type == "washroom":
        rules_used.extend([
            "Simple lighting with a small accessory power group.",
            "Emergency lighting is optional and kept separate.",
        ])
        manual_edit_hints.append("Add fan/exhaust and geyser power points if the washroom layout requires them.")
        add_circuit("ckt_washroom_light", "Washroom Lighting", "6A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_washroom_power", "Washroom Power", "16A MCB", "power", db_point, (width_mm * 0.8, depth_mm * 0.8))
        fixtures.extend([
            _template_fixture("wash_light_1", "light", width_mm * 0.5, depth_mm * 0.35, circuit_id="ckt_washroom_light", note="Ceiling light"),
            _template_fixture("wash_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_washroom_light", wall_side=payload.entry_side, note="Entry switch"),
            _template_fixture("wash_socket_1", "socket", width_mm * 0.82, depth_mm * 0.78, circuit_id="ckt_washroom_power", wall_side="south", note="Accessory socket"),
        ])
        if payload.include_emergency_circuit:
            add_circuit("ckt_washroom_emg", "Washroom Emergency", "6A MCB", "emergency", db_point, (width_mm * 0.9, depth_mm * 0.5))
            fixtures.append(_template_fixture("wash_emergency_1", "emergency_light", width_mm * 0.12, depth_mm * 0.88, circuit_id="ckt_washroom_emg", note="Emergency light"))

    elif room_type in ("lab", "chemistry_lab", "physics_lab", "computer_lab"):
        bench_count = max(2, int(round(width_mm / 2400.0)))
        if room_type == "chemistry_lab":
            rules_used.extend([
                "Chemistry lab — bench lighting grid; segregate exhaust/island loads in detailed design.",
                "Higher caution for segregated circuits near sinks/fume zones (conceptual).",
            ])
        elif room_type == "physics_lab":
            rules_used.extend([
                "Physics lab — instrument benches with grouped power for experiments.",
                "Consider EPBX / earth reference for sensitive benches in execution.",
            ])
        elif room_type == "computer_lab":
            rules_used.extend([
                "Computer lab — elevated ICT outlet density along bench rows.",
                "Dedicated UPS / earth bus for ICT loads in detailed design.",
            ])
        else:
            rules_used.extend([
                "Lighting is placed on the working grid.",
                "Socket density is higher to support lab benches and equipment.",
            ])
        manual_edit_hints.extend([
            "Increase protected outlets if the lab has equipment islands.",
            "Keep emergency isolation near the door if the lab requires shutdown control.",
        ])
        add_circuit("ckt_lab_light", "Lab Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_lab_power", "Lab Power", "20A MCB", "power", db_point, (width_mm * 0.85, depth_mm * 0.85))
        if payload.include_emergency_circuit:
            add_circuit("ckt_lab_emg", "Lab Emergency", "6A MCB", "emergency", db_point, (width_mm * 0.9, depth_mm * 0.5))
        for idx in range(max(2, bench_count)):
            x_mm = (width_mm / (bench_count + 1)) * (idx + 1)
            fixtures.append(_template_fixture(f"lab_light_{idx + 1}", "light", x_mm, depth_mm * 0.32, circuit_id="ckt_lab_light", note="Bench light"))
            fixtures.append(_template_fixture(f"lab_socket_{idx + 1}", "socket", x_mm, depth_mm * 0.82, circuit_id="ckt_lab_power", wall_side="south", note="Bench socket"))
        fixtures.extend([
            _template_fixture("lab_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_lab_light", wall_side=payload.entry_side, note="Light switch"),
            _template_fixture("lab_switch_2", "switch", entry_margin + 140.0, 180.0, circuit_id="ckt_lab_light", wall_side=payload.entry_side, note="Master switch"),
        ])
        if payload.include_emergency_circuit:
            fixtures.append(_template_fixture("lab_emergency_1", "emergency_light", width_mm * 0.08, depth_mm * 0.12, circuit_id="ckt_lab_emg", note="Emergency exit light"))

    elif room_type == "icu":
        rules_used.extend([
            "ICU — headwall medical power groups (conceptual IPS coordination).",
            "Night / observation lighting split from general circuits.",
        ])
        add_circuit("ckt_icu_general", "ICU General Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.35, depth_mm * 0.5))
        add_circuit("ckt_icu_med", "ICU Medical Power", "20A MCB", "power", db_point, (width_mm * 0.15, depth_mm * 0.55))
        fixtures.extend([
            _template_fixture("icu_light_1", "light", width_mm * 0.35, depth_mm * 0.42, circuit_id="ckt_icu_general", note="General observation"),
            _template_fixture("icu_light_2", "light", width_mm * 0.65, depth_mm * 0.42, circuit_id="ckt_icu_general", note="General observation"),
            _template_fixture("icu_socket_bed", "socket", width_mm * 0.12, depth_mm * 0.55, circuit_id="ckt_icu_med", wall_side="west", note="Headwall medical group"),
            _template_fixture("icu_socket_eq", "socket", width_mm * 0.88, depth_mm * 0.48, circuit_id="ckt_icu_med", wall_side="east", note="Equipment outlet"),
            _template_fixture("icu_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_icu_general", wall_side=payload.entry_side, note="Lighting control"),
        ])

    elif room_type == "operation_theatre":
        rules_used.extend([
            "OT — isolated panels / UPS feeds coordinated with medical planner (conceptual).",
            "Non-glare surgical field lighting layout reference.",
        ])
        add_circuit("ckt_ot_clean", "OT Clean Power", "32A MCB", "power", db_point, (width_mm * 0.5, depth_mm * 0.45))
        add_circuit("ckt_ot_ambient", "OT Ambient", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.6))
        fixtures.extend([
            _template_fixture("ot_light_field", "light", width_mm * 0.5, depth_mm * 0.48, circuit_id="ckt_ot_ambient", note="Procedure field"),
            _template_fixture("ot_light_perim", "light", width_mm * 0.22, depth_mm * 0.72, circuit_id="ckt_ot_ambient", note="Perimeter"),
            _template_fixture("ot_light_perim2", "light", width_mm * 0.78, depth_mm * 0.72, circuit_id="ckt_ot_ambient", note="Perimeter"),
            _template_fixture("ot_panel", "socket", width_mm * 0.88, depth_mm * 0.35, circuit_id="ckt_ot_clean", wall_side="east", note="Isolated panel reference"),
            _template_fixture("ot_switch", "switch", entry_margin, 180.0, circuit_id="ckt_ot_ambient", wall_side=payload.entry_side, note="Control"),
        ])

    elif room_type in ("emergency_ward", "patient_waiting", "blood_collection_lab"):
        rules_used.extend([
            "Healthcare circulation / diagnostics — ingress lighting and accessible outlets.",
            "Coordinate emergency egress luminaires with NBC exit requirements.",
        ])
        add_circuit("ckt_hc_light", "Healthcare Zone Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.45))
        add_circuit("ckt_hc_power", "Healthcare Zone Power", "16A MCB", "power", db_point, (width_mm * 0.82, depth_mm * 0.72))
        fixtures.extend([
            _template_fixture("hc_light_1", "light", width_mm * 0.35 + plan_skew_x * 0.3, depth_mm * 0.4, circuit_id="ckt_hc_light", note="General"),
            _template_fixture("hc_light_2", "light", width_mm * 0.65 + plan_skew_x * 0.3, depth_mm * 0.55, circuit_id="ckt_hc_light", note="General"),
            _template_fixture("hc_socket_1", "socket", width_mm * 0.15, depth_mm * 0.78, circuit_id="ckt_hc_power", wall_side="south", note="Bed/waiting outlet"),
            _template_fixture("hc_socket_2", "socket", width_mm * 0.85, depth_mm * 0.78, circuit_id="ckt_hc_power", wall_side="south", note="Equipment"),
            _template_fixture("hc_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_hc_light", wall_side=payload.entry_side, note="Switch"),
        ])
        if payload.include_emergency_circuit:
            add_circuit("ckt_hc_emg", "Healthcare Emergency", "6A MCB", "emergency", db_point, (width_mm * 0.92, depth_mm * 0.5))
            fixtures.append(_template_fixture("hc_emg_1", "emergency_light", width_mm * 0.5, depth_mm * 0.88, circuit_id="ckt_hc_emg", note="Egress"))

    elif room_type == "reception":
        rx = center_x + plan_skew_x * 0.8
        rules_used.extend([
            "Front desk sockets are grouped near the reception counter.",
            "Ambient lighting biased by building typology (not fixed single-axis).",
        ])
        manual_edit_hints.append("Move the desk sockets if the counter orientation changes after furniture placement.")
        add_circuit("ckt_reception_light", "Reception Lighting", "10A MCB", "lighting", db_point, (width_mm * 0.5, depth_mm * 0.5))
        add_circuit("ckt_reception_power", "Reception Power", "16A MCB", "power", db_point, (width_mm * 0.88, depth_mm * 0.78))
        fixtures.extend([
            _template_fixture("rec_light_1", "light", rx, depth_mm * 0.33 + plan_skew_y * 0.5, circuit_id="ckt_reception_light", note="Ambient light"),
            _template_fixture("rec_light_2", "light", rx, depth_mm * 0.68 + plan_skew_y * 0.5, circuit_id="ckt_reception_light", note="Ambient light"),
            _template_fixture("rec_switch_1", "switch", entry_margin, 180.0, circuit_id="ckt_reception_light", wall_side=payload.entry_side, note="Main switch"),
            _template_fixture("rec_socket_1", "socket", width_mm * 0.82, depth_mm * 0.78, circuit_id="ckt_reception_power", wall_side="south", note="Counter socket"),
            _template_fixture("rec_socket_2", "socket", width_mm * 0.72, depth_mm * 0.78, circuit_id="ckt_reception_power", wall_side="south", note="Printer socket"),
        ])

    if not rules_used:
        rules_used.append("Template generated with standard educational-building assumptions.")

    fixture_count_by_type: dict[str, int] = {}
    for fixture in fixtures:
        fixture_count_by_type[fixture["type"]] = fixture_count_by_type.get(fixture["type"], 0) + 1

    result = {
        "project_id": project_id,
        "project_name": project.name,
        "template_id": template_id,
        "room": {
            "name": payload.room_name or room_type.replace("_", " ").title(),
            "type": room_type,
            "building_type": payload.building_type,
            "mep_discipline": payload.mep_discipline,
            "teaching_wall_side": payload.teaching_wall_side,
            "width_mm": round(width_mm, 2),
            "depth_mm": round(depth_mm, 2),
            "ceiling_height_mm": round(ceiling_height_mm, 2),
            "occupancy": occupancy,
            "entry_side": payload.entry_side,
        },
        "summary": {
            "fixtures": len(fixtures),
            "circuits": len(circuits),
            "light_points": fixture_count_by_type.get("light", 0) + fixture_count_by_type.get("stage_light", 0),
            "socket_points": fixture_count_by_type.get("socket", 0),
            "emergency_points": fixture_count_by_type.get("emergency_light", 0),
        },
        "fixtures": fixtures,
        "circuits": circuits,
        "rules_used": rules_used,
        "manual_edit_hints": manual_edit_hints,
        "project_context": {
            "estimated_floor_area_m2": context["estimated_floor_area_m2"],
            "routing_obstacles": len(context["routing_obstacles"]),
        },
    }
    _persist_result(project_id, "module-24-electrical-template.json", result)
    return result


@router.post("/{project_id}/modules/energy/analyze")
async def energy_analyze(project_id: str, payload: EnergyAnalysisRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise _project_not_found(project_id)

    cooling_load_kw = (
        payload.floor_area_m2 * 0.085 * payload.climate_factor
        + payload.window_area_m2 * 0.18 * payload.shading_factor
        + max(payload.occupancy, 0) * 0.12
    )
    solar_heat_gain_kw = payload.window_area_m2 * 0.15 * payload.climate_factor
    daylight_score = max(0.0, min(100.0, 100.0 - abs((payload.window_area_m2 / max(payload.floor_area_m2, 1.0)) - 0.22) * 250.0))
    energy_score = max(
        0.0,
        min(
            100.0,
            100.0 - cooling_load_kw * 3.5 - solar_heat_gain_kw * 2.0 - payload.roof_exposure * 4.0 + daylight_score * 0.15,
        ),
    )

    recommendations: list[str] = []
    if solar_heat_gain_kw > 4.0:
        recommendations.append("Add external shading or reduce west-facing glazing exposure.")
    if cooling_load_kw > 15.0:
        recommendations.append("Review envelope U-values and consider higher-performance glazing.")
    if daylight_score < 55.0:
        recommendations.append("Increase window distribution or add light shelves for better daylighting.")
    if not recommendations:
        recommendations.append("Current inputs look balanced for a preliminary energy check.")

    result = {
        "project_id": project_id,
        "cooling_load_kw": round(cooling_load_kw, 2),
        "solar_heat_gain_kw": round(solar_heat_gain_kw, 2),
        "daylight_score": round(daylight_score, 1),
        "energy_score": round(energy_score, 1),
        "recommendations": recommendations,
        "input": payload.model_dump(),
    }
    _persist_result(project_id, "module-23-energy-analysis.json", result)
    return result


@router.post("/{project_id}/modules/rendering/preset")
async def rendering_preset(project_id: str, payload: RenderingPresetRequest, db: AsyncSession = Depends(get_db)):
    project, elements, model_elements, materials = await _load_project_bundle(project_id, db)
    context = _project_context(project, elements, model_elements)

    quality_map = {
        "draft": {"samples": 2, "shadow": "low", "exposure": 1.1},
        "client": {"samples": 8, "shadow": "medium", "exposure": 1.0},
        "presentation": {"samples": 16, "shadow": "high", "exposure": 0.95},
    }
    settings = quality_map[payload.quality]
    material_palette = [
        {"id": material.id, "name": material.name, "category": material.category, "color": material.color}
        for material in materials[:8]
    ]
    result = {
        "project_id": project_id,
        "quality": payload.quality,
        "walkthrough": payload.walkthrough,
        "sun_study": payload.sun_study,
        "material_preview": payload.material_preview,
        "settings": settings,
        "camera": {
            "distance": max(12.0, context["estimated_floor_area_m2"] ** 0.5 * 1.5 if context["estimated_floor_area_m2"] > 0 else 18.0),
            "target": [0.0, 1.5, 0.0],
            "fov": 50 if payload.quality != "draft" else 60,
        },
        "render_notes": [
            "Use a neutral sky light for client renders.",
            "Add sun/shadow pass for presentations.",
        ],
        "materials": material_palette,
        "project_context": {
            "floor_area_m2": context["estimated_floor_area_m2"],
            "wall_count": context["element_counts"]["walls"],
            "door_count": context["element_counts"]["doors"],
            "window_count": context["element_counts"]["windows"],
        },
    }
    _persist_result(project_id, "module-24-rendering-preset.json", result)
    return result