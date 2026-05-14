from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Level, ModelElement, Project
from ..services.area_scheme_service import area_scheme_service
from ..services.room_detection_engine import room_detection_engine

router = APIRouter(prefix="/api/projects/{project_id}", tags=["cb-05"])


class RoomRecalculationRequest(BaseModel):
    elements: list[dict[str, Any]] | None = None
    area_scheme: str = "usable_area"
    persist: bool = False
    include_model_elements: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


async def _ensure_project(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _project_levels(project_id: str, db: AsyncSession) -> list[Level]:
    result = await db.execute(
        select(Level).where(Level.project_id == project_id).order_by(Level.order)
    )
    return list(result.scalars().all())


async def _project_model_elements(project_id: str, db: AsyncSession) -> list[ModelElement]:
    result = await db.execute(select(ModelElement).where(ModelElement.project_id == project_id))
    return list(result.scalars().all())


@router.get("/area-schemes")
async def list_area_schemes(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    return {
        "schema_version": "CB-05",
        "area_schemes": area_scheme_service.list_schemes(),
    }


@router.get("/rooms/detect")
async def detect_rooms(
    project_id: str,
    area_scheme: str = Query("usable_area"),
    include_model_elements: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    project = await _ensure_project(project_id, db)
    levels = await _project_levels(project_id, db)
    model_elements = await _project_model_elements(project_id, db) if include_model_elements else []
    elements = room_detection_engine.drawing_elements(project.drawing)
    return room_detection_engine.detect_rooms(
        project_id=project_id,
        drawing_elements=elements,
        model_elements=model_elements,
        levels=levels,
        area_scheme=area_scheme,
    )


@router.post("/rooms/recalculate")
async def recalculate_rooms(
    project_id: str,
    payload: RoomRecalculationRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await _ensure_project(project_id, db)
    levels = await _project_levels(project_id, db)
    model_elements = (
        await _project_model_elements(project_id, db)
        if payload.include_model_elements
        else []
    )
    source_elements = (
        payload.elements
        if payload.elements is not None
        else room_detection_engine.drawing_elements(project.drawing)
    )
    result = room_detection_engine.detect_rooms(
        project_id=project_id,
        drawing_elements=source_elements,
        model_elements=model_elements,
        levels=levels,
        area_scheme=payload.area_scheme,
    )

    if payload.persist:
        project.drawing = room_detection_engine.merge_generated_rooms(
            source_elements,
            result["rooms"],
        )
        await db.commit()
        result["persisted"] = True
        result["saved_element_count"] = len(project.drawing or [])

    return result


@router.get("/rooms/validation")
async def validate_rooms(
    project_id: str,
    area_scheme: str = Query("usable_area"),
    db: AsyncSession = Depends(get_db),
):
    project = await _ensure_project(project_id, db)
    levels = await _project_levels(project_id, db)
    elements = room_detection_engine.drawing_elements(project.drawing)
    result = room_detection_engine.detect_rooms(
        project_id=project_id,
        drawing_elements=elements,
        model_elements=[],
        levels=levels,
        area_scheme=area_scheme,
    )
    return {
        "schema_version": "CB-05",
        "project_id": project_id,
        "issue_count": len(result["issues"]),
        "issues": result["issues"],
        "summary": result["summary"],
    }

