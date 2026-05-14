# CB-05 Room + Area Boundary Intelligence Engine

## Architecture Impact Report

CB-05 introduces a backend-owned spatial intelligence layer. Existing room support in the editor was a rectangular UI drawing tool with local area math. The new architecture moves detection, boundary extraction, area schemes, volume calculation, and QA into FastAPI services so future HVAC, occupancy, fire, BOQ, IFC, and AI planning systems consume the same canonical space data.

### Existing Touchpoints

- `backend/app/geometry_kernel.py` normalizes wall/opening geometry and keeps hosted openings attached to walls.
- `backend/app/models.py` already has `ModelElementType.ROOM`, level-aware `ModelElement`, `Project.drawing`, and unit settings.
- `backend/app/services/unit_engine.py` stores canonical length, area, and volume units.
- `backend/app/services/validation_engine.py` provides reusable validation issue patterns.
- `backend/app/api/projects.py` persists 2D editor elements in `Project.drawing`.
- `frontend/src/components/CADEditor.tsx` owns level-aware 2D editing, snapping, wall/opening placement, manual room display, and save/load callbacks.
- `frontend/src/components/Model3DPreview.tsx` renders wall, opening, floor, roof, furniture, and MEP-like objects from editor elements.
- `frontend/src/types/modeling.ts` already defines `Room`, `Level`, and BIM object metadata fields.

### Room-Detectable Geometry

- Primary boundaries: walls from saved drawing elements or `ModelElement` wall geometry.
- Secondary boundaries: room separators, area boundaries, polyline/line separators, and future modeled boundary lines.
- Hosted openings: doors/windows/openings remain hosted references and do not break wall boundaries for room closure.
- Levels: rooms are detected per level using the level id on each source boundary.
- Columns/slabs/ceilings: recorded as context for validation and future deductions; wall and separator loops remain the first closure source.

### Spatial Intelligence Flow

1. Extract level-scoped boundary segments from drawing JSON and model elements.
2. Normalize all 2D coordinates to internal meters.
3. Node and polygonize segment networks into enclosed faces.
4. Resolve source boundary references and adjacency between spaces.
5. Apply selected area scheme boundary rules.
6. Calculate gross, usable, carpet, built-up, scheme-specific area, perimeter, centroid, and volume.
7. Emit stable generated room objects plus diagnostics.
8. Frontend merges generated rooms into the editor model and saves them with CB-05 metadata.

### Room Detection Pipeline

- Boundary extraction: `room_boundary_service.py`
- Closed-loop detection: `enclosed_polygon_service.py`
- Area schemes and offsets: `area_scheme_service.py`
- Area calculation: `area_calculation_service.py`
- Volume calculation: `room_volume_service.py`
- Validation: `room_validation_service.py`
- Orchestration: `room_detection_engine.py`
- API: `api/rooms.py`

### Dynamic Update Strategy

The frontend sends non-generated source geometry to `/api/projects/{project_id}/rooms/recalculate` after level or geometry edits. Returned generated rooms replace older CB-05 generated rooms, so moving a wall, adding a separator, or changing height creates fresh area, volume, adjacency, and validation results without duplicating polygon logic in the UI.

### Phased Implementation

- Phase 1: Detect enclosed rooms from wall/separator loops per level.
- Phase 2: Return boundary loops, source references, adjacency, and issue metadata.
- Phase 3: Calculate BIM-style gross/net/carpet/built-up and scheme areas in canonical square meters.
- Phase 4: Calculate room volumes from boundary polygon and level/wall height context.
- Phase 5: Provide default area schemes and configurable boundary-rule primitives.
- Phase 6: Add frontend dynamic recalculation and generated-room merge workflow.
- Phase 7: Surface QA warnings and highlight invalid/generated spaces.

