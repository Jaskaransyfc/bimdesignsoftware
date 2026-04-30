from sqlalchemy import Column, String, DateTime, Enum, Text, JSON, Float, ForeignKey
from sqlalchemy.sql import func
import uuid
from .database import Base
import enum

class ProjectStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class ModelElementType(str, enum.Enum):
    WALL = "Wall"
    SLAB = "Slab"
    COLUMN = "Column"
    BEAM = "Beam"
    DOOR = "Door"
    WINDOW = "Window"
    OPENING = "Opening"
    ROOM = "Room"
    GRID = "Grid"
    LEVEL = "Level"

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=False)

class Project(Base):
    __tablename__ = "projects"

    # Using String for IDs to ensure compatibility with SQLite local mode
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.UPLOADED)
    original_file = Column(String, nullable=False)  # path in MinIO/Local
    xkt_file = Column(String, nullable=True)         # path to converted glB/XKT
    hierarchy = Column(JSON, nullable=True)        # IFC Spatial Structure

    # Module 1 – Project Metadata
    client_name = Column(String, nullable=True)
    location = Column(String, nullable=True)
    team_members = Column(JSON, nullable=True)     # list of {"name": "...", "email": "..."}

    viewer_file = Column(String, nullable=True)    
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Element(Base):
    __tablename__ = "elements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), nullable=False)
    global_id = Column(String, nullable=False)
    ifc_type = Column(String, nullable=False)
    name = Column(String, nullable=True)
    properties = Column(JSON, nullable=True)   # full property set as JSON

class BOQItem(Base):
    __tablename__ = "boq_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    ifc_type = Column(String, nullable=False)
    element_name = Column(String, nullable=True)
    quantity_name = Column(String, nullable=False)
    quantity_value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)


class Material(Base):
    __tablename__ = "materials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    specification = Column(JSON, nullable=True)
    color = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ModelElement(Base):
    __tablename__ = "model_elements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    type = Column(Enum(ModelElementType), nullable=False)
    name = Column(String, nullable=True)
    start = Column(JSON, nullable=True)
    end = Column(JSON, nullable=True)
    height = Column(Float, nullable=True)
    thickness = Column(Float, nullable=True)
    geometry = Column(JSON, nullable=True)
    material_id = Column(String(36), ForeignKey("materials.id"), nullable=True)
    parameters = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
