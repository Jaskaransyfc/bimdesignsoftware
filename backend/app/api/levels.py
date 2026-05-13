from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import List
from ..database import get_db
from ..models import Level, Project, ModelElement, FurnitureItem
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/projects", tags=["levels"])


class LevelCreate(BaseModel):
    name: str
    elevation_m: float = 0.0
    order: int = 0


class LevelUpdate(BaseModel):
    name: str | None = None
    elevation_m: float | None = None
    order: int | None = None


class LevelResponse(BaseModel):
    id: str
    projectId: str
    name: str
    elevation_m: float
    elevation_mm: int
    order: int

    class Config:
        from_attributes = True


def to_level_response(level: Level) -> LevelResponse:
    return LevelResponse(
        id=level.id,
        projectId=level.project_id,
        name=level.name,
        elevation_m=level.elevation_m,
        elevation_mm=round(level.elevation_m * 1000),
        order=int(level.order),
    )


@router.get("/{project_id}/levels", response_model=List[LevelResponse])
async def get_levels(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get all levels for a project."""
    result = await db.execute(
        select(Level).where(Level.project_id == project_id).order_by(Level.order)
    )
    levels = result.scalars().all()
    return [to_level_response(level) for level in levels]


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
        order=level.order,
    )
    db.add(new_level)
    await db.commit()
    await db.refresh(new_level)
    return to_level_response(new_level)


@router.put("/{project_id}/levels/{level_id}", response_model=LevelResponse)
async def update_level(
    project_id: str,
    level_id: str,
    level_update: LevelUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a level."""
    result = await db.execute(
        select(Level).where(Level.id == level_id, Level.project_id == project_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    if level_update.name is not None:
        level.name = level_update.name
    if level_update.elevation_m is not None:
        level.elevation_m = level_update.elevation_m
    if level_update.order is not None:
        level.order = level_update.order

    db.add(level)
    await db.commit()
    await db.refresh(level)
    return to_level_response(level)


@router.delete("/{project_id}/levels/{level_id}")
async def delete_level(
    project_id: str, level_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete a level and reassign linked entities to the level below (fallback first level)."""
    result = await db.execute(
        select(Level).where(Level.id == level_id, Level.project_id == project_id)
    )
    level = result.scalar_one_or_none()
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    all_levels_result = await db.execute(
        select(Level).where(Level.project_id == project_id).order_by(Level.order)
    )
    all_levels = all_levels_result.scalars().all()
    if len(all_levels) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last level")

    sorted_levels = sorted(all_levels, key=lambda lvl: float(lvl.order))
    level_index = next(
        (idx for idx, lvl in enumerate(sorted_levels) if lvl.id == level_id),
        None,
    )
    if level_index is None:
        raise HTTPException(status_code=404, detail="Level not found")

    fallback_index = max(0, level_index - 1)
    fallback_level = (
        sorted_levels[fallback_index]
        if sorted_levels[fallback_index].id != level_id
        else sorted_levels[0]
    )

    await db.execute(
        update(ModelElement)
        .where(ModelElement.project_id == project_id, ModelElement.level_id == level_id)
        .values(level_id=fallback_level.id)
    )
    await db.execute(
        update(FurnitureItem)
        .where(FurnitureItem.project_id == project_id, FurnitureItem.level_id == level_id)
        .values(level_id=fallback_level.id)
    )

    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if project and isinstance(project.drawing, dict):
        drawing = project.drawing
        drawing_elements = drawing.get("elements", [])
        for element in drawing_elements:
            if isinstance(element, dict) and element.get("levelId") == level_id:
                element["levelId"] = fallback_level.id
        project.drawing = drawing
        db.add(project)

    await db.delete(level)
    await db.commit()
    return {"deleted": True}


@router.post("/{project_id}/levels/init")
async def init_default_levels(project_id: str, db: AsyncSession = Depends(get_db)):
    """Initialize default levels for a project."""
    # Check if levels already exist
    result = await db.execute(
        select(Level).where(Level.project_id == project_id)
    )
    existing_levels = result.scalars().all()
    if existing_levels:
        return [to_level_response(level) for level in existing_levels]

    default_levels = [
        Level(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name="Ground Floor",
            elevation_m=0.0,
            order=0,
        ),
        Level(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name="Level 1",
            elevation_m=3.66,
            order=1,
        ),
        Level(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name="Level 2",
            elevation_m=7.32,
            order=2,
        ),
    ]
    for level in default_levels:
        db.add(level)
    await db.commit()
    for level in default_levels:
        await db.refresh(level)
    return [to_level_response(level) for level in default_levels]
