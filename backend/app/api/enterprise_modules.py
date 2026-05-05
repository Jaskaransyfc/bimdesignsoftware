from __future__ import annotations

from datetime import datetime, timedelta
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    AuditLog,
    EscrowMilestone,
    LicenseKey,
    MarketplacePlugin,
    Organization,
    OrganizationMember,
    Project,
    ProjectAccessGrant,
)

router = APIRouter(prefix="/api/projects", tags=["enterprise-modules"])


class EscrowStartRequest(BaseModel):
    boq_item_id: str
    amount: float = Field(ge=0)
    currency: str = "USD"
    actor: str = "engineer@local"


class EscrowApprovalRequest(BaseModel):
    actor: str


class EscrowMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    boq_item_id: str
    amount: float
    currency: str
    engineer_approved: bool
    client_approved: bool
    payment_status: str
    triggered_at: datetime | None
    created_at: datetime


class PluginRegisterRequest(BaseModel):
    name: str
    slug: str
    sdk_type: Literal["python", "javascript"]
    version: str = "0.1.0"
    container_image: str | None = None
    manifest: dict[str, Any] = Field(default_factory=dict)
    actor: str = "consultant@local"


class PluginRunRequest(BaseModel):
    actor: str = "consultant@local"
    payload: dict[str, Any] = Field(default_factory=dict)


class PluginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    slug: str
    sdk_type: str
    version: str
    container_image: str | None
    status: str
    manifest: dict[str, Any]
    created_at: datetime


class OrganizationCreateRequest(BaseModel):
    name: str
    sso_provider: str = "keycloak"
    sso_issuer: str | None = None
    actor: str = "admin@local"


class OrganizationMemberRequest(BaseModel):
    user_email: str
    role: Literal["viewer", "editor", "approver", "admin"]
    actor: str = "admin@local"


class ProjectAccessRequest(BaseModel):
    organization_id: str
    user_email: str
    permission: Literal["read", "edit", "approve", "admin"]
    actor: str = "admin@local"


class LicenseIssueRequest(BaseModel):
    organization_id: str
    plan: Literal["team", "business", "enterprise"] = "enterprise"
    duration_days: int = Field(default=365, ge=1)
    actor: str = "admin@local"


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str | None
    organization_id: str | None
    actor: str
    action: str
    entity: str
    metadata: dict[str, Any] | None = Field(default=None, alias="metadata_json")
    created_at: datetime


async def _assert_project(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _audit(
    db: AsyncSession,
    *,
    project_id: str | None,
    organization_id: str | None,
    actor: str,
    action: str,
    entity: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            project_id=project_id,
            organization_id=organization_id,
            actor=actor,
            action=action,
            entity=entity,
            metadata_json=metadata or {},
        )
    )


