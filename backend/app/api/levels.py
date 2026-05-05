from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import Level, Project
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/projects", tags=["levels"])


class LevelCreate(BaseModel):
    name: str
    elevation_m: float = 0.0
    floor_height_m: float = 3.0
    order: float = 0.0


class LevelUpdate(BaseModel):
    name: str | None = None
    elevation_m: float | None = None
    floor_height_m: float | None = None
    order: float | None = None


class LevelResponse(BaseModel):
    id: str
    project_id: str
    name: str
    elevation_m: float
    floor_height_m: float
    order: float

    class Config:
        from_attributes = True


@router.get("/{project_id}/levels", response_model=List[LevelResponse])
async def get_levels(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get all levels for a project."""
    result = await db.execute(
        select(Level).where(Level.project_id == project_id).order_by(Level.order)
    )
    levels = result.scalars().all()
    return levels


@router.post("/{project_id}/levels", response_model=LevelResponse)
async def create_level(
    project_id: str, level: LevelCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new level."""
    # Verify project exists
    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_level = Level(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=level.name,
        elevation_m=level.elevation_m,
        floor_height_m=level.floor_height_m,
        order=level.order,
    )
    db.add(new_level)
    await db.commit()
    await db.refresh(new_level)
    return new_level


@router.put("/{project_id}/levels/{level_id}", response_model=LevelResponse)
async def update_level(
    project_id: str,
    level_id: str,
    level_update: LevelUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a level."""
    result = await db.execute(
        select(Level).where(Level.id == level_id and Level.project_id == project_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    if level_update.name is not None:
        level.name = level_update.name
    if level_update.elevation_m is not None:
        level.elevation_m = level_update.elevation_m
    if level_update.floor_height_m is not None:
        level.floor_height_m = level_update.floor_height_m
    if level_update.order is not None:
        level.order = level_update.order

    db.add(level)
    await db.commit()
    await db.refresh(level)
    return level


@router.delete("/{project_id}/levels/{level_id}")
async def delete_level(
    project_id: str, level_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete a level."""
    result = await db.execute(
        select(Level).where(Level.id == level_id and Level.project_id == project_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    await db.delete(level)
    await db.commit()
    return {"detail": "Level deleted"}


@router.post("/{project_id}/levels/init")
async def init_default_levels(project_id: str, db: AsyncSession = Depends(get_db)):
    """Initialize default levels for a project (Ground Floor only)."""
    # Check if levels already exist
    result = await db.execute(
        select(Level).where(Level.project_id == project_id)
    )
    existing_levels = result.scalars().all()
    if existing_levels:
        return {"detail": "Levels already initialized"}

    # Create default level
    default_level = Level(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name="Ground Floor",
        elevation_m=0.0,
        floor_height_m=3.0,
        order=0.0,
    )
    db.add(default_level)
    await db.commit()
    await db.refresh(default_level)
    return LevelResponse.from_orm(default_level)
