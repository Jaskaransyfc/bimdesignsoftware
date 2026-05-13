from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from .models import ProjectStatus, ModelElementType

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    location: Optional[str] = None
    team_members: Optional[List[Dict[str, str]]] = None


class ProjectBlankCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    location: Optional[str] = None
    team_members: Optional[List[Dict[str, str]]] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    team_members: Optional[List[Dict[str, str]]] = None

class ProjectOut(BaseModel):
    id: UUID
    name: str
    status: ProjectStatus
    original_file: str
    xkt_file: Optional[str] = None
    hierarchy: Optional[Dict[str, Any]] = None
    viewer_file: Optional[str] = None        
    error_message: Optional[str] = None 
    client_name: Optional[str] = None
    location: Optional[str] = None
    team_members: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ElementOut(BaseModel):
    id: UUID
    global_id: str
    ifc_type: str
    name: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

class BOQSummaryItem(BaseModel):
    type: str
    quantity: str
    unit: Optional[str] = None
    total: float


class MaterialBase(BaseModel):
    name: str
    category: Optional[str] = None
    specification: Optional[Dict[str, Any]] = None
    color: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    specification: Optional[Dict[str, Any]] = None
    color: Optional[str] = None


class MaterialOut(MaterialBase):
    id: str
    project_id: str

    class Config:
        from_attributes = True


class ModelElementBase(BaseModel):
    type: ModelElementType
    category: Optional[str] = None
    type_definition_id: Optional[str] = None
    family_definition_id: Optional[str] = None
    name: Optional[str] = None
    start: Optional[List[float]] = None
    end: Optional[List[float]] = None
    height: Optional[float] = None
    thickness: Optional[float] = None
    geometry: Optional[Dict[str, Any]] = None
    material_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    relationships: Optional[Dict[str, Any]] = None
    transform: Optional[Dict[str, Any]] = None
    visible: Optional[bool] = True
    classification: Optional[Dict[str, Any]] = None


class ModelElementCreate(ModelElementBase):
    pass


class ModelElementUpdate(BaseModel):
    type: Optional[ModelElementType] = None
    category: Optional[str] = None
    type_definition_id: Optional[str] = None
    family_definition_id: Optional[str] = None
    name: Optional[str] = None
    start: Optional[List[float]] = None
    end: Optional[List[float]] = None
    height: Optional[float] = None
    thickness: Optional[float] = None
    geometry: Optional[Dict[str, Any]] = None
    material_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    relationships: Optional[Dict[str, Any]] = None
    transform: Optional[Dict[str, Any]] = None
    visible: Optional[bool] = None
    classification: Optional[Dict[str, Any]] = None


class ModelElementOut(ModelElementBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    project_id: str
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        validation_alias="metadata_json",
        serialization_alias="metadata",
    )


class FamilyDefinitionBase(BaseModel):
    family: str
    category: str
    schema: Dict[str, Any]
    preview: Optional[Dict[str, Any]] = None
    type_parameters: Optional[Dict[str, Any]] = None
    instance_defaults: Optional[Dict[str, Any]] = None
    shared_parameters: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class FamilyDefinitionCreate(FamilyDefinitionBase):
    pass


class FamilyDefinitionUpdate(BaseModel):
    family: Optional[str] = None
    category: Optional[str] = None
    schema: Optional[Dict[str, Any]] = None
    preview: Optional[Dict[str, Any]] = None
    type_parameters: Optional[Dict[str, Any]] = None
    instance_defaults: Optional[Dict[str, Any]] = None
    shared_parameters: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class FamilyDefinitionOut(FamilyDefinitionBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    project_id: str
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        validation_alias="metadata_json",
        serialization_alias="metadata",
    )


class FamilyInstantiateRequest(BaseModel):
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    geometry: Optional[Dict[str, Any]] = None
    material_id: Optional[str] = None
