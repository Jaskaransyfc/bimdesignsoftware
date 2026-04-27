from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Project, ProjectStatus, BOQItem
from ..schemas import ProjectCreate, ProjectOut, BOQSummaryItem, ProjectUpdate
from ..tasks import process_ifc
from ..storage import upload_file, ensure_storage, get_file_url
from uuid import uuid4
import os, json

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("/", response_model=ProjectOut)
async def create_project(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    client_name: str = Form(None),
    location: str = Form(None),
    team_members: str = Form(None),   # JSON string from frontend
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.ifc'):
        raise HTTPException(status_code=400, detail="Only .ifc files allowed")

    # Parse team_members JSON string
    team = None
    if team_members:
        try:
            team = json.loads(team_members)
        except json.JSONDecodeError:
            team = None

    project_id = str(uuid4())
    file_path = f"raw/{project_id}/{file.filename}"

    # Upload to Storage
    ensure_storage()
    contents = await file.read()
    upload_file(file_path, contents)

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

    # In local mode, we use FastAPI BackgroundTasks instead of Celery 
    # if the user doesn't have Redis installed.
    # We call the function directly (it's a sync function, so BackgroundTasks handles it in a thread).
    background_tasks.add_task(process_ifc, str(project_id))

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

@router.get("/{project_id}/xkt-url")
async def get_xkt_url(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not project.xkt_file:
        raise HTTPException(status_code=404)
    
    url = get_file_url(project.xkt_file)
    return {"url": url}

@router.get("/{project_id}/boq-summary", response_model=list[BOQSummaryItem])
async def boq_summary(project_id: str, db: AsyncSession = Depends(get_db)):
    """Return grouped Bill of Quantities summary for a project."""
    query = select(BOQItem).where(BOQItem.project_id == project_id)
    result = await db.execute(query)
    items = result.scalars().all()

    # Group by ifc_type + quantity_name + unit, sum values
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
