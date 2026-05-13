from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..geometry_kernel import geometry_kernel_service
from ..models import ElementTypeDefinition, FamilyDefinition, Material, ModelElement, Project
from ..schemas import (
    FamilyDefinitionCreate,
    FamilyDefinitionOut,
    FamilyDefinitionUpdate,
    FamilyInstantiateRequest,
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
    ModelElementCreate,
    ModelElementOut,
    ModelElementUpdate,
)
from ..services.category_registry import category_registry_service
from ..services.element_registry import element_registry_service
from ..services.family_template_service import family_template_service

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


async def _get_type_definition(
    project_id: str,
    type_definition_id: str | None,
    db: AsyncSession,
) -> ElementTypeDefinition | None:
    if not type_definition_id:
        return None
    type_definition = await db.get(ElementTypeDefinition, type_definition_id)
    if not type_definition or type_definition.project_id != project_id:
        raise HTTPException(status_code=400, detail="Invalid type_definition_id")
    return type_definition


async def _normalize_cb01_payload(
    project_id: str,
    payload_data: dict,
    db: AsyncSession,
    existing: ModelElement | None = None,
) -> dict:
    type_definition = await _get_type_definition(
        project_id,
        payload_data.get("type_definition_id") or getattr(existing, "type_definition_id", None),
        db,
    )
    return element_registry_service.normalize_payload(
        project_id=project_id,
        payload_data=payload_data,
        existing=existing,
        type_definition=type_definition,
    )


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


def _distance_2d(a, b) -> float:
    return ((float(a[0]) - float(b[0])) ** 2 + (float(a[2]) - float(b[2])) ** 2) ** 0.5


async def _enforce_constraints(project_id: str, element: ModelElement, db: AsyncSession) -> None:
    params = element.parameters or {}
    etype = str(_enum_to_value(element.type))

    # Attached-to-host + centered + inside wall for door/window/opening.
    if etype in {"Door", "Window", "Opening"} and params.get("host_wall_id"):
        host = await db.get(ModelElement, params["host_wall_id"])
        if host and host.project_id == project_id and str(_enum_to_value(host.type)) == "Wall":
            host_params = host.parameters or {}
            if params.get("centered", False):
                params["offset"] = float(host_params.get("length", 3.0)) * 0.5
            synced = geometry_kernel_service.update_opening_from_wall(
                wall_geometry=host.geometry,
                wall_parameters=host_params,
                opening_geometry=element.geometry,
                opening_parameters=params,
            )
            element.geometry = synced.geometry
            element.parameters = synced.parameters
            element.height = (element.parameters or {}).get("height")
            element.thickness = (element.parameters or {}).get("thickness")

    # Level-locked / wall remains connected to slab.
    if etype == "Wall" and params.get("attach_slab_id"):
        slab = await db.get(ModelElement, params["attach_slab_id"])
        if slab and slab.project_id == project_id and str(_enum_to_value(slab.type)) == "Slab":
            slab_pos = (slab.geometry or {}).get("position") or [0.0, 0.0, 0.0]
            slab_h = float((slab.parameters or {}).get("height", 0.3))
            params["base_elevation"] = float(slab_pos[1]) + slab_h * 0.5
            element.parameters = params
            kernel_result = geometry_kernel_service.build_element_geometry(
                element_type=etype,
                element_name=element.name,
                geometry=element.geometry,
                parameters=element.parameters,
            )
            element.geometry = kernel_result.geometry
            element.parameters = kernel_result.parameters
            element.start = (element.geometry or {}).get("start")
            element.end = (element.geometry or {}).get("end")
            element.height = (element.parameters or {}).get("height")
            element.thickness = (element.parameters or {}).get("thickness")

    # Column snaps to nearest grid.
    if etype == "Column" and params.get("snap_to_grid", True):
        grid_query = select(ModelElement).where(
            ModelElement.project_id == project_id,
            ModelElement.type == "GRID",
        )
        grid_rows = (await db.execute(grid_query)).scalars().all()
        pos = (element.geometry or {}).get("position") or [0.0, 1.5, 0.0]
        best = None
        best_d = 1e18
        for grid in grid_rows:
            gpos = (grid.geometry or {}).get("position") or [0.0, 0.0, 0.0]
            d = _distance_2d(pos, gpos)
            if d < best_d:
                best_d = d
                best = gpos
        if best and best_d <= float(params.get("grid_snap_distance", 2.0)):
            element.geometry = {**(element.geometry or {}), "position": [float(best[0]), float(pos[1]), float(best[2])]}

    # Beam connects between columns.
    if etype == "Beam" and params.get("start_column_id") and params.get("end_column_id"):
        start_col = await db.get(ModelElement, params["start_column_id"])
        end_col = await db.get(ModelElement, params["end_column_id"])
        if start_col and end_col and start_col.project_id == project_id and end_col.project_id == project_id:
            sp = (start_col.geometry or {}).get("position") or [0.0, 0.0, 0.0]
            ep = (end_col.geometry or {}).get("position") or [3.0, 0.0, 0.0]
            params["start"] = [float(sp[0]), float(sp[1]), float(sp[2])]
            params["end"] = [float(ep[0]), float(ep[1]), float(ep[2])]
            params["width"] = max(0.2, _distance_2d(sp, ep))
            element.parameters = params
            element.geometry = {**(element.geometry or {}), "position": [
                (float(sp[0]) + float(ep[0])) * 0.5,
                (float(sp[1]) + float(ep[1])) * 0.5,
                (float(sp[2]) + float(ep[2])) * 0.5,
            ]}


