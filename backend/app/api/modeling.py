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


def _hydrate_parametric_columns(payload_data: dict) -> None:
    geometry = payload_data.get("geometry") or {}
    parameters = payload_data.get("parameters") or {}
    payload_data["start"] = geometry.get("start") or parameters.get("start")
    payload_data["end"] = geometry.get("end") or parameters.get("end")
    payload_data["height"] = parameters.get("height", payload_data.get("height"))
    payload_data["thickness"] = parameters.get("thickness", payload_data.get("thickness"))


async def _sync_hosted_openings(project_id: str, host_wall: ModelElement, db: AsyncSession) -> None:
    query = select(ModelElement).where(
        ModelElement.project_id == project_id,
        ModelElement.type.in_(["DOOR", "WINDOW", "OPENING"]),
    )
    result = await db.execute(query)
    hosted = result.scalars().all()
    for opening in hosted:
        params = opening.parameters or {}
        if params.get("host_wall_id") != host_wall.id:
            continue
        synced = geometry_kernel_service.update_opening_from_wall(
            wall_geometry=host_wall.geometry,
            wall_parameters=host_wall.parameters,
            opening_geometry=opening.geometry,
            opening_parameters=params,
        )
        opening.geometry = synced.geometry
        opening.parameters = synced.parameters
        opening.start = (opening.geometry or {}).get("start") or (opening.parameters or {}).get("start")
        opening.end = (opening.geometry or {}).get("end") or (opening.parameters or {}).get("end")
        opening.height = (opening.parameters or {}).get("height")
        opening.thickness = (opening.parameters or {}).get("thickness")


async def _apply_host_wall_for_opening(project_id: str, element: ModelElement, db: AsyncSession) -> None:
    if str(_enum_to_value(element.type)) not in {"Door", "Window", "Opening"}:
        return
    params = element.parameters or {}
    host_id = params.get("host_wall_id")
    if not host_id:
        return
    host_query = select(ModelElement).where(
        ModelElement.id == host_id,
        ModelElement.project_id == project_id,
        ModelElement.type == "WALL",
    )
    host_result = await db.execute(host_query)
    host_wall = host_result.scalar_one_or_none()
    if not host_wall:
        return
    synced = geometry_kernel_service.update_opening_from_wall(
        wall_geometry=host_wall.geometry,
        wall_parameters=host_wall.parameters,
        opening_geometry=element.geometry,
        opening_parameters=element.parameters,
    )
    element.geometry = synced.geometry
    element.parameters = synced.parameters
    element.start = (element.geometry or {}).get("start") or (element.parameters or {}).get("start")
    element.end = (element.geometry or {}).get("end") or (element.parameters or {}).get("end")
    element.height = (element.parameters or {}).get("height")
    element.thickness = (element.parameters or {}).get("thickness")


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
    _hydrate_parametric_columns(payload_data)

    element = ModelElement(project_id=project_id, **payload_data)
    db.add(element)
    await db.flush()
    await _apply_host_wall_for_opening(project_id, element, db)
    if str(_enum_to_value(payload_data["type"])) == "Wall":
        await _sync_hosted_openings(project_id, element, db)
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
        _hydrate_parametric_columns(update_data)

    for field, value in update_data.items():
        setattr(element, field, value)

    await _apply_host_wall_for_opening(project_id, element, db)
    if str(_enum_to_value(element.type)) == "Wall":
        await _sync_hosted_openings(project_id, element, db)

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
