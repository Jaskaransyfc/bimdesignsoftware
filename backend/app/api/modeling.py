from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..geometry_kernel import geometry_kernel_service
from ..models import Material, ModelElement, Project
from ..schemas import (
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
    ModelElementCreate,
    ModelElementOut,
    ModelElementUpdate,
)

router = APIRouter(prefix="/api/modeling/projects/{project_id}", tags=["modeling"])


def _enum_to_value(value):
    return value.value if hasattr(value, "value") else value


async def _ensure_project_exists(project_id: str, db: AsyncSession) -> None:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/materials", response_model=MaterialOut)
async def create_material(
    project_id: str,
    payload: MaterialCreate,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project_exists(project_id, db)
    material = Material(project_id=project_id, **payload.model_dump())
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material


@router.get("/materials", response_model=list[MaterialOut])
async def list_materials(project_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Material).where(Material.project_id == project_id).order_by(Material.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/materials/{material_id}", response_model=MaterialOut)
async def update_material(
    project_id: str,
    material_id: str,
    payload: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(Material).where(
        Material.id == material_id,
        Material.project_id == project_id,
    )
    result = await db.execute(query)
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(material, field, value)

    await db.commit()
    await db.refresh(material)
    return material


@router.delete("/materials/{material_id}")
async def delete_material(project_id: str, material_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Material).where(
        Material.id == material_id,
        Material.project_id == project_id,
    )
    result = await db.execute(query)
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    await db.delete(material)
    await db.commit()
    return {"deleted": True}


@router.post("/elements", response_model=ModelElementOut)
async def create_model_element(
    project_id: str,
    payload: ModelElementCreate,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project_exists(project_id, db)
    if payload.material_id:
        material = await db.get(Material, payload.material_id)
        if not material or material.project_id != project_id:
            raise HTTPException(status_code=400, detail="Invalid material_id")

    payload_data = payload.model_dump()
    kernel_result = geometry_kernel_service.build_element_geometry(
        element_type=str(_enum_to_value(payload_data["type"])),
        element_name=payload_data.get("name"),
        geometry=payload_data.get("geometry"),
        parameters=payload_data.get("parameters"),
    )
    payload_data["geometry"] = kernel_result.geometry
    payload_data["parameters"] = kernel_result.parameters

    element = ModelElement(project_id=project_id, **payload_data)
    db.add(element)
    await db.commit()
    await db.refresh(element)
    return element


@router.get("/elements", response_model=list[ModelElementOut])
async def list_model_elements(project_id: str, db: AsyncSession = Depends(get_db)):
    query = select(ModelElement).where(ModelElement.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/elements/{element_id}", response_model=ModelElementOut)
async def update_model_element(
    project_id: str,
    element_id: str,
    payload: ModelElementUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(ModelElement).where(
        ModelElement.id == element_id,
        ModelElement.project_id == project_id,
    )
    result = await db.execute(query)
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Model element not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "material_id" in update_data and update_data["material_id"]:
        material = await db.get(Material, update_data["material_id"])
        if not material or material.project_id != project_id:
            raise HTTPException(status_code=400, detail="Invalid material_id")

    if "type" in update_data or "name" in update_data or "geometry" in update_data or "parameters" in update_data:
        base_type = str(_enum_to_value(update_data.get("type", element.type)))
        base_name = update_data.get("name", element.name)
        base_geometry = update_data.get("geometry", element.geometry)
        base_parameters = update_data.get("parameters", element.parameters)
        kernel_result = geometry_kernel_service.build_element_geometry(
            element_type=base_type,
            element_name=base_name,
            geometry=base_geometry,
            parameters=base_parameters,
        )
        update_data["geometry"] = kernel_result.geometry
        update_data["parameters"] = kernel_result.parameters

    for field, value in update_data.items():
        setattr(element, field, value)

    await db.commit()
    await db.refresh(element)
    return element


@router.delete("/elements/{element_id}")
async def delete_model_element(
    project_id: str,
    element_id: str,
    db: AsyncSession = Depends(get_db),
):
    query = select(ModelElement).where(
        ModelElement.id == element_id,
        ModelElement.project_id == project_id,
    )
    result = await db.execute(query)
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Model element not found")
    await db.delete(element)
    await db.commit()
    return {"deleted": True}


@router.get("/kernel-status")
async def get_kernel_status(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project_exists(project_id, db)
    return {"kernel": geometry_kernel_service.kernel_name}
