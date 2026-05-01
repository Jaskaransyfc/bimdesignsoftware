from __future__ import annotations

import ast
import json
import math
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BOQItem, Element, ModelElement, Project
from ..storage import get_file_content, upload_file

router = APIRouter(prefix="/api/projects", tags=["engines"])


def _safe_name(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in value.strip().lower())


class QuantityTask(BaseModel):
    id: str
    formula: str
    unit: str | None = None


class QuantityTakeoffPayload(BaseModel):
    tasks: list[QuantityTask] = Field(default_factory=list)


class CostMapItem(BaseModel):
    quantity_id: str
    sor_code: str
    description: str
    unit: str
    sor_rate: float
    contractor_rate: float | None = None


class CostingPayload(BaseModel):
    mappings: list[CostMapItem] = Field(default_factory=list)
    mismatch_threshold_percent: float = 10.0


class ClashElementBox(BaseModel):
    id: str
    type: str
    min: list[float]
    max: list[float]


class ClashTask(BaseModel):
    id: str
    a_type: str
    b_type: str
    min_clearance_mm: float = 0.0


class ClashPayload(BaseModel):
    tasks: list[ClashTask] = Field(default_factory=list)
    elements: list[ClashElementBox] = Field(default_factory=list)


@dataclass
class Metric:
    value: float
    unit: str


def _match_like(value: str, needle: str) -> bool:
    return needle.lower() in (value or "").lower()


def _sum_boq(items: list[BOQItem], ifc_prefix: str, quantity_like: str) -> float:
    total = 0.0
    for item in items:
        if item.ifc_type.startswith(ifc_prefix) and _match_like(item.quantity_name, quantity_like):
            total += abs(float(item.quantity_value or 0))
    return total


def _count_elements(elements: list[Element], ifc_prefix: str) -> int:
    return sum(1 for e in elements if (e.ifc_type or "").startswith(ifc_prefix))


def _prop_float(props: dict[str, Any] | None, keys: list[str]) -> float | None:
    if not isinstance(props, dict):
        return None
    lower = {str(k).strip().lower(): v for k, v in props.items()}
    for k in keys:
        if k.lower() not in lower:
            continue
        raw = lower[k.lower()]
        try:
            return float(str(raw).split()[0])
        except Exception:
            continue
    return None


def _compute_base_metrics(boq_items: list[BOQItem], elements: list[Element]) -> dict[str, Metric]:
    wall_area = _sum_boq(boq_items, "IfcWall", "Area")
    wall_volume = _sum_boq(boq_items, "IfcWall", "Volume")
    slab_concrete_volume = _sum_boq(boq_items, "IfcSlab", "Volume")
    beam_volume = _sum_boq(boq_items, "IfcBeam", "Volume")
    column_volume = _sum_boq(boq_items, "IfcColumn", "Volume")
    flooring_area = _sum_boq(boq_items, "IfcSlab", "Area")
    door_count = _count_elements(elements, "IfcDoor")
    window_count = _count_elements(elements, "IfcWindow")

    # Fallback using IFC properties extracted on elements when BOQ quantities are sparse.
    if wall_area <= 0 or wall_volume <= 0:
        fallback_area = 0.0
        fallback_vol = 0.0
        for el in elements:
            if not (el.ifc_type or "").startswith("IfcWall"):
                continue
            props = el.properties or {}
            area = _prop_float(props, ["area", "netsidearea", "grosssidearea"])
            vol = _prop_float(props, ["volume", "netvolume", "grossvolume"])
            if area is None:
                length = _prop_float(props, ["length", "netlength"])
                height = _prop_float(props, ["height", "unconnected height"])
                if length is not None and height is not None:
                    area = length * height
            if vol is None:
                length = _prop_float(props, ["length", "netlength"])
                height = _prop_float(props, ["height", "unconnected height"])
                thick = _prop_float(props, ["width", "thickness"])
                if length is not None and height is not None and thick is not None:
                    vol = length * height * thick
            if area is not None:
                fallback_area += abs(area)
            if vol is not None:
                fallback_vol += abs(vol)
        if wall_area <= 0 and fallback_area > 0:
            wall_area = fallback_area
        if wall_volume <= 0 and fallback_vol > 0:
            wall_volume = fallback_vol

    # Opening area from BOQ if available. If not, estimate via count.
    opening_area = _sum_boq(boq_items, "IfcDoor", "Area") + _sum_boq(boq_items, "IfcWindow", "Area")
    if opening_area <= 0:
        opening_area = float(door_count) * 2.0 + float(window_count) * 1.5

    paint_area = max(wall_area * 2.0 - opening_area, 0.0)
    plaster_area = max(wall_area * 2.0 - opening_area, 0.0)

    return {
        "wall_area": Metric(wall_area, "m2"),
        "wall_volume": Metric(wall_volume, "m3"),
        "slab_concrete_volume": Metric(slab_concrete_volume, "m3"),
        "beam_volume": Metric(beam_volume, "m3"),
        "column_volume": Metric(column_volume, "m3"),
        "door_count": Metric(float(door_count), "count"),
        "window_count": Metric(float(window_count), "count"),
        "paint_area": Metric(paint_area, "m2"),
        "plaster_area": Metric(plaster_area, "m2"),
        "flooring_area": Metric(flooring_area, "m2"),
        "opening_area": Metric(opening_area, "m2"),
    }


