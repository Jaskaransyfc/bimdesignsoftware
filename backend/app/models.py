from sqlalchemy import Column, String, DateTime, Enum, Text, JSON, Float, ForeignKey, Boolean
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
    drawing = Column(JSON, nullable=True)          # 2D CAD Elements

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


class Level(Base):
    __tablename__ = "levels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # "Ground Floor", "1st Floor", etc.
    elevation_m = Column(Float, default=0.0)  # elevation in meters
    floor_height_m = Column(Float, default=3.0)  # height of this floor
    order = Column(Float, default=0.0)  # for ordering floors
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ModelElement(Base):
    __tablename__ = "model_elements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    level_id = Column(String(36), ForeignKey("levels.id"), nullable=True, index=True)
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


class FamilyDefinition(Base):
    __tablename__ = "family_definitions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    family = Column(String, nullable=False)
    category = Column(String, nullable=False)
    schema = Column(JSON, nullable=False)
    preview = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FurnitureItem(Base):
    __tablename__ = "furniture_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    level_id = Column(String(36), ForeignKey("levels.id"), nullable=True, index=True)
    asset_type = Column(String, nullable=False)  # "Chair", "Sofa", "Table", "TV", etc.
    family = Column(String, nullable=False)  # e.g., "Office Chair", "3-Seat Sofa"
    x = Column(Float, nullable=False)  # x position on level in meters
    y = Column(Float, nullable=False)  # y position on level in meters
    z = Column(Float, nullable=False)  # z rotation in degrees
    width = Column(Float, nullable=True)  # in meters
    depth = Column(Float, nullable=True)  # in meters
    height = Column(Float, nullable=True)  # in meters
    material_id = Column(String(36), ForeignKey("materials.id"), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)  # additional properties (color, style, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FurnitureModel(Base):
    """User-uploaded 3D models for furniture"""
    __tablename__ = "furniture_models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # e.g., "Modern Chair", "Custom Sofa"
    file_path = Column(String, nullable=False)  # path to .glb, .gltf, .obj, .fbx file
    file_size = Column(Float, nullable=False)  # in bytes
    model_type = Column(String, nullable=False, default="custom")  # "chair", "sofa", "table", "custom", etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EscrowMilestone(Base):
    __tablename__ = "escrow_milestones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    boq_item_id = Column(String(64), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(8), nullable=False, default="USD")
    engineer_approved = Column(Boolean, nullable=False, default=False)
    client_approved = Column(Boolean, nullable=False, default=False)
    payment_status = Column(String(24), nullable=False, default="pending")
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MarketplacePlugin(Base):
    __tablename__ = "marketplace_plugins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    slug = Column(String(120), nullable=False)
    sdk_type = Column(String(24), nullable=False)  # python | javascript
    version = Column(String(24), nullable=False, default="0.1.0")
    container_image = Column(String(255), nullable=True)
    manifest = Column(JSON, nullable=False, default={})
    status = Column(String(24), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(120), nullable=False)
    sso_provider = Column(String(32), nullable=True, default="keycloak")
    sso_issuer = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_email = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProjectAccessGrant(Base):
    __tablename__ = "project_access_grants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_email = Column(String(255), nullable=False)
    permission = Column(String(32), nullable=False, default="read")  # read | edit | approve | admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LicenseKey(Base):
    __tablename__ = "license_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    key = Column(String(64), nullable=False)
    plan = Column(String(32), nullable=False, default="enterprise")
    active = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    actor = Column(String(255), nullable=False, default="system")
    action = Column(String(120), nullable=False)
    entity = Column(String(120), nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

                                                                                                                                                                                                                                                                                                                                                                                                    