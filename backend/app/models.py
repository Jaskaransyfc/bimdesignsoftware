from sqlalchemy import Column, String, DateTime, Enum, Text, JSON
from sqlalchemy.sql import func
import uuid
from .database import Base
import enum

class ProjectStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"

class Project(Base):
    __tablename__ = "projects"

    # Using String for IDs to ensure compatibility with SQLite local mode
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.UPLOADED)
    original_file = Column(String, nullable=False)  # path in MinIO/Local
    xkt_file = Column(String, nullable=True)         # path to converted glB/XKT
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
