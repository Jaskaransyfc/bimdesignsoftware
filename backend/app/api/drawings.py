from __future__ import annotations

import io
import json
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from ..database import get_db
from ..models import Project
from ..storage import get_file_content, upload_file

router = APIRouter(prefix="/api/projects", tags=["drawings"])

SHEET_SIZES: dict[str, tuple[int, int]] = {
    "A1": (841, 594),
    "A2": (594, 420),
    "A3": (420, 297),
}


class AnnotationItem(BaseModel):
    id: str
    kind: Literal[
        "text",
        "dimension",
        "level",
        "grid_bubble",
        "room_tag",
        "door_tag",
        "window_tag",
        "section_mark",
        "revision_cloud",
    ]
    text: str | None = None
    x: float = 0.0
    y: float = 0.0
    x2: float | None = None
    y2: float | None = None
    points: list[list[float]] = Field(default_factory=list)


class AnnotationPayload(BaseModel):
    items: list[AnnotationItem] = Field(default_factory=list)


def _annotations_key(project_id: str) -> str:
    return f"viewable/{project_id}/annotations.json"


def _read_annotations(project_id: str) -> list[dict[str, Any]]:
    key = _annotations_key(project_id)
    try:
        raw = get_file_content(key)
    except Exception:
        return []
    try:
        parsed = json.loads(raw.decode("utf-8"))
        items = parsed.get("items", [])
        return items if isinstance(items, list) else []
    except Exception:
        return []


def _write_annotations(project_id: str, items: list[dict[str, Any]]) -> None:
    key = _annotations_key(project_id)
    upload_file(key, json.dumps({"items": items}, ensure_ascii=True).encode("utf-8"))


