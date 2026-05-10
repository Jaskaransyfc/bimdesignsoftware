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
        "asset_type": "water_tank",
        "family": "Water Tank",
        "width": 1.45,
        "depth": 1.45,
        "height": 1.45,
        "metadata": {
            "panel_columns": 4,
            "panel_rows": 3,
            "tank_depth": 1.45,
        },
    },
    {
        "asset_type": "SOFA_3_SEATER_V1",
        "family": "3 Seater Sofa",
        "width": 4.2,
        "depth": 1.15,
        "height": 0.82,
        "metadata": {
            "sofa_width": 4.2,
            "sofa_depth": 1.15,
            "seat_height": 0.42,
            "back_height": 0.82,
            "arm_width": 0.24,
            "gap": 0.05
        },
    },
    {
        "asset_type": "CENTER_TABLE_V1",
        "family": "Center Table",
        "width": 1.8,
        "depth": 0.9,
        "height": 0.42,
        "metadata": {
            "table_width": 1.8,
            "table_depth": 0.9,
            "table_height": 0.42,
            "top_thickness": 0.05,
            "leg_width": 0.08
        },
    },
    {
        "asset_type": "DOUBLE_BED_V1",
        "family": "Double Bed",
        "width": 3.2,
        "depth": 2.3,
        "height": 1.2,
        "metadata": {
            "bed_width": 3.2,
            "bed_depth": 2.3,
            "base_height": 0.28,
            "mattress_height": 0.24,
            "headboard_height": 1.2
        },
    },
    {
        "asset_type": "WALL_PAINTING_V1",
        "family": "Modern Wall Painting",
        "width": 2.0,
        "depth": 0.05,
        "height": 1.2,
        "metadata": {
            "painting_width": 2.0,
            "painting_height": 1.2,
            "painting_depth": 0.05,
            "frame_thickness": 0.08
        },
    },
    {
        "asset_type": "SOFA_1_SEATER_V1",
        "family": "1 Seater Sofa",
        "width": 1.3,
        "depth": 1.05,
        "height": 0.85,
        "metadata": {
            "sofa_width": 1.3,
            "sofa_depth": 1.05,
            "seat_height": 0.42,
            "back_height": 0.85,
            "arm_width": 0.28
        },
    },
    {
        "asset_type": "SINGLE_BED_V1",
        "family": "Modern Single Bed",
        "width": 1.2,
        "depth": 2.1,
        "height": 1.05,
        "metadata": {
            "bed_width": 1.2,
            "bed_depth": 2.1,
            "base_height": 0.32,
            "mattress_height": 0.22,
            "headboard_height": 1.05
        },
    },
    {
        "asset_type": "DINING_TABLE_V1",
        "family": "Dining Table (6 Chairs)",
        "width": 2.4,
        "depth": 1.2,
        "height": 0.78,
        "metadata": {
            "table_width": 2.4,
            "table_depth": 1.2,
            "table_height": 0.78,
            "top_thickness": 0.08,
            "chair_count": 6
        },
    },
    {
        "asset_type": "TV_PANEL_V1",
        "family": "Luxury TV Panel",
        "width": 3.6,
        "depth": 0.40,
        "height": 2.4,
        "metadata": {
            "panel_width": 3.6,
            "panel_height": 2.4,
            "panel_depth": 0.05,
            "tv_width": 1.45,
            "tv_height": 0.85,
            "tv_depth": 0.04,
            "console_height": 0.35,
            "console_depth": 0.40
        },
    },
    {
        "asset_type": "CEILING_FAN_V1",
        "family": "Modern Realistic Ceiling Fan",
        "width": 1.2,
        "depth": 1.2,
        "height": 0.35,
        "metadata": {
            "blade_span": 1.2,
            "blade_width": 0.15,
            "drop_height": 0.35,
            "motor_radius": 0.12
        },
    },
    {
        "asset_type": "MODULAR_KITCHEN_L_V1",
        "family": "Luxury Modular Kitchen (L Shape)",
        "width": 3.2,
        "depth": 2.4,
        "height": 1.5,
        "metadata": {
            "kitchen_x_len": 3.2,
            "kitchen_y_len": 2.4,
            "counter_depth": 0.6,
            "counter_height": 0.9,
            "cabinet_height": 0.72,
            "overhead_height": 0.6,
            "overhead_depth": 0.35,
            "overhead_gap": 0.6
        },
    },
    {
        "asset_type": "KITCHEN_SINGLE_WALL_V1",
        "family": "Single Wall Non Modular Kitchen",
        "width": 3.6,
        "depth": 0.6,
        "height": 1.5,
        "metadata": {
            "kitchen_len": 3.6,
            "counter_depth": 0.6,
            "counter_height": 0.9,
            "cabinet_height": 0.72,
            "overhead_height": 0.6,
            "overhead_depth": 0.35,
            "overhead_gap": 0.6
        },
    },
    {
        "asset_type": "COVE_CEILING_V1",
        "family": "Modern Cove Light False Ceiling",
        "width": 4.0,
        "depth": 5.0,
        "height": 0.15,
        "metadata": {
            "room_width": 4.0,
            "room_depth": 5.0,
            "cove_width": 0.6,
            "drop_depth": 0.15,
            "light_gap": 0.05
        },
    },
    {
        "asset_type": "GEOMETRIC_CEILING_V1",
        "family": "Luxury Geometric False Ceiling",
        "width": 4.5,
        "depth": 5.5,
        "height": 0.2,
        "metadata": {
            "room_width": 4.5,
            "room_depth": 5.5,
            "panel_size": 1.0,
            "gap": 0.15,
            "drop_depth": 0.2
        },
    },
    {
        "asset_type": "CARPET_V1",
        "family": "Luxury Modern Carpet",
        "width": 3.0,
        "depth": 2.0,
        "height": 0.02,
        "metadata": {
            "carpet_width": 3.0,
            "carpet_depth": 2.0,
            "carpet_thickness": 0.02,
            "fringe_length": 0.1
        },
    },
    {
        "asset_type": "INDIAN_COVE_CEILING_V1",
        "family": "Luxury Indian Cove False Ceiling",
        "width": 4.0,
        "depth": 5.0,
        "height": 0.2,
        "metadata": {
            "room_width": 4.0,
            "room_depth": 5.0,
            "cove_width": 0.5,
            "drop_depth": 0.2,
            "corner_size": 0.8
        },
    },
    {
        "asset_type": "FLOATING_COVE_CEILING_V1",
        "family": "Ultra Luxury Floating Cove Ceiling",
        "width": 4.2,
        "depth": 5.2,
        "height": 0.25,
        "metadata": {
            "room_width": 4.2,
            "room_depth": 5.2,
            "panel_width": 3.2,
            "panel_depth": 4.2,
            "drop_depth": 0.25,
            "light_gap": 0.08
        },
    },
    {
        "asset_type": "WOODEN_PANEL_CEILING_V1",
        "family": "Perfectly Aligned False Ceiling with Wooden Panels",
        "width": 3.6,
        "depth": 4.2,
        "height": 0.15,
        "metadata": {
            "room_width": 3.6,
            "room_depth": 4.2,
            "drop_depth": 0.15,
            "panel_width": 0.6,
            "panel_gap": 0.1
        },
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
