from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from .models import ProjectStatus

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
