from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..geometry_kernel import geometry_kernel_service
from ..models import (
    BIMCategory,
    ElementTypeDefinition,
    ModelElement,
    Project,
    ProjectUnitSettings,
    SharedParameterDefinition,
    ValidationRuleDefinition,
)
from ..services.category_registry import category_registry_service
from ..services.element_registry import element_registry_service
from ..services.parameter_service import parameter_service
from ..services.shared_parameter_service import shared_parameter_service
from ..services.unit_engine import unit_conversion_service
from ..services.validation_engine import validation_engine

router = APIRouter(prefix="/api/bim/projects/{project_id}", tags=["cb-01"])


class UnitSettingsUpdate(BaseModel):
    length_unit: str | None = None
    area_unit: str | None = None
    volume_unit: str | None = None
    pressure_unit: str | None = None
    power_unit: str | None = None
    force_unit: str | None = None
    precision: int | None = None
    metadata: dict[str, Any] | None = None


class SharedParameterPayload(BaseModel):
    key: str
    name: str
    data_type: str = "string"
    unit_type: str | None = None
    internal_unit: str | None = None
    categories: list[str] = []
    default_value: Any | None = None
    required: bool = False
    visible: bool = True
    visibility_rules: dict[str, Any] | None = None
    validation: dict[str, Any] | None = None
    ifc_property: str | None = None
    metadata: dict[str, Any] | None = None


class ElementTypePayload(BaseModel):
    name: str
    element_type: str
    category: str | None = None
    family_definition_id: str | None = None
    type_parameters: dict[str, Any] = {}
    instance_parameter_schema: dict[str, Any] | None = None
    shared_parameter_keys: list[str] = []
    ifc_entity: str | None = None
    classification: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class ValidationRequest(BaseModel):
    elements: list[dict[str, Any]] | None = None


class ParameterUpdateRequest(BaseModel):
    key: str
    value: Any
    scope: Literal["type", "instance", "shared"] = "instance"
    propagate: bool = True


