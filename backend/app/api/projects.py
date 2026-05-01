# backend/app/api/projects.py
from typing import Any

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Project, ProjectStatus, BOQItem
from ..schemas import ProjectCreate, ProjectOut, BOQSummaryItem, ProjectUpdate, ProjectBlankCreate
from ..tasks import process_upload          # <-- new worker
from ..plan_generator import (
    generate_plan_view_svg,
    generate_section_view_svg,
    generate_elevation_view_svg,
    generate_dxf_from_svg_data,
    generate_and_store_views_for_project,
)
from starlette.responses import StreamingResponse
from ..storage import upload_file, ensure_storage, get_file_url, get_file_content
from uuid import uuid4
import json
import io

router = APIRouter(prefix="/api/projects", tags=["projects"])

ALLOWED_EXTENSIONS = {"ifc", "rvt", "glb", "gltf", "obj", "fbx", "dae", "stp", "step", "xyz", "e57", "blend"}


def _is_unavailable_plan_svg(svg_content: bytes) -> bool:
    try:
        text = svg_content.decode("utf-8", errors="ignore")
    except Exception:
        return False
    return "Plan view unavailable" in text


@router.post("/", response_model=ProjectOut)
async def create_project(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    file: UploadFile = File(...),
    client_name: str = Form(None),
    location: str = Form(None),
    team_members: str = Form(None),   # JSON string
    db: AsyncSession = Depends(get_db)
):
    # ---- file extension validation ----
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: .{ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # ---- parse team members ----
    team = None
    if team_members:
        try:
            team = json.loads(team_members)
        except json.JSONDecodeError:
            team = None

    project_id = str(uuid4())
    file_path = f"raw/{project_id}/{file.filename}"

    # ---- upload raw file ----
    ensure_storage()
    contents = await file.read()
    upload_file(file_path, contents)

    # ---- create database record ----
    project = Project(
        id=project_id,
        name=name,
        status=ProjectStatus.UPLOADED,
        original_file=file_path,
        client_name=client_name,
        location=location,
        team_members=team
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # ---- trigger background processing (IFC or other format) ----
    background_tasks.add_task(process_upload, str(project_id), ext)

    return project


@router.post("/blank", response_model=ProjectOut)
async def create_blank_project(
    payload: ProjectBlankCreate,
    db: AsyncSession = Depends(get_db),
):
    project_id = str(uuid4())
    project = Project(
        id=project_id,
        name=payload.name,
        status=ProjectStatus.READY,
        original_file=f"blank://{project_id}",
        hierarchy={"id": "root", "name": payload.name, "type": "Project", "children": []},
        client_name=payload.client_name,
        location=payload.location,
        team_members=payload.team_members,
        viewer_file=None,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404)
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404)

    if payload.name is not None:
        project.name = payload.name
    if payload.client_name is not None:
        project.client_name = payload.client_name
    if payload.location is not None:
        project.location = payload.location
    if payload.team_members is not None:
        project.team_members = payload.team_members

    await db.commit()
    await db.refresh(project)
    return project


# ── viewer-file URL (works for XKT and GLB) ─────────────────
@router.get("/{project_id}/viewer-url")
async def get_viewer_url(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return the URL of the file the viewer should load (XKT or GLB)."""
    project = await db.get(Project, project_id)
    if not project or not project.viewer_file:
        raise HTTPException(status_code=404, detail="Viewer file not ready")
    url = get_file_url(project.viewer_file)
    return {"url": url}


# ── hierarchy (from JSON field) ─────────────────────────────
@router.get("/{project_id}/hierarchy")
async def get_hierarchy(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404)
    return project.hierarchy


# ── BOQ summary ─────────────────────────────────────────────
@router.get("/{project_id}/boq-summary", response_model=list[BOQSummaryItem])
async def boq_summary(project_id: str, db: AsyncSession = Depends(get_db)):
    query = select(BOQItem).where(BOQItem.project_id == project_id)
    result = await db.execute(query)
    items = result.scalars().all()

    grouped: dict = {}
    for item in items:
        key = f"{item.ifc_type}|{item.quantity_name}|{item.unit}"
        if key not in grouped:
            grouped[key] = {
                "type": item.ifc_type,
                "quantity": item.quantity_name,
                "unit": item.unit,
                "total": 0.0
            }
        grouped[key]["total"] += item.quantity_value

    return list(grouped.values())


# ── original file URL ───────────────────────────────────────────
@router.get("/{project_id}/original-url")
async def get_original_url(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return the URL of the original file (e.g. the .ifc file)."""
    project = await db.get(Project, project_id)
    if not project or not project.original_file:
        raise HTTPException(status_code=404, detail="Original file not found")
    url = get_file_url(project.original_file)
    return {"url": url}


# ── 2D View Generation ──────────────────────────────────────────
@router.get("/{project_id}/plan-view.svg")
async def get_plan_view(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not project.original_file:
        raise HTTPException(status_code=404, detail="Original file not found")

    svg_object = f"viewable/{project_id}/plan.svg"
    try:
        svg_content = get_file_content(svg_object)
        if _is_unavailable_plan_svg(svg_content):
            generate_and_store_views_for_project(project_id, preferred_object=project.viewer_file)
            svg_content = get_file_content(svg_object)
    except Exception:
        generate_and_store_views_for_project(project_id, preferred_object=project.viewer_file)
        try:
            svg_content = get_file_content(svg_object)
        except Exception:
            svg_content = generate_plan_view_svg(b"", project_id)
    return StreamingResponse(
        io.BytesIO(svg_content),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.get("/{project_id}/section-view.svg")
async def get_section_view(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    cut_plane_origin: str = "0,0,0",  # Example: "x,y,z"
    cut_plane_direction: str = "0,0,1"  # Example: "dx,dy,dz"
):
    project = await db.get(Project, project_id)
    if not project or not project.original_file:
        raise HTTPException(status_code=404, detail="Original file not found")

    # Parse origin and direction (simplified for placeholder)
    origin = tuple(map(float, cut_plane_origin.split(",")))
    direction = tuple(map(float, cut_plane_direction.split(",")))

    svg_content = generate_section_view_svg(b"", project_id, origin, direction)
    return StreamingResponse(
        io.BytesIO(svg_content),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.get("/{project_id}/elevation-view.svg")
async def get_elevation_view(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    elevation_direction: str = "1,0,0"  # Example: "dx,dy,dz"
):
    project = await db.get(Project, project_id)
    if not project or not project.original_file:
        raise HTTPException(status_code=404, detail="Original file not found")

    direction = tuple(map(float, elevation_direction.split(",")))

    svg_content = generate_elevation_view_svg(b"", project_id, direction)
    return StreamingResponse(
        io.BytesIO(svg_content),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.get("/{project_id}/plan-view.dxf")
async def get_plan_view_dxf(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not project.original_file:
        raise HTTPException(status_code=404, detail="Original file not found")

    dxf_object = f"viewable/{project_id}/plan.dxf"
    try:
        dxf_content = get_file_content(dxf_object)
    except Exception:
        generate_and_store_views_for_project(project_id, preferred_object=project.viewer_file)
        try:
            dxf_content = get_file_content(dxf_object)
        except Exception:
            svg_content = generate_plan_view_svg(b"", project_id)
            dxf_content = generate_dxf_from_svg_data(svg_content, project_id)

    return StreamingResponse(
        io.BytesIO(dxf_content),
        media_type="application/dxf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{project_id}_plan_view.dxf\"",
            "Cache-Control": "no-store, max-age=0",
        }
    )


@router.post("/{project_id}/drawing")
async def save_drawing(
    project_id: str, 
    drawing_data: dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Save 2D drawing for a project
    """
    try:
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        elements = drawing_data.get("elements", [])
        project.drawing = elements
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Drawing saved successfully",
            "elementCount": len(elements),
        }
    
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/drawing")
async def get_drawing(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieve 2D drawing for a project
    """
    try:
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        elements = project.drawing or []
        
        return {
            "projectId": project_id,
            "elements": elements,
            "message": "Drawing retrieved successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))