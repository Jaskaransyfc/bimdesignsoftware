from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BOQItem, Element, Project
from ..storage import get_file_content, upload_file

router = APIRouter(prefix="/api/projects", tags=["collaboration"])


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json_or_default(path: str, default: Any) -> Any:
    try:
        raw = get_file_content(path).decode("utf-8")
        return json.loads(raw)
    except Exception:
        return default


def _write_json(path: str, data: Any) -> None:
    upload_file(path, json.dumps(data, ensure_ascii=True).encode("utf-8"))


class CameraView(BaseModel):
    eye: list[float] = Field(default_factory=list)
    look: list[float] = Field(default_factory=list)
    up: list[float] = Field(default_factory=list)


class IssueCreate(BaseModel):
    title: str
    description: str = ""
    object_id: str | None = None
    object_type: str | None = None
    assigned_to: str | None = None
    status: Literal["open", "in_progress", "resolved", "closed"] = "open"
    priority: Literal["low", "medium", "high"] = "medium"
    camera_view: CameraView | None = None
    comments: list[dict[str, str]] = Field(default_factory=list)


class IssueUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    object_id: str | None = None
    object_type: str | None = None
    assigned_to: str | None = None
    status: Literal["open", "in_progress", "resolved", "closed"] | None = None
    priority: Literal["low", "medium", "high"] | None = None
    camera_view: CameraView | None = None
    comments: list[dict[str, str]] | None = None


class RolePayload(BaseModel):
    user_email: str
    role: Literal["owner", "engineer", "reviewer", "viewer", "contractor"]


class CommentPayload(BaseModel):
    author: str
    message: str


class VersionCreatePayload(BaseModel):
    label: str
    author: str
    note: str | None = None


class CompareVersionsPayload(BaseModel):
    base_version_id: str
    target_version_id: str


class StructuralTask(BaseModel):
    id: str
    type: Literal["beam_load_check", "column_load_check", "deflection_warning", "load_combination"]
    demand: float
    capacity: float
    limit: float | None = None


class StructuralPayload(BaseModel):
    tasks: list[StructuralTask] = Field(default_factory=list)
    use_auto_grid: bool = True
    load_factor_dead: float = 1.5
    load_factor_live: float = 1.5


def _issues_key(project_id: str) -> str:
    return f"viewable/{project_id}/issues.json"


def _collab_key(project_id: str) -> str:
    return f"viewable/{project_id}/collaboration.json"


def _versions_key(project_id: str) -> str:
    return f"viewable/{project_id}/versions.json"


def _takeoff_key(project_id: str) -> str:
    return f"viewable/{project_id}/takeoff.json"


def _costing_key(project_id: str) -> str:
    return f"viewable/{project_id}/costing.json"


def _walk_hierarchy_ids(node: Any, out: dict[str, dict[str, Any]]) -> None:
    if not isinstance(node, dict):
        return
    node_id = str(node.get("id") or "")
    node_type = str(node.get("type") or "")
    node_name = str(node.get("name") or "")
    if node_id:
        out[node_id] = {"id": node_id, "type": node_type, "name": node_name}
    children = node.get("children") or []
    if isinstance(children, list):
        for ch in children:
            _walk_hierarchy_ids(ch, out)


def _takeoff_total(project_id: str) -> float:
    data = _read_json_or_default(_takeoff_key(project_id), {"items": []})
    total = 0.0
    for item in data.get("items", []):
        if isinstance(item, dict) and "value" in item:
            try:
                total += float(item["value"])
            except Exception:
                pass
    return total


def _costing_total(project_id: str) -> float:
    data = _read_json_or_default(_costing_key(project_id), {"totals": {}})
    try:
        return float(data.get("totals", {}).get("sor_total", 0.0))
    except Exception:
        return 0.0