@router.post("/{project_id}/modules/payment-escrow/start", response_model=EscrowMilestoneResponse)
async def start_payment_escrow(
    project_id: str,
    payload: EscrowStartRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)

    milestone = EscrowMilestone(
        project_id=project_id,
        boq_item_id=payload.boq_item_id,
        amount=payload.amount,
        currency=payload.currency,
        payment_status="pending",
    )
    db.add(milestone)

    await _audit(
        db,
        project_id=project_id,
        organization_id=None,
        actor=payload.actor,
        action="escrow.start",
        entity="EscrowMilestone",
        metadata={
            "boq_item_id": payload.boq_item_id,
            "amount": payload.amount,
            "currency": payload.currency,
        },
    )
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.post("/{project_id}/modules/payment-escrow/{milestone_id}/engineer-approve", response_model=EscrowMilestoneResponse)
async def engineer_approve_milestone(
    project_id: str,
    milestone_id: str,
    payload: EscrowApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    milestone = await db.get(EscrowMilestone, milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    milestone.engineer_approved = True
    if milestone.engineer_approved and milestone.client_approved:
        milestone.payment_status = "triggered"
        milestone.triggered_at = datetime.utcnow()
    else:
        milestone.payment_status = "engineer_approved"

    await _audit(
        db,
        project_id=project_id,
        organization_id=None,
        actor=payload.actor,
        action="escrow.engineer_approve",
        entity="EscrowMilestone",
        metadata={"milestone_id": milestone_id},
    )
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.post("/{project_id}/modules/payment-escrow/{milestone_id}/client-approve", response_model=EscrowMilestoneResponse)
async def client_approve_milestone(
    project_id: str,
    milestone_id: str,
    payload: EscrowApprovalRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    milestone = await db.get(EscrowMilestone, milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found")

    milestone.client_approved = True
    if milestone.engineer_approved and milestone.client_approved:
        milestone.payment_status = "triggered"
        milestone.triggered_at = datetime.utcnow()
    else:
        milestone.payment_status = "client_approved"

    await _audit(
        db,
        project_id=project_id,
        organization_id=None,
        actor=payload.actor,
        action="escrow.client_approve",
        entity="EscrowMilestone",
        metadata={"milestone_id": milestone_id},
    )
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.get("/{project_id}/modules/payment-escrow/milestones", response_model=list[EscrowMilestoneResponse])
async def list_payment_milestones(project_id: str, db: AsyncSession = Depends(get_db)):
    await _assert_project(project_id, db)
    result = await db.execute(
        select(EscrowMilestone)
        .where(EscrowMilestone.project_id == project_id)
        .order_by(EscrowMilestone.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{project_id}/modules/marketplace/plugins", response_model=PluginResponse)
async def register_plugin(
    project_id: str,
    payload: PluginRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)

    plugin = MarketplacePlugin(
        project_id=project_id,
        name=payload.name,
        slug=payload.slug,
        sdk_type=payload.sdk_type,
        version=payload.version,
        container_image=payload.container_image,
        manifest=payload.manifest,
        status="active",
    )
    db.add(plugin)

    await _audit(
        db,
        project_id=project_id,
        organization_id=None,
        actor=payload.actor,
        action="marketplace.plugin_register",
        entity="MarketplacePlugin",
        metadata={"slug": payload.slug, "sdk_type": payload.sdk_type},
    )
    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.get("/{project_id}/modules/marketplace/plugins", response_model=list[PluginResponse])
async def list_plugins(project_id: str, db: AsyncSession = Depends(get_db)):
    await _assert_project(project_id, db)
    result = await db.execute(
        select(MarketplacePlugin)
        .where(MarketplacePlugin.project_id == project_id)
        .order_by(MarketplacePlugin.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{project_id}/modules/marketplace/plugins/{plugin_id}/run")
async def run_plugin(
    project_id: str,
    plugin_id: str,
    payload: PluginRunRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    plugin = await db.get(MarketplacePlugin, plugin_id)
    if not plugin or plugin.project_id != project_id:
        raise HTTPException(status_code=404, detail="Plugin not found")

    output = {
        "plugin_id": plugin.id,
        "name": plugin.name,
        "slug": plugin.slug,
        "sdk_type": plugin.sdk_type,
        "sandbox": {
            "engine": "docker",
            "status": "simulated-ok",
        },
        "report": {
            "title": f"{plugin.name} Report",
            "summary": "Plugin executed in sandbox mode successfully.",
            "input_keys": sorted(list(payload.payload.keys())),
            "timestamp": datetime.utcnow().isoformat(),
        },
    }

    await _audit(
        db,
        project_id=project_id,
        organization_id=None,
        actor=payload.actor,
        action="marketplace.plugin_run",
        entity="MarketplacePlugin",
        metadata={"plugin_id": plugin_id, "payload_size": len(payload.payload)},
    )
    await db.commit()
    return output


@router.post("/{project_id}/modules/admin/organizations")
async def create_organization(
    project_id: str,
    payload: OrganizationCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)

    org = Organization(
        name=payload.name,
        sso_provider=payload.sso_provider,
        sso_issuer=payload.sso_issuer,
    )
    db.add(org)
    await db.flush()

    await _audit(
        db,
        project_id=project_id,
        organization_id=org.id,
        actor=payload.actor,
        action="admin.organization_create",
        entity="Organization",
        metadata={"name": payload.name, "sso_provider": payload.sso_provider},
    )
    await db.commit()
    await db.refresh(org)

    return {
        "id": org.id,
        "name": org.name,
        "sso_provider": org.sso_provider,
        "sso_issuer": org.sso_issuer,
        "created_at": org.created_at,
    }


@router.post("/{project_id}/modules/admin/organizations/{organization_id}/members")
async def add_organization_member(
    project_id: str,
    organization_id: str,
    payload: OrganizationMemberRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member = OrganizationMember(
        organization_id=organization_id,
        user_email=payload.user_email,
        role=payload.role,
    )
    db.add(member)

    await _audit(
        db,
        project_id=project_id,
        organization_id=organization_id,
        actor=payload.actor,
        action="admin.member_add",
        entity="OrganizationMember",
        metadata={"user_email": payload.user_email, "role": payload.role},
    )
    await db.commit()
    await db.refresh(member)
    return {
        "id": member.id,
        "organization_id": member.organization_id,
        "user_email": member.user_email,
        "role": member.role,
        "created_at": member.created_at,
    }


@router.post("/{project_id}/modules/admin/project-access")
async def grant_project_access(
    project_id: str,
    payload: ProjectAccessRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    org = await db.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    grant = ProjectAccessGrant(
        project_id=project_id,
        organization_id=payload.organization_id,
        user_email=payload.user_email,
        permission=payload.permission,
    )
    db.add(grant)

    await _audit(
        db,
        project_id=project_id,
        organization_id=payload.organization_id,
        actor=payload.actor,
        action="admin.project_access_grant",
        entity="ProjectAccessGrant",
        metadata={"user_email": payload.user_email, "permission": payload.permission},
    )
    await db.commit()
    await db.refresh(grant)
    return {
        "id": grant.id,
        "project_id": grant.project_id,
        "organization_id": grant.organization_id,
        "user_email": grant.user_email,
        "permission": grant.permission,
        "created_at": grant.created_at,
    }


@router.post("/{project_id}/modules/admin/license/issue")
async def issue_license(
    project_id: str,
    payload: LicenseIssueRequest,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)
    org = await db.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    raw_key = secrets.token_hex(16).upper()
    formatted = "-".join([raw_key[i : i + 4] for i in range(0, len(raw_key), 4)])
    license_row = LicenseKey(
        organization_id=payload.organization_id,
        key=formatted,
        plan=payload.plan,
        active=True,
        expires_at=datetime.utcnow() + timedelta(days=payload.duration_days),
    )
    db.add(license_row)

    await _audit(
        db,
        project_id=project_id,
        organization_id=payload.organization_id,
        actor=payload.actor,
        action="admin.license_issue",
        entity="LicenseKey",
        metadata={"plan": payload.plan, "duration_days": payload.duration_days},
    )
    await db.commit()
    await db.refresh(license_row)
    return {
        "id": license_row.id,
        "organization_id": license_row.organization_id,
        "plan": license_row.plan,
        "key": license_row.key,
        "active": license_row.active,
        "expires_at": license_row.expires_at,
        "created_at": license_row.created_at,
    }


@router.get("/{project_id}/modules/admin/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    project_id: str,
    organization_id: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    await _assert_project(project_id, db)

    query = select(AuditLog).where(AuditLog.project_id == project_id)
    if organization_id:
        query = query.where(AuditLog.organization_id == organization_id)
    query = query.order_by(AuditLog.created_at.desc()).limit(max(1, min(limit, 500)))

    result = await db.execute(query)
    return result.scalars().all()
