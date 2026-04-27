from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from .models import ProjectStatus

class ProjectCreate(BaseModel):
    name: str

class ProjectOut(BaseModel):
    id: UUID
    name: str
    status: ProjectStatus
    original_file: str
    xkt_file: Optional[str] = None
    hierarchy: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ElementOut(BaseModel):
    id: UUID
    global_id: str
    ifc_type: str
    name: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
