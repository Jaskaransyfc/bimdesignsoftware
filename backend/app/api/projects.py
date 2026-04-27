from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Project, ProjectStatus
from ..schemas import ProjectCreate, ProjectOut
from ..tasks import process_ifc
from ..storage import upload_file, ensure_storage, get_file_url
from uuid import uuid4
import os

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("/", response_model=ProjectOut)
async def create_project(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.ifc'):
        raise HTTPException(status_code=400, detail="Only .ifc files allowed")

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
        original_file=file_path
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

@router.get("/{project_id}/xkt-url")
async def get_xkt_url(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or not project.xkt_file:
        raise HTTPException(status_code=404)
    
    url = get_file_url(project.xkt_file)
    return {"url": url}