async def _bootstrap_default_families(project_id: str, db: AsyncSession) -> None:
    existing = await db.execute(
        select(FamilyDefinition).where(FamilyDefinition.project_id == project_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return
    for template in family_template_service.default_templates():
        normalized = family_template_service.normalize_family_payload(template)
        db.add(FamilyDefinition(project_id=project_id, **normalized))
    await db.flush()


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

    payload_data = await _normalize_cb01_payload(project_id, payload.model_dump(), db)
    kernel_result = geometry_kernel_service.build_element_geometry(
        element_type=str(_enum_to_value(payload_data["type"])),
        element_name=payload_data.get("name"),
        geometry=payload_data.get("geometry"),
        parameters=payload_data.get("parameters"),
    )
    payload_data["geometry"] = kernel_result.geometry
    payload_data["parameters"] = kernel_result.parameters
    payload_data = await _normalize_cb01_payload(project_id, payload_data, db)
    _hydrate_parametric_columns(payload_data)

    element = ModelElement(project_id=project_id, **payload_data)
    db.add(element)
    await db.flush()
    await _enforce_constraints(project_id, element, db)
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

    if update_data:
        update_data = await _normalize_cb01_payload(project_id, update_data, db, existing=element)

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
        update_data = await _normalize_cb01_payload(project_id, update_data, db, existing=element)
        _hydrate_parametric_columns(update_data)

    for field, value in update_data.items():
        setattr(element, field, value)

    await _enforce_constraints(project_id, element, db)
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


@router.get("/families", response_model=list[FamilyDefinitionOut])
async def list_families(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project_exists(project_id, db)
    await _bootstrap_default_families(project_id, db)
    await db.commit()
    query = select(FamilyDefinition).where(FamilyDefinition.project_id == project_id).order_by(FamilyDefinition.family.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/families", response_model=FamilyDefinitionOut)
async def create_family(
    project_id: str,
    payload: FamilyDefinitionCreate,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project_exists(project_id, db)
    family_data = family_template_service.normalize_family_payload(payload.model_dump())
    family = FamilyDefinition(project_id=project_id, **family_data)
    db.add(family)
    await db.commit()
    await db.refresh(family)
    return family


@router.put("/families/{family_id}", response_model=FamilyDefinitionOut)
async def update_family(
    project_id: str,
    family_id: str,
    payload: FamilyDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(FamilyDefinition).where(
        FamilyDefinition.id == family_id,
        FamilyDefinition.project_id == project_id,
    )
    family = (await db.execute(query)).scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    update_data = payload.model_dump(exclude_unset=True)
    if "metadata" in update_data:
        update_data["metadata_json"] = update_data.pop("metadata")
    for field, value in update_data.items():
        setattr(family, field, value)
    normalized = family_template_service.normalize_family_payload(
        {
            "family": family.family,
            "category": family.category,
            "schema": family.schema,
            "preview": family.preview,
            "type_parameters": family.type_parameters,
            "instance_defaults": family.instance_defaults,
            "shared_parameters": family.shared_parameters,
            "metadata_json": family.metadata_json,
        }
    )
    family.category = normalized["category"]
    family.schema = normalized["schema"]
    family.type_parameters = normalized["type_parameters"]
    family.instance_defaults = normalized["instance_defaults"]
    family.shared_parameters = normalized["shared_parameters"]
    family.metadata_json = normalized["metadata_json"]
    await db.commit()
    await db.refresh(family)
    return family


@router.delete("/families/{family_id}")
async def delete_family(project_id: str, family_id: str, db: AsyncSession = Depends(get_db)):
    query = select(FamilyDefinition).where(
        FamilyDefinition.id == family_id,
        FamilyDefinition.project_id == project_id,
    )
    family = (await db.execute(query)).scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    await db.delete(family)
    await db.commit()
    return {"deleted": True}


@router.post("/families/{family_id}/instantiate", response_model=ModelElementOut)
async def instantiate_family(
    project_id: str,
    family_id: str,
    payload: FamilyInstantiateRequest,
    db: AsyncSession = Depends(get_db),
):
    query = select(FamilyDefinition).where(
        FamilyDefinition.id == family_id,
        FamilyDefinition.project_id == project_id,
    )
    family = (await db.execute(query)).scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    schema = family.schema or {}
    element_type = schema.get("type")
    if not element_type:
        raise HTTPException(status_code=400, detail="Family schema missing type")
    merged_params = family_template_service.instantiate_parameters(
        family=family,
        overrides=payload.parameters or {},
    )
    kernel_result = geometry_kernel_service.build_element_geometry(
        element_type=element_type,
        element_name=payload.name or family.family,
        geometry=payload.geometry,
        parameters=merged_params,
    )
    element_payload = {
        "project_id": project_id,
        "type": element_type,
        "category": family.category or category_registry_service.classify_element_type(element_type),
        "name": payload.name or family.family,
        "geometry": kernel_result.geometry,
        "parameters": kernel_result.parameters,
        "material_id": payload.material_id,
        "family_definition_id": family.id,
        "metadata": {
            "family": family.family,
            "cb01": {
                "source": "family_template",
                "family_definition_id": family.id,
            },
        },
    }
    element_payload = await _normalize_cb01_payload(project_id, element_payload, db)
    _hydrate_parametric_columns(element_payload)
    element = ModelElement(**element_payload)
    db.add(element)
    await db.flush()
    await _enforce_constraints(project_id, element, db)
    await _apply_host_wall_for_opening(project_id, element, db)
    if element_type == "Wall":
        await _sync_hosted_openings(project_id, element, db)
    await db.commit()
    await db.refresh(element)
    return element
