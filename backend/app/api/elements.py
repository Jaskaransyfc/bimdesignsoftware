from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Element
from ..schemas import ElementOut

router = APIRouter(prefix="/api/elements", tags=["elements"])

# ----- Existing single-element endpoint -----
@router.get("/{project_id}/{global_id}", response_model=ElementOut)
async def get_element(project_id: str, global_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Element).where(
        Element.project_id == project_id,
        Element.global_id == global_id
    )
    result = await db.execute(query)
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element

# ----- New: list all elements for a project (for the type tree) -----
@router.get("/{project_id}", response_model=list[ElementOut])
async def list_elements(project_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Element).where(Element.project_id == project_id)
    result = await db.execute(query)
    elements = result.scalars().all()
    return elements