def _sheet_svg_for_project(
    project_id: str,
    *,
    size: str,
    title: str,
    drawing_number: str,
    revision: str,
    view: str,
) -> bytes:
    if size not in SHEET_SIZES:
        size = "A3"
    width_mm, height_mm = SHEET_SIZES[size]
    width = width_mm * 3
    height = height_mm * 3

    margin = 60
    title_block_h = 130
    drawing_x = margin
    drawing_y = margin
    drawing_w = width - margin * 2
    drawing_h = height - margin * 2 - title_block_h

    view_endpoint = {
        "plan": f"/api/projects/{project_id}/plan-view.svg",
        "section": f"/api/projects/{project_id}/section-view.svg?cut_plane_origin=0,0,0&cut_plane_direction=1,0,0",
        "elevation": f"/api/projects/{project_id}/elevation-view.svg?elevation_direction=1,0,0",
    }.get(view, f"/api/projects/{project_id}/plan-view.svg")

    annotations = _read_annotations(project_id)
    overlay: list[str] = []
    for ann in annotations:
        kind = ann.get("kind")
        text = (ann.get("text") or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        x = float(ann.get("x") or 0)
        y = float(ann.get("y") or 0)
        x2 = ann.get("x2")
        y2 = ann.get("y2")
        if kind == "text":
            overlay.append(f'<text x="{x}" y="{y}" font-size="14" fill="#111827">{text or "Text"}</text>')
        elif kind in {"room_tag", "door_tag", "window_tag", "grid_bubble", "level", "section_mark"}:
            overlay.append(f'<circle cx="{x}" cy="{y}" r="14" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5" />')
            overlay.append(f'<text x="{x}" y="{y + 4}" text-anchor="middle" font-size="10" fill="#1e3a8a">{text or kind}</text>')
        elif kind == "dimension" and x2 is not None and y2 is not None:
            overlay.append(f'<line x1="{x}" y1="{y}" x2="{x2}" y2="{y2}" stroke="#dc2626" stroke-width="1.5" />')
            mx = (x + float(x2)) / 2.0
            my = (y + float(y2)) / 2.0 - 6
            overlay.append(f'<text x="{mx}" y="{my}" text-anchor="middle" font-size="10" fill="#dc2626">{text or "DIM"}</text>')
        elif kind == "revision_cloud":
            overlay.append(
                f'<ellipse cx="{x}" cy="{y}" rx="28" ry="16" fill="none" stroke="#7c2d12" stroke-width="1.8" stroke-dasharray="4 3" />'
            )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect width="{width}" height="{height}" fill="#ffffff"/>
<rect x="{drawing_x}" y="{drawing_y}" width="{drawing_w}" height="{drawing_h}" fill="#fcfcfd" stroke="#111827" stroke-width="2"/>
<image href="{view_endpoint}" x="{drawing_x + 8}" y="{drawing_y + 8}" width="{drawing_w - 16}" height="{drawing_h - 16}" preserveAspectRatio="xMidYMid meet"/>
<g>{''.join(overlay)}</g>
<rect x="{margin}" y="{height - margin - title_block_h}" width="{width - margin * 2}" height="{title_block_h}" fill="#f8fafc" stroke="#111827" stroke-width="2"/>
<text x="{margin + 20}" y="{height - margin - title_block_h + 34}" font-size="24" fill="#0f172a">{title}</text>
<text x="{margin + 20}" y="{height - margin - title_block_h + 66}" font-size="14" fill="#475569">Sheet: {size}   View: {view.title()}</text>
<text x="{margin + 20}" y="{height - margin - 30}" font-size="14" fill="#334155">Drawing No: {drawing_number}</text>
<text x="{width - margin - 220}" y="{height - margin - 30}" font-size="14" fill="#334155">Revision: {revision}</text>
<line x1="{width - margin - 260}" y1="{height - margin - title_block_h}" x2="{width - margin - 260}" y2="{height - margin}" stroke="#111827" stroke-width="1.5"/>
<text x="{width - margin - 240}" y="{height - margin - title_block_h + 28}" font-size="12" fill="#475569">Revision Table</text>
</svg>"""
    return svg.encode("utf-8")


@router.get("/{project_id}/annotations")
async def get_annotations(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"items": _read_annotations(project_id)}


@router.put("/{project_id}/annotations")
async def update_annotations(project_id: str, payload: AnnotationPayload, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    items = [item.model_dump() for item in payload.items]
    _write_annotations(project_id, items)
    return {"ok": True, "count": len(items)}


@router.get("/{project_id}/sheet.svg")
async def get_sheet_svg(
    project_id: str,
    size: str = Query("A3"),
    title: str = Query("General Arrangement Sheet"),
    drawing_number: str = Query("A-101"),
    revision: str = Query("R0"),
    view: str = Query("plan"),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    svg = _sheet_svg_for_project(
        project_id,
        size=size,
        title=title,
        drawing_number=drawing_number,
        revision=revision,
        view=view,
    )
    return StreamingResponse(io.BytesIO(svg), media_type="image/svg+xml")


@router.get("/{project_id}/sheet.pdf")
async def get_sheet_pdf(
    project_id: str,
    size: str = Query("A3"),
    title: str = Query("General Arrangement Sheet"),
    drawing_number: str = Query("A-101"),
    revision: str = Query("R0"),
    view: str = Query("plan"),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        from reportlab.lib.pagesizes import A1, A2, A3, landscape
        from reportlab.pdfgen import canvas
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF export unavailable: {exc}")

    pages = {"A1": landscape(A1), "A2": landscape(A2), "A3": landscape(A3)}
    width_pt, height_pt = pages.get(size, pages["A3"])
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width_pt, height_pt))

    margin = 24
    title_h = 90
    pdf.setLineWidth(1.2)
    pdf.rect(margin, margin + title_h, width_pt - margin * 2, height_pt - margin * 2 - title_h)
    pdf.rect(margin, margin, width_pt - margin * 2, title_h)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(margin + 12, margin + title_h - 24, title)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(
        margin + 12,
        margin + title_h - 42,
        f"Sheet: {size}  View: {view.title()}  Drawing No: {drawing_number}  Revision: {revision}",
    )
    pdf.drawString(margin + 12, margin + 14, "export (PDF title-sheet)")
    pdf.showPage()
    pdf.save()
    pdf_bytes = buffer.getvalue()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{project_id}_sheet.pdf"'},
    )


@router.get("/{project_id}/sheet.dxf")
async def get_sheet_dxf(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        dxf = get_file_content(f"viewable/{project_id}/plan.dxf")
    except Exception:
        dxf = (
            "0\nSECTION\n2\nENTITIES\n"
            "0\nLINE\n8\n0\n10\n0\n20\n0\n11\n297\n21\n210\n"
            "0\nENDSEC\n0\nEOF\n"
        ).encode("ascii")

    return StreamingResponse(
        io.BytesIO(dxf),
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{project_id}_sheet.dxf"'},
    )