class _FormulaEvaluator(ast.NodeVisitor):
    allowed_binops = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)
    allowed_unary = (ast.UAdd, ast.USub)
    allowed_funcs = {"min": min, "max": max, "abs": abs, "round": round}

    def __init__(self, variables: dict[str, float]):
        self.variables = variables

    def visit_Expression(self, node: ast.Expression):
        return self.visit(node.body)

    def visit_Constant(self, node: ast.Constant):
        if isinstance(node.value, (int, float)):
            return float(node.value)
        raise ValueError("Only numeric constants are allowed")

    def visit_Name(self, node: ast.Name):
        if node.id not in self.variables:
            raise ValueError(f"Unknown variable: {node.id}")
        return float(self.variables[node.id])

    def visit_UnaryOp(self, node: ast.UnaryOp):
        if not isinstance(node.op, self.allowed_unary):
            raise ValueError("Unary operator not allowed")
        value = self.visit(node.operand)
        return +value if isinstance(node.op, ast.UAdd) else -value

    def visit_BinOp(self, node: ast.BinOp):
        if not isinstance(node.op, self.allowed_binops):
            raise ValueError("Operator not allowed")
        left = self.visit(node.left)
        right = self.visit(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            if right == 0:
                raise ValueError("Division by zero")
            return left / right
        if isinstance(node.op, ast.Pow):
            return left**right
        if isinstance(node.op, ast.Mod):
            return left % right
        raise ValueError("Unsupported operator")

    def visit_Call(self, node: ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only simple functions allowed")
        fn = self.allowed_funcs.get(node.func.id)
        if not fn:
            raise ValueError(f"Function not allowed: {node.func.id}")
        args = [self.visit(arg) for arg in node.args]
        return float(fn(*args))

    def generic_visit(self, node):
        raise ValueError(f"Unsupported expression: {type(node).__name__}")


def _eval_formula(expr: str, variables: dict[str, float]) -> float:
    parsed = ast.parse(expr, mode="eval")
    evaluator = _FormulaEvaluator(variables)
    return float(evaluator.visit(parsed))


@router.post("/{project_id}/module-14/takeoff")
async def module14_takeoff(
    project_id: str,
    payload: QuantityTakeoffPayload,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    boq_items = (await db.execute(select(BOQItem).where(BOQItem.project_id == project_id))).scalars().all()
    elements = (await db.execute(select(Element).where(Element.project_id == project_id))).scalars().all()

    metrics = _compute_base_metrics(boq_items, elements)
    result_items = [
        {"id": key, "value": round(metric.value, 4), "unit": metric.unit, "source": "builtin"}
        for key, metric in metrics.items()
    ]

    variables = {k: float(v.value) for k, v in metrics.items()}
    for task in payload.tasks:
        safe_id = _safe_name(task.id) or f"task_{len(result_items)+1}"
        try:
            value = _eval_formula(task.formula, variables)
            variables[safe_id] = value
            result_items.append(
                {"id": safe_id, "value": round(value, 4), "unit": task.unit or "custom", "source": "user_formula"}
            )
        except Exception as exc:
            result_items.append({"id": safe_id, "error": str(exc), "unit": task.unit or "custom", "source": "user_formula"})

    key = f"viewable/{project_id}/takeoff.json"
    upload_file(key, json.dumps({"items": result_items}, ensure_ascii=True).encode("utf-8"))
    return {"project_id": project_id, "items": result_items}


def _load_takeoff(project_id: str) -> dict[str, float]:
    key = f"viewable/{project_id}/takeoff.json"
    try:
        raw = get_file_content(key).decode("utf-8")
        items = json.loads(raw).get("items", [])
    except Exception:
        items = []
    result: dict[str, float] = {}
    for item in items:
        if "value" in item and "id" in item:
            result[str(item["id"])] = float(item["value"])
    return result


@router.post("/{project_id}/module-15/costing")
async def module15_costing(
    project_id: str,
    payload: CostingPayload,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    quantities = _load_takeoff(project_id)
    if not quantities:
        raise HTTPException(status_code=400, detail="Takeoff not available. Run Module 14 first.")

    boq_lines: list[dict[str, Any]] = []
    mismatches: list[dict[str, Any]] = []
    total_sor = 0.0
    total_contractor = 0.0

    for m in payload.mappings:
        qty_raw = float(quantities.get(_safe_name(m.quantity_id), quantities.get(m.quantity_id, 0.0)))
        qty = max(0.0, qty_raw)
        sor_amount = qty * float(m.sor_rate)
        contractor_rate = float(m.contractor_rate if m.contractor_rate is not None else m.sor_rate)
        contractor_amount = qty * contractor_rate
        total_sor += sor_amount
        total_contractor += contractor_amount
        line = {
            "quantity_id": m.quantity_id,
            "sor_code": m.sor_code,
            "description": m.description,
            "unit": m.unit,
            "quantity": round(qty, 4),
            "sor_rate": round(float(m.sor_rate), 4),
            "sor_amount": round(sor_amount, 2),
            "contractor_rate": round(contractor_rate, 4),
            "contractor_amount": round(contractor_amount, 2),
        }
        boq_lines.append(line)

        if m.contractor_rate is not None and m.sor_rate > 0:
            diff_pct = ((contractor_rate - float(m.sor_rate)) / float(m.sor_rate)) * 100.0
            if abs(diff_pct) >= payload.mismatch_threshold_percent:
                mismatches.append(
                    {
                        "sor_code": m.sor_code,
                        "description": m.description,
                        "sor_rate": m.sor_rate,
                        "contractor_rate": contractor_rate,
                        "rate_diff_percent": round(diff_pct, 2),
                    }
                )

    out = {
        "project_id": project_id,
        "boq_lines": boq_lines,
        "totals": {"sor_total": round(total_sor, 2), "contractor_total": round(total_contractor, 2)},
        "mismatches": mismatches,
    }
    upload_file(f"viewable/{project_id}/costing.json", json.dumps(out, ensure_ascii=True).encode("utf-8"))
    return out


def _aabb_overlap(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return not (
        a["max"][0] < b["min"][0]
        or a["min"][0] > b["max"][0]
        or a["max"][1] < b["min"][1]
        or a["min"][1] > b["max"][1]
        or a["max"][2] < b["min"][2]
        or a["min"][2] > b["max"][2]
    )


def _aabb_clearance_mm(a: dict[str, Any], b: dict[str, Any]) -> float:
    dx = max(0.0, max(a["min"][0] - b["max"][0], b["min"][0] - a["max"][0]))
    dy = max(0.0, max(a["min"][1] - b["max"][1], b["min"][1] - a["max"][1]))
    dz = max(0.0, max(a["min"][2] - b["max"][2], b["min"][2] - a["max"][2]))
    return math.sqrt(dx * dx + dy * dy + dz * dz) * 1000.0


def _model_element_to_aabb(el: ModelElement) -> dict[str, Any] | None:
    etype = str(el.type.value if hasattr(el.type, "value") else el.type)
    g = el.geometry or {}
    p = el.parameters or {}

    if "start" in g and "end" in g:
        s = g["start"]
        e = g["end"]
        t = float(p.get("thickness", el.thickness or 0.2))
        h = float(p.get("height", el.height or 3.0))
        minx = min(float(s[0]), float(e[0])) - t / 2
        maxx = max(float(s[0]), float(e[0])) + t / 2
        minz = min(float(s[2]), float(e[2])) - t / 2
        maxz = max(float(s[2]), float(e[2])) + t / 2
        miny = float(min(s[1], e[1]) if len(s) > 1 and len(e) > 1 else 0.0)
        maxy = miny + h
        return {"id": el.id, "type": etype, "min": [minx, miny, minz], "max": [maxx, maxy, maxz]}

    pos = g.get("position")
    if isinstance(pos, list) and len(pos) >= 3:
        w = float(p.get("width", 0.4))
        h = float(p.get("height", 3.0))
        d = float(p.get("depth", p.get("thickness", 0.4)))
        cx, cy, cz = float(pos[0]), float(pos[1]), float(pos[2])
        return {
            "id": el.id,
            "type": etype,
            "min": [cx - w / 2, cy - h / 2, cz - d / 2],
            "max": [cx + w / 2, cy + h / 2, cz + d / 2],
        }
    return None


@router.post("/{project_id}/module-16/clashes")
async def module16_clashes(
    project_id: str,
    payload: ClashPayload,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    model_elements = (await db.execute(select(ModelElement).where(ModelElement.project_id == project_id))).scalars().all()
    boxes: list[dict[str, Any]] = []
    for el in model_elements:
        box = _model_element_to_aabb(el)
        if box:
            boxes.append(box)

    for ext in payload.elements:
        if len(ext.min) == 3 and len(ext.max) == 3:
            boxes.append({"id": ext.id, "type": ext.type, "min": list(map(float, ext.min)), "max": list(map(float, ext.max))})

    results: list[dict[str, Any]] = []
    for task in payload.tasks:
        a_items = [b for b in boxes if _safe_name(b["type"]) == _safe_name(task.a_type)]
        b_items = [b for b in boxes if _safe_name(b["type"]) == _safe_name(task.b_type)]
        for a in a_items:
            for b in b_items:
                if a["id"] == b["id"]:
                    continue
                overlap = _aabb_overlap(a, b)
                clearance = _aabb_clearance_mm(a, b)
                violation = overlap or clearance < float(task.min_clearance_mm)
                if violation:
                    results.append(
                        {
                            "task_id": task.id,
                            "a_id": a["id"],
                            "b_id": b["id"],
                            "a_type": a["type"],
                            "b_type": b["type"],
                            "overlap": overlap,
                            "clearance_mm": round(clearance, 2),
                            "min_required_mm": float(task.min_clearance_mm),
                        }
                    )

    out = {"project_id": project_id, "checked_elements": len(boxes), "clashes": results}
    upload_file(f"viewable/{project_id}/clashes.json", json.dumps(out, ensure_ascii=True).encode("utf-8"))
    return out