async def _ensure_project(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _as_dict(row: Any) -> dict[str, Any]:
    data = {
        column.name: getattr(row, column.name)
        for column in row.__table__.columns
        if column.name != "metadata"
    }
    if hasattr(row, "metadata_json"):
        data["metadata"] = row.metadata_json
    return data


async def _get_or_create_unit_settings(project_id: str, db: AsyncSession) -> ProjectUnitSettings:
    result = await db.execute(
        select(ProjectUnitSettings).where(ProjectUnitSettings.project_id == project_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings
    settings = ProjectUnitSettings(project_id=project_id)
    db.add(settings)
    await db.flush()
    return settings


@router.get("/foundation")
async def get_foundation(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    unit_settings = await _get_or_create_unit_settings(project_id, db)

    categories_result = await db.execute(
        select(BIMCategory).where(BIMCategory.project_id == project_id)
    )
    shared_result = await db.execute(
        select(SharedParameterDefinition).where(SharedParameterDefinition.project_id == project_id)
    )
    type_result = await db.execute(
        select(ElementTypeDefinition).where(ElementTypeDefinition.project_id == project_id)
    )
    rule_result = await db.execute(
        select(ValidationRuleDefinition).where(ValidationRuleDefinition.project_id == project_id)
    )

    await db.commit()
    return {
        "schema_version": "CB-01",
        "categories": category_registry_service.default_categories()
        + [_as_dict(row) for row in categories_result.scalars().all()],
        "shared_parameters": shared_parameter_service.default_definitions()
        + [_as_dict(row) for row in shared_result.scalars().all()],
        "unit_settings": _as_dict(unit_settings),
        "supported_units": unit_conversion_service.supported_units(),
        "validation_rules": validation_engine.default_rules()
        + [_as_dict(row) for row in rule_result.scalars().all()],
        "type_definitions": [_as_dict(row) for row in type_result.scalars().all()],
        "object_model": {
            "fields": [
                "id",
                "element_type",
                "category",
                "geometry",
                "parameters",
                "metadata",
                "relationships",
                "transform",
                "level_id",
                "visible",
                "created_at",
                "updated_at",
            ],
            "canonical_units": {
                "length": "m",
                "area": "sq.m",
                "volume": "cubic_m",
                "pressure": "Pa",
                "power": "W",
                "force": "N",
            },
        },
    }


@router.get("/categories")
async def list_categories(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    result = await db.execute(select(BIMCategory).where(BIMCategory.project_id == project_id))
    return category_registry_service.default_categories() + [_as_dict(row) for row in result.scalars().all()]


@router.get("/unit-settings")
async def get_unit_settings(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    settings = await _get_or_create_unit_settings(project_id, db)
    await db.commit()
    return _as_dict(settings)


@router.put("/unit-settings")
async def update_unit_settings(
    project_id: str,
    payload: UnitSettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project(project_id, db)
    settings = await _get_or_create_unit_settings(project_id, db)
    updates = payload.model_dump(exclude_unset=True)
    metadata = updates.pop("metadata", None)
    for field, value in updates.items():
        if value is not None:
            setattr(settings, field, value)
    if metadata is not None:
        settings.metadata_json = metadata
    await db.commit()
    await db.refresh(settings)
    return _as_dict(settings)


@router.get("/shared-parameters")
async def list_shared_parameters(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    result = await db.execute(
        select(SharedParameterDefinition).where(SharedParameterDefinition.project_id == project_id)
    )
    return shared_parameter_service.default_definitions() + [_as_dict(row) for row in result.scalars().all()]


@router.post("/shared-parameters")
async def create_shared_parameter(
    project_id: str,
    payload: SharedParameterPayload,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project(project_id, db)
    data = payload.model_dump()
    metadata = data.pop("metadata", None)
    definition = SharedParameterDefinition(project_id=project_id, metadata_json=metadata, **data)
    db.add(definition)
    await db.commit()
    await db.refresh(definition)
    return _as_dict(definition)


@router.get("/type-definitions")
async def list_type_definitions(project_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    result = await db.execute(
        select(ElementTypeDefinition).where(ElementTypeDefinition.project_id == project_id)
    )
    return [_as_dict(row) for row in result.scalars().all()]


@router.post("/type-definitions")
async def create_type_definition(
    project_id: str,
    payload: ElementTypePayload,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project(project_id, db)
    data = payload.model_dump()
    metadata = data.pop("metadata", None)
    if not data.get("category"):
        data["category"] = category_registry_service.classify_element_type(data["element_type"])
    type_definition = ElementTypeDefinition(project_id=project_id, metadata_json=metadata, **data)
    db.add(type_definition)
    await db.commit()
    await db.refresh(type_definition)
    return _as_dict(type_definition)


@router.get("/elements/{element_id}/object")
async def get_bim_object(project_id: str, element_id: str, db: AsyncSession = Depends(get_db)):
    await _ensure_project(project_id, db)
    result = await db.execute(
        select(ModelElement).where(ModelElement.project_id == project_id, ModelElement.id == element_id)
    )
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Model element not found")
    return element_registry_service.to_bim_object(element)


@router.put("/elements/{element_id}/parameters")
async def update_element_parameter(
    project_id: str,
    element_id: str,
    payload: ParameterUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project(project_id, db)
    result = await db.execute(
        select(ModelElement).where(ModelElement.project_id == project_id, ModelElement.id == element_id)
    )
    element = result.scalar_one_or_none()
    if not element:
        raise HTTPException(status_code=404, detail="Model element not found")

    element_type = element.type.value if hasattr(element.type, "value") else str(element.type)
    category = element.category or category_registry_service.classify_element_type(element_type)
    affected = [element]

    if payload.scope == "type" and payload.propagate and element.type_definition_id:
        type_def = await db.get(ElementTypeDefinition, element.type_definition_id)
        if type_def and type_def.project_id == project_id:
            type_params = dict(type_def.type_parameters or {})
            type_params[payload.key] = payload.value
            type_def.type_parameters = type_params
            result = await db.execute(
                select(ModelElement).where(
                    ModelElement.project_id == project_id,
                    ModelElement.type_definition_id == element.type_definition_id,
                )
            )
            affected = list(result.scalars().all())

    for item in affected:
        item_type = item.type.value if hasattr(item.type, "value") else str(item.type)
        item_category = item.category or category_registry_service.classify_element_type(item_type)
        item.parameters = parameter_service.update_parameter(
            parameters=item.parameters,
            scope=payload.scope,
            key=payload.key,
            value=payload.value,
            element_type=item_type,
            category=item_category,
        )
        kernel_result = geometry_kernel_service.build_element_geometry(
            element_type=item_type,
            element_name=item.name,
            geometry=item.geometry,
            parameters=item.parameters,
        )
        normalized = element_registry_service.normalize_payload(
            project_id=project_id,
            payload_data={
                "type": item.type,
                "category": item_category,
                "geometry": kernel_result.geometry,
                "parameters": kernel_result.parameters,
                "metadata_json": item.metadata_json,
                "relationships": item.relationships,
                "transform": item.transform,
                "classification": item.classification,
                "visible": item.visible,
            },
            existing=item,
        )
        item.category = normalized["category"]
        item.geometry = normalized["geometry"]
        item.parameters = normalized["parameters"]
        item.metadata_json = normalized["metadata_json"]
        item.relationships = normalized["relationships"]
        item.transform = normalized["transform"]
        item.classification = normalized["classification"]
        item.visible = normalized["visible"]

    await db.commit()
    return {"updated": len(affected)}


@router.post("/validate")
async def validate_project(
    project_id: str,
    payload: ValidationRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_project(project_id, db)
    if payload and payload.elements is not None:
        issues = validation_engine.validate_elements(payload.elements)
    else:
        result = await db.execute(select(ModelElement).where(ModelElement.project_id == project_id))
        issues = validation_engine.validate_elements(list(result.scalars().all()))
    return {
        "schema_version": "CB-01",
        "issue_count": len(issues),
        "issues": issues,
        "status": "passed" if not any(issue["severity"] == "error" for issue in issues) else "failed",
    }

