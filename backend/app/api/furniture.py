from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import FurnitureItem, Level, Project
import uuid
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/projects", tags=["furniture"])


class FurnitureItemCreate(BaseModel):
    asset_type: str  # "Chair", "Sofa", "Table", "TV", etc.
    family: str  # e.g., "Office Chair", "3-Seat Sofa"
    x: float
    y: float
    z: float = 0.0
    width: float | None = None
    depth: float | None = None
    height: float | None = None
    level_id: str | None = None
    material_id: str | None = None
    metadata: dict | None = None


class FurnitureItemUpdate(BaseModel):
    asset_type: str | None = None
    family: str | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None
    width: float | None = None
    depth: float | None = None
    height: float | None = None
    level_id: str | None = None
    material_id: str | None = None
    metadata: dict | None = None


class FurnitureItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    project_id: str
    level_id: str | None
    asset_type: str
    family: str
    x: float
    y: float
    z: float
    width: float | None
    depth: float | None
    height: float | None
    material_id: str | None
    metadata: dict | None = Field(default=None, alias="metadata_json")


# Default furniture library
DEFAULT_FURNITURE = [
    {
        "asset_type": "Chair",
        "family": "Office Chair",
        "width": 0.6,
        "depth": 0.6,
        "height": 0.9,
        "metadata": {"color": "#8B4513", "style": "modern"},
    },
    {
        "asset_type": "Chair",
        "family": "Dining Chair",
        "width": 0.45,
        "depth": 0.45,
        "height": 0.85,
        "metadata": {"color": "#D2B48C", "style": "dining"},
    },
    {
        "asset_type": "Sofa",
        "family": "3-Seat Sofa",
        "width": 2.4,
        "depth": 0.9,
        "height": 0.8,
        "metadata": {"color": "#4A4A4A", "style": "modern"},
    },
    {
        "asset_type": "Sofa",
        "family": "L-Shaped Sofa",
        "width": 2.0,
        "depth": 1.5,
        "height": 0.8,
        "metadata": {"color": "#696969", "style": "modern"},
    },
    {
        "asset_type": "Table",
        "family": "Coffee Table",
        "width": 1.0,
        "depth": 0.6,
        "height": 0.45,
        "metadata": {"color": "#8B4513", "style": "modern"},
    },
    {
        "asset_type": "Table",
        "family": "Dining Table",
        "width": 1.5,
        "depth": 0.8,
        "height": 0.75,
        "metadata": {"color": "#654321", "style": "dining"},
    },
    {
        "asset_type": "TV",
        "family": "Wall-mounted TV",
        "width": 1.0,
        "depth": 0.1,
        "height": 0.6,
        "metadata": {"color": "#000000", "style": "modern"},
    },
    {
        "asset_type": "Bed",
        "family": "Double Bed",
        "width": 1.5,
        "depth": 2.0,
        "height": 0.5,
        "metadata": {"color": "#FFFFFF", "style": "bedroom"},
    },
    {
        "asset_type": "Cabinet",
        "family": "Wardrobe",
        "width": 1.0,
        "depth": 0.6,
        "height": 2.0,
        "metadata": {"color": "#8B4513", "style": "storage"},
    },
    {
        "asset_type": "Sink",
        "family": "Kitchen Sink",
        "width": 0.8,
        "depth": 0.6,
        "height": 0.85,
        "metadata": {"color": "#C0C0C0", "style": "kitchen"},
    },
]


@router.get("/{project_id}/furniture", response_model=List[FurnitureItemResponse])
async def get_furniture_items(
    project_id: str, level_id: str | None = None, db: AsyncSession = Depends(get_db)
):
    """Get all furniture items for a project, optionally filtered by level."""
    query = select(FurnitureItem).where(FurnitureItem.project_id == project_id)
    if level_id:
        query = query.where(FurnitureItem.level_id == level_id)
    result = await db.execute(query)
    items = result.scalars().all()
    return items


@router.get("/{project_id}/furniture/library")
async def get_furniture_library(project_id: str):
    """Get the default furniture library."""
    return {
        "library": DEFAULT_FURNITURE,
        "count": len(DEFAULT_FURNITURE),
    }


@router.post("/{project_id}/furniture", response_model=FurnitureItemResponse)
async def create_furniture_item(
    project_id: str, item: FurnitureItemCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new furniture item."""
    # Verify project exists
    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify level exists if provided
    if item.level_id:
        level_result = await db.execute(
            select(Level).where(
                Level.id == item.level_id,
                Level.project_id == project_id,
            )
        )
        level = level_result.scalar_one_or_none()
        if not level:
            raise HTTPException(status_code=404, detail="Level not found")

    new_item = FurnitureItem(
        id=str(uuid.uuid4()),
        project_id=project_id,
        level_id=item.level_id,
        asset_type=item.asset_type,
        family=item.family,
        x=item.x,
        y=item.y,
        z=item.z,
        width=item.width,
        depth=item.depth,
        height=item.height,
        material_id=item.material_id,
        metadata_json=item.metadata,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put("/{project_id}/furniture/{furniture_id}", response_model=FurnitureItemResponse)
async def update_furniture_item(
    project_id: str,
    furniture_id: str,
    item_update: FurnitureItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a furniture item."""
    result = await db.execute(
        select(FurnitureItem).where(
            FurnitureItem.id == furniture_id and FurnitureItem.project_id == project_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Furniture item not found")

    # Update fields
    if item_update.asset_type is not None:
        item.asset_type = item_update.asset_type
    if item_update.family is not None:
        item.family = item_update.family
    if item_update.x is not None:
        item.x = item_update.x
    if item_update.y is not None:
        item.y = item_update.y
    if item_update.z is not None:
        item.z = item_update.z
    if item_update.width is not None:
        item.width = item_update.width
    if item_update.depth is not None:
        item.depth = item_update.depth
    if item_update.height is not None:
        item.height = item_update.height
    if item_update.level_id is not None:
        item.level_id = item_update.level_id
    if item_update.material_id is not None:
        item.material_id = item_update.material_id
    if item_update.metadata is not None:
        item.metadata_json = item_update.metadata

    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{project_id}/furniture/{furniture_id}")
async def delete_furniture_item(
    project_id: str, furniture_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete a furniture item."""
    result = await db.execute(
        select(FurnitureItem).where(
            FurnitureItem.id == furniture_id and FurnitureItem.project_id == project_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Furniture item not found")

    await db.delete(item)
    await db.commit()
    return {"detail": "Furniture item deleted"}
