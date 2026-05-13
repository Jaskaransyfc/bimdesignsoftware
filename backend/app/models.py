from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
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
    CEILING = "Ceiling"
    FURNITURE = "Furniture"
    ELECTRICAL = "Electrical"
    HVAC = "HVAC"
    PLUMBING = "Plumbing"
    FIRE_FIGHTING = "FireFighting"
    MEP = "MEP"
    CUSTOM = "Custom"

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
    category = Column(String(64), nullable=True, index=True)
    type_definition_id = Column(String(36), ForeignKey("element_type_definitions.id"), nullable=True, index=True)
    family_definition_id = Column(String(36), ForeignKey("family_definitions.id"), nullable=True, index=True)
    name = Column(String, nullable=True)
    start = Column(JSON, nullable=True)
    end = Column(JSON, nullable=True)
    height = Column(Float, nullable=True)
    thickness = Column(Float, nullable=True)
    geometry = Column(JSON, nullable=True)
    material_id = Column(String(36), ForeignKey("materials.id"), nullable=True)
    parameters = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    relationships = Column(JSON, nullable=True)
    transform = Column(JSON, nullable=True)
    visible = Column(Boolean, nullable=False, default=True)
    classification = Column(JSON, nullable=True)
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
    type_parameters = Column(JSON, nullable=True)
    instance_defaults = Column(JSON, nullable=True)
    shared_parameters = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BIMCategory(Base):
    __tablename__ = "bim_categories"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_bim_categories_project_code"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    discipline = Column(String(64), nullable=False, default="architecture")
    parent_code = Column(String(64), nullable=True)
    ifc_class = Column(String(120), nullable=True)
    element_types = Column(JSON, nullable=False, default=list)
    default_visible = Column(Boolean, nullable=False, default=True)
    schedule_enabled = Column(Boolean, nullable=False, default=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SharedParameterDefinition(Base):
    __tablename__ = "shared_parameter_definitions"
    __table_args__ = (
        UniqueConstraint("project_id", "key", name="uq_shared_parameters_project_key"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    key = Column(String(120), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    data_type = Column(String(32), nullable=False, default="string")
    unit_type = Column(String(64), nullable=True)
    internal_unit = Column(String(32), nullable=True)
    categories = Column(JSON, nullable=False, default=list)
    default_value = Column(JSON, nullable=True)
    required = Column(Boolean, nullable=False, default=False)
    visible = Column(Boolean, nullable=False, default=True)
    visibility_rules = Column(JSON, nullable=True)
    validation = Column(JSON, nullable=True)
    ifc_property = Column(String(160), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ElementTypeDefinition(Base):
    __tablename__ = "element_type_definitions"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_element_types_project_name"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    family_definition_id = Column(String(36), ForeignKey("family_definitions.id"), nullable=True, index=True)
    name = Column(String(160), nullable=False)
    element_type = Column(String(64), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    type_parameters = Column(JSON, nullable=False, default=dict)
    instance_parameter_schema = Column(JSON, nullable=True)
    shared_parameter_keys = Column(JSON, nullable=False, default=list)
    ifc_entity = Column(String(120), nullable=True)
    classification = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ProjectUnitSettings(Base):
    __tablename__ = "project_unit_settings"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_project_unit_settings_project"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    length_unit = Column(String(24), nullable=False, default="mm")
    area_unit = Column(String(24), nullable=False, default="sq.m")
    volume_unit = Column(String(24), nullable=False, default="cubic_m")
    pressure_unit = Column(String(24), nullable=False, default="Pa")
    power_unit = Column(String(24), nullable=False, default="W")
    force_unit = Column(String(24), nullable=False, default="N")
    precision = Column(Integer, nullable=False, default=3)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ValidationRuleDefinition(Base):
    __tablename__ = "validation_rule_definitions"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_validation_rules_project_code"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=True, index=True)
    code = Column(String(120), nullable=False, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    target_categories = Column(JSON, nullable=False, default=list)
    severity = Column(String(24), nullable=False, default="warning")
    rule_type = Column(String(64), nullable=False, default="metadata")
    config = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BIMValidationIssue(Base):
    __tablename__ = "bim_validation_issues"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    element_id = Column(String(36), nullable=True, index=True)
    rule_code = Column(String(120), nullable=False)
    severity = Column(String(24), nullable=False, default="warning")
    message = Column(Text, nullable=False)
    path = Column(String(240), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


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

                                                                                                                                                                                                                                                                                                                                                                                                    