@router.get("/{project_id}/issues")
@router.get("/{project_id}/module-17/issues")
async def list_issues(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = _read_json_or_default(_issues_key(project_id), {"issues": []})
    return {"issues": data.get("issues", [])}


@router.post("/{project_id}/issues")
@router.post("/{project_id}/module-17/issues")
async def create_issue(project_id: str, payload: IssueCreate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = _read_json_or_default(_issues_key(project_id), {"issues": []})
    issues = data.get("issues", [])
    issue = payload.model_dump()
    issue["id"] = str(uuid4())
    issue["created_at"] = _utc_now()
    issue["updated_at"] = issue["created_at"]
    issues.append(issue)
    _write_json(_issues_key(project_id), {"issues": issues})

    collab = _read_json_or_default(_collab_key(project_id), {"roles": [], "activity_log": [], "comments": []})
    collab["activity_log"].append(
        {
            "id": str(uuid4()),
            "type": "issue_created",
            "timestamp": _utc_now(),
            "message": f"Issue created: {issue['title']}",
            "issue_id": issue["id"],
        }
    )
    _write_json(_collab_key(project_id), collab)
    return issue


@router.patch("/{project_id}/issues/{issue_id}")
@router.patch("/{project_id}/module-17/issues/{issue_id}")
async def update_issue(
    project_id: str,
    issue_id: str,
    payload: IssueUpdate,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = _read_json_or_default(_issues_key(project_id), {"issues": []})
    issues = data.get("issues", [])
    for issue in issues:
        if issue.get("id") == issue_id:
            for k, v in payload.model_dump(exclude_none=True).items():
                issue[k] = v
            issue["updated_at"] = _utc_now()
            _write_json(_issues_key(project_id), {"issues": issues})
            return issue
    raise HTTPException(status_code=404, detail="Issue not found")


@router.get("/{project_id}/issues/bcf-export")
@router.get("/{project_id}/module-17/bcf-export")
async def bcf_export(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    issues = _read_json_or_default(_issues_key(project_id), {"issues": []}).get("issues", [])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("bcf.version", "2.1")
        for issue in issues:
            issue_id = issue.get("id", str(uuid4()))
            topic_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Topic Guid="{issue_id}">
  <Title>{issue.get("title","Issue")}</Title>
  <Priority>{issue.get("priority","medium")}</Priority>
  <Stage>{issue.get("status","open")}</Stage>
  <Description>{issue.get("description","")}</Description>
  <AssignedTo>{issue.get("assigned_to","")}</AssignedTo>
</Topic>"""
            zf.writestr(f"{issue_id}/markup.bcf", topic_xml)
    from starlette.responses import StreamingResponse

    return StreamingResponse(
        io.BytesIO(buf.getvalue()),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{project_id}_issues.bcfzip"'},
    )


@router.get("/{project_id}/collaboration")
@router.get("/{project_id}/module-18/collaboration")
async def get_collaboration(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = _read_json_or_default(_collab_key(project_id), {"roles": [], "activity_log": [], "comments": []})
    return data


@router.post("/{project_id}/collaboration/roles")
@router.post("/{project_id}/module-18/roles")
async def set_role(project_id: str, payload: RolePayload, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = _read_json_or_default(_collab_key(project_id), {"roles": [], "activity_log": [], "comments": []})
    roles = data.get("roles", [])
    updated = False
    for role in roles:
        if role.get("user_email") == payload.user_email:
            role["role"] = payload.role
            updated = True
            break
    if not updated:
        roles.append(payload.model_dump())
    data["activity_log"].append(
        {
            "id": str(uuid4()),
            "type": "role_updated",
            "timestamp": _utc_now(),
            "message": f"Role set for {payload.user_email}: {payload.role}",
        }
    )
    _write_json(_collab_key(project_id), data)
    return {"roles": roles}


@router.post("/{project_id}/collaboration/comments")
@router.post("/{project_id}/module-18/comments")
async def add_comment(project_id: str, payload: CommentPayload, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = _read_json_or_default(_collab_key(project_id), {"roles": [], "activity_log": [], "comments": []})
    comment = {"id": str(uuid4()), "author": payload.author, "message": payload.message, "timestamp": _utc_now()}
    data["comments"].append(comment)
    data["activity_log"].append(
        {
            "id": str(uuid4()),
            "type": "comment_added",
            "timestamp": _utc_now(),
            "message": f"Comment added by {payload.author}",
        }
    )
    _write_json(_collab_key(project_id), data)
    return comment


@router.post("/{project_id}/versions")
@router.post("/{project_id}/module-18/versions")
async def create_version(project_id: str, payload: VersionCreatePayload, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    versions_data = _read_json_or_default(_versions_key(project_id), {"versions": []})
    versions = versions_data.get("versions", [])

    hierarchy_map: dict[str, dict[str, Any]] = {}
    _walk_hierarchy_ids(project.hierarchy or {}, hierarchy_map)
    quantity_total = _takeoff_total(project_id)
    cost_total = _costing_total(project_id)

    version = {
        "id": str(uuid4()),
        "label": payload.label,
        "author": payload.author,
        "note": payload.note or "",
        "created_at": _utc_now(),
        "object_map": hierarchy_map,
        "quantity_total": quantity_total,
        "cost_total": cost_total,
    }
    versions.append(version)
    _write_json(_versions_key(project_id), {"versions": versions})

    collab = _read_json_or_default(_collab_key(project_id), {"roles": [], "activity_log": [], "comments": []})
    collab["activity_log"].append(
        {
            "id": str(uuid4()),
            "type": "version_created",
            "timestamp": _utc_now(),
            "message": f"Version created: {payload.label}",
            "version_id": version["id"],
        }
    )
    _write_json(_collab_key(project_id), collab)
    return version


@router.get("/{project_id}/versions")
@router.get("/{project_id}/module-18/versions")
async def list_versions(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _read_json_or_default(_versions_key(project_id), {"versions": []})


@router.post("/{project_id}/version-compare")
@router.post("/{project_id}/module-19/compare")
async def compare_versions(
    project_id: str,
    payload: CompareVersionsPayload,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    versions = _read_json_or_default(_versions_key(project_id), {"versions": []}).get("versions", [])
    base = next((v for v in versions if v.get("id") == payload.base_version_id), None)
    target = next((v for v in versions if v.get("id") == payload.target_version_id), None)
    if not base or not target:
        raise HTTPException(status_code=404, detail="Version not found")

    base_map = base.get("object_map", {})
    target_map = target.get("object_map", {})
    base_ids = set(base_map.keys())
    target_ids = set(target_map.keys())
    added_ids = sorted(target_ids - base_ids)
    deleted_ids = sorted(base_ids - target_ids)
    common = base_ids & target_ids

    modified = []
    for oid in common:
        b = base_map.get(oid, {})
        t = target_map.get(oid, {})
        if b.get("name") != t.get("name") or b.get("type") != t.get("type"):
            modified.append({"id": oid, "base": b, "target": t})

    qty_diff = float(target.get("quantity_total", 0.0)) - float(base.get("quantity_total", 0.0))
    cost_diff = float(target.get("cost_total", 0.0)) - float(base.get("cost_total", 0.0))
    return {
        "base_version_id": payload.base_version_id,
        "target_version_id": payload.target_version_id,
        "added_objects": [target_map[i] for i in added_ids],
        "deleted_objects": [base_map[i] for i in deleted_ids],
        "modified_objects": modified,
        "quantity_difference": round(qty_diff, 4),
        "cost_difference": round(cost_diff, 2),
    }


@router.post("/{project_id}/structural-check")
@router.post("/{project_id}/module-20/structural-check")
async def structural_check(project_id: str, payload: StructuralPayload, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Structural grid from hierarchy (storey count)
    hierarchy_map: dict[str, dict[str, Any]] = {}
    _walk_hierarchy_ids(project.hierarchy or {}, hierarchy_map)
    storey_count = sum(1 for n in hierarchy_map.values() if "storey" in (n.get("type", "").lower()))
    grid = {
        "x_grids": max(3, min(20, storey_count + 3)),
        "y_grids": max(3, min(20, storey_count + 4)),
    }

    checks = []
    for task in payload.tasks:
        demand = float(task.demand)
        capacity = float(task.capacity)
        ratio = demand / capacity if capacity > 0 else 999.0
        status = "ok" if ratio <= 1.0 else "warning"
        warning = None
        if task.type == "deflection_warning" and task.limit is not None:
            status = "ok" if demand <= float(task.limit) else "warning"
            warning = None if status == "ok" else f"Deflection {demand:.4f} exceeds limit {float(task.limit):.4f}"
        elif status == "warning":
            warning = f"Demand/capacity ratio {ratio:.3f} > 1.0"
        checks.append(
            {
                "id": task.id,
                "type": task.type,
                "demand": demand,
                "capacity": capacity,
                "ratio": round(ratio, 4),
                "status": status,
                "warning": warning,
            }
        )

    combo_dead_live = payload.load_factor_dead + payload.load_factor_live
    out = {
        "project_id": project_id,
        "grid": grid,
        "load_combinations": [
            {"name": "ULS_DL_LL", "factor_sum": round(combo_dead_live, 3)},
            {"name": "SLS", "factor_sum": 1.0},
        ],
        "checks": checks,
    }
    upload_file(f"viewable/{project_id}/structural.json", json.dumps(out, ensure_ascii=True).encode("utf-8"))
    return out

