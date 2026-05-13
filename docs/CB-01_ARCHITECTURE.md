# CB-01 BIM Data Foundation + Object Metadata Infrastructure

## Architecture Impact Report

### Current System

The platform has two active BIM object paths:

1. `model_elements` in the backend are persisted parametric 3D objects. They flow through `modeling.py` into `geometry_kernel.py`, then render in the viewer.
2. The 2D editor stores drawing elements as JSON on `Project.drawing`. These elements drive `CADEditor.tsx`, `Model3DPreview.tsx`, schedules, BOQ, and drawing exports.

Before CB-01, both paths stored metadata locally:

- Geometry parameters such as `height`, `thickness`, `width`, `offset`, and `host_wall_id` lived in unstructured parameter dictionaries.
- 2D editor element metadata lived under local `metadata` keys such as `door_style`, `window_model_url`, `stair_style`, and electrical circuit metadata.
- Categories were inferred from element type in each frontend/backend workflow.
- Units were mixed by context: 2D drawing fields are mostly mm, backend modeling/kernel values are meters, and display formatting was duplicated.
- Family definitions existed, but type parameters, instance defaults, shared parameters, IFC mapping, and validation were not centralized.

### Gaps Closed By CB-01

- Adds a centralized BIM object envelope for every persisted `ModelElement`.
- Adds category, type definition, family definition, metadata, relationships, transform, visibility, and classification columns.
- Adds project unit settings and a canonical unit conversion service.
- Adds shared parameter definitions and category-aware defaults.
- Adds type/instance/shared parameter separation while preserving the legacy flat `parameters` cache used by the geometry kernel.
- Adds validation rules and diagnostic infrastructure.
- Adds frontend metadata stamping for 2D elements so drawing JSON participates in the same CB-01 object model.

### Data Flow

```text
Frontend editor / viewer
  |
  |  2D drawing elements get CB-01 metadata via frontend/src/lib/bimData.ts
  v
Project.drawing JSON
  |
  |  Save/load keeps legacy geometry fields plus metadata.cb01 + parameters._cb01
  v
Schedules / BOQ / Model3DPreview

Blank modeling API
  |
  |  POST/PUT /api/modeling/projects/{project_id}/elements
  v
ElementRegistryService
  |
  |  category + type/instance/shared parameters + metadata + relationships
  v
GeometryKernelService
  |
  |  canonical meters remain the kernel contract
  v
ModelElement persistence
  |
  |  /api/bim/projects/{project_id}/foundation + validation + parameter APIs
  v
Future IFC, MEP, schedules, BOQ, AI automation, clash detection
```

## Metadata Strategy

- Source of truth for persisted 3D BIM objects is now `ModelElement` plus CB-01 registry services.
- Source of truth for 2D drawing objects remains drawing JSON, but each object is stamped with `metadata.cb01` and `parameters._cb01`.
- Geometry is kept separate from metadata. The geometry kernel still receives resolved canonical parameters and geometry only.
- Type, instance, and shared parameter scopes are stored inside the CB-01 envelope:
  - `type_parameters`: family/type-level values such as thickness, material, fire rating, default dimensions.
  - `instance_parameters`: placement, host, level, visibility, offsets, and object-specific values.
  - `shared_parameters`: schedule/export values such as phase, cost code, manufacturer, asset code, and system type.
- A flat parameter cache is intentionally preserved for backward compatibility with existing rendering/kernel code.

## Implementation Plan

1. Backend foundation services and tables.
2. Modeling API normalization on create/update/family instantiate.
3. Frontend schema utility layer and 2D metadata stamping.
4. Dynamic CB-01 property panel, diagnostics, unit display, and category filtering.
5. Tests for units, parameters, categories, object normalization, and validation.
6. Future migrations to make type definitions the primary source of type parameters across all 2D and 3D objects.

## Usage

### Get CB-01 Foundation

```http
GET /api/bim/projects/{project_id}/foundation
```

Returns categories, shared parameters, project unit settings, supported units, validation rules, type definitions, and the BIM object model contract.

### Validate A Project

```http
POST /api/bim/projects/{project_id}/validate
```

With no body, validates persisted `model_elements`. With `{ "elements": [...] }`, validates supplied element payloads.

### Update A Parameter

```http
PUT /api/bim/projects/{project_id}/elements/{element_id}/parameters
```

Example:

```json
{
  "scope": "type",
  "key": "thickness",
  "value": 0.23,
  "propagate": true
}
```

Use `scope: "instance"` for placement/level/offset values and `scope: "shared"` for schedule/export metadata.

### Frontend Utilities

Use `frontend/src/lib/bimData.ts`:

- `withBimMetadata(element)` stamps a 2D editor object with CB-01 metadata.
- `getBimParameterEnvelope(element)` reads type/instance/shared parameters.
- `validateBimElements(elements)` produces local diagnostics for drawing JSON.
- `formatBimDisplayValue(value, key, unit)` formats canonical meter values for display.

