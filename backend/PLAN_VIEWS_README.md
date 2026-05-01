Module 11 — 2D Floor Plan Engine

What this provides

- Endpoints to generate and retrieve 2D plan/section/elevation SVGs and a DXF export for a project.
- Background pre-generation that slices GLB models (when available) and stores `viewable/{project_id}/plan.svg` and `viewable/{project_id}/plan.dxf`.

Key files

- `backend/app/plan_generator.py` — main generation helpers (GLB slicing via `trimesh` when available, shapely for polygons, svgwrite for SVG output, ezdxf for DXF export).
- `backend/app/tasks.py` — calls `generate_and_store_views_for_project()` after viewer conversion to precompute 2D outputs.
- `backend/app/api/projects.py` — added endpoints:
  - `GET /api/projects/{project_id}/plan-view.svg`
  - `GET /api/projects/{project_id}/section-view.svg?cut_plane_origin=0,0,0&cut_plane_direction=0,0,1`
  - `GET /api/projects/{project_id}/elevation-view.svg?elevation_direction=1,0,0`
  - `GET /api/projects/{project_id}/plan-view.dxf`

Requirements

- Added to `backend/requirements.txt`: `trimesh`, `shapely`, `svgwrite` (in addition to `python-occ`, `ezdxf`, `pycairo`).

Quick setup (local development)

1. Create a virtual environment and install backend deps:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Start the backend (example):

```bash
cd backend
uvicorn app.main:app --reload
```

3. Upload a project via the existing `POST /api/projects/` endpoint (form `file` + `name`). After processing completes the 2D views will be available at:

- `GET /api/projects/<project_id>/plan-view.svg`
- `GET /api/projects/<project_id>/plan-view.dxf`

Notes & limitations

- IFC -> OCCT conversion is not fully implemented here; if you rely on IFC geometry conversion you should install `ifcopenshell` and configure `IfcConvert` or IfcGeomServer for robust IFC geometry extraction.
- GLB slicing works when `trimesh` is installed and the uploaded model contains valid geometry.
- Hatch patterns and dimensions are implemented as simple visual helpers and may need enhancement for production CAD-quality output.

Next steps

- Improve IFC geometry conversion path using IfcGeomServer or IfcOpenShell geometry utilities.
- Add unit tests and end-to-end tests for generation pipeline.
- Add background queue / Celery tasks for heavy model processing.
