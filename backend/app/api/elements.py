from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Element
from ..schemas import ElementOut

router = APIRouter(prefix="/api/elements", tags=["elements"])

@router.get("/{project_id}/{global_id}", response_model=ElementOut)
async def get_element(project_id: str, global_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Element).filter(Element.project_id == project_id, Element.global_id == global_id)
    )
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element
