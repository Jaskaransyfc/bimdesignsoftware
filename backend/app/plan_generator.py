"""Plan view / section / elevation generator.

This module attempts to use python-occ (Open CASCADE) and ifcopenshell
when available. All heavy operations fall back to simple placeholder SVG
rendering when optional dependencies are not installed, to keep the
application robust in development environments.
"""
from __future__ import annotations

import io
import math
import os
import tempfile

_HAS_OCCT = False
_HAS_IFCOPENSHELL = False
_HAS_CAIRO = False
_HAS_EZDXF = False

try:
    import ezdxf
    _HAS_EZDXF = True
except Exception:
    ezdxf = None

if "ezdxf" not in globals() or ezdxf is None:
    try:
        import ezdxf as _ezdxf
        ezdxf = _ezdxf
        _HAS_EZDXF = True
    except Exception:
        ezdxf = None

try:
    import cairo
    _HAS_CAIRO = True

    # pythonOCC / OCCT imports
    try:
        import OCC.Core.BRepAlgoAPI as BRepAlgoAPI
        import OCC.Core.BRepBuilderAPI as BRepBuilderAPI
        import OCC.Core.TopAbs as TopAbs
        from OCC.Core import TopoDS, Geom, GeomAPI, gp
        import OCC.Core.BRepPrimAPI as BRepPrimAPI
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.TopoDS import topods
        from OCC.Core.BRepBuilderAPI import BRepBuilderAPI_MakeFace
        _HAS_OCCT = True
    except Exception:
        _HAS_OCCT = False

    # ifcopenshell (for reading IFC files)
    try:
        import ifcopenshell
        _HAS_IFCOPENSHELL = True
    except Exception:
        _HAS_IFCOPENSHELL = False
except Exception:
    # If even basic modules fail to import, ensure flags are False
    _HAS_OCCT = False
    _HAS_IFCOPENSHELL = False
    _HAS_CAIRO = False

from .storage import get_file_content
from .storage import upload_file
from .config import LOCAL_STORAGE_PATH, STORAGE_MODE

# Optional libs for mesh slicing and polygon ops
try:
    import trimesh
    import numpy as np
    from shapely.geometry import Polygon, LineString
    from shapely.ops import unary_union
    import svgwrite
    _HAS_TRIMESH = True
except Exception:
    _HAS_TRIMESH = False

def load_ifc_model(project_id: str):
    """Load IFC model bytes from storage and write to a temporary file.

    Returns an ifcopenshell model or None if not available.
    """
    if not _HAS_IFCOPENSHELL:
        return None

    try:
        data = get_file_content(f"raw/{project_id}/project.ifc")
    except Exception:
        # Try generic raw file name pattern if exact file not found
        try:
            data = get_file_content(f"raw/{project_id}")
        except Exception as e:
            print(f"Error reading IFC bytes for project {project_id}: {e}")
            return None

    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".ifc")
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(data)
        model = ifcopenshell.open(tmp_path)
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return model
    except Exception as e:
        print(f"Error loading IFC model for project {project_id}: {e}")
        return None


def _svg_document(width: int, height: int, elements: list[str]) -> bytes:
    body = "\n".join(elements)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">{body}</svg>'
    ).encode("utf-8")


def _placeholder_svg(width: int, height: int, title: str, elements: list[str] | None = None) -> bytes:
    parts = [
        f'<rect width="{width}" height="{height}" fill="#ffffff" />',
        f'<text x="24" y="36" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">{title}</text>',
    ]
    if elements:
        parts.extend(elements)
    else:
        parts.append(
            f'<rect x="80" y="80" width="{width - 160}" height="{height - 160}" fill="none" stroke="#111827" stroke-width="2" />'
        )
    return _svg_document(width, height, parts)


def _edge_svg_lines(edges_2d: list[tuple[float, float, float, float]], width: int, height: int) -> list[str]:
    lines: list[str] = []
    for x1, y1, x2, y2 in edges_2d:
        lines.append(
            f'<line x1="{x1 + width/2:.2f}" y1="{height/2 - y1:.2f}" x2="{x2 + width/2:.2f}" y2="{height/2 - y2:.2f}" stroke="#111827" stroke-width="2" />'
        )
    return lines

def _get_brep_from_ifc_model(model):
    # This is a highly simplified placeholder. In a real scenario, you'd convert
    # IFC entities to OpenCASCADE shapes.
    # For demonstration, let's create a simple box.
    if not _HAS_OCCT:
        return None
    try:
        builder = BRepPrimAPI.BRepPrimAPI_MakeBox(gp.gp_Pnt(-5, -5, -5), 10, 10, 10)
        return builder.Shape()
    except Exception:
        return None

def _perform_section_cut(brep_shape, origin: gp.gp_Pnt, direction: gp.gp_Dir):
    if not _HAS_OCCT or brep_shape is None:
        return None

    try:
        plane = gp.gp_Pln(origin, direction)
        face = BRepBuilderAPI_MakeFace(plane).Face()
        section = BRepAlgoAPI.BRepAlgoAPI_Section(brep_shape, face)
        section.Build()
        if section.IsDone():
            return section.Shape()
    except Exception:
        pass
    return None

def _extract_2d_edges_from_section(section_shape):
    """Extract 2D line segments from a section shape.

    Returns a list of (x1, y1, x2, y2). If OCCT is not available or extraction
    fails, returns an empty list.
    """
    if not _HAS_OCCT or section_shape is None:
        return []

    edges = []
    try:
        explorer = TopExp_Explorer(section_shape, TopAbs_EDGE)
        while explorer.More():
            edge = topods.Edge(explorer.Current())
            curve_data = BRep_Tool.Curve(edge)
            if not curve_data:
                explorer.Next()
                continue
            # curve_data is a tuple-like (curve_handle, first, last)
            curve = curve_data[0]
            first = curve_data[1]
            last = curve_data[2]
            try:
                p_start = gp.gp_Pnt()
                p_end = gp.gp_Pnt()
                curve.D0(first, p_start)
                curve.D0(last, p_end)
                edges.append((p_start.X(), p_start.Y(), p_end.X(), p_end.Y()))
            except Exception:
                pass
            explorer.Next()
    except Exception:
        return []
    return edges

def generate_plan_view_svg(model_data: bytes, project_id: str) -> bytes:
    """
    Generates an SVG plan view from 3D model data.
    """
    model = load_ifc_model(project_id)
    if not model:
        return _placeholder_svg(800, 600, "Plan view unavailable")

    if not _HAS_OCCT:
        return _placeholder_svg(800, 600, "Plan view unavailable")

    # Convert IFC to a BREP shape (simplified)
    brep_shape = _get_brep_from_ifc_model(model)

    # Define the cutting plane for a plan view (e.g., cut at Z=0.0, looking down)
    origin = gp.gp_Pnt(0, 0, 0) # Adjust based on model bounding box
    direction = gp.gp_Dir(0, 0, 1) # Normal to the cutting plane (Z-axis for plan view)

    edges_2d = []
    try:
        section_shape = _perform_section_cut(brep_shape, origin, direction)
        edges_2d = _extract_2d_edges_from_section(section_shape)
    except Exception:
        edges_2d = []

    width, height = 800, 600
    if not _HAS_CAIRO or cairo is None:
        elements = [
            f'<rect width="{width}" height="{height}" fill="#ffffff" />',
            '<text x="24" y="36" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">Plan View</text>',
        ]
        elements.extend(_edge_svg_lines(edges_2d, width, height) or [
            '<rect x="100" y="100" width="600" height="400" fill="none" stroke="#111827" stroke-width="2" />'
        ])
        return _svg_document(width, height, elements)

    surface = cairo.SVGSurface(io.BytesIO(), width, height)
    ctx = cairo.Context(surface)

    ctx.set_source_rgb(1, 1, 1)  # White background
    ctx.paint()

    ctx.set_source_rgb(0, 0, 0)  # Black lines
    ctx.set_line_width(2)

    # Draw the extracted 2D edges
    for x1, y1, x2, y2 in edges_2d:
        ctx.move_to(x1 + width/2, y1 + height/2)
        ctx.line_to(x2 + width/2, y2 + height/2)
        ctx.stroke()

    surface.flush()
    buffer = surface.get_memory_buffer()
    return bytes(buffer)

def generate_section_view_svg(model_data: bytes, project_id: str, cut_plane_origin: tuple, cut_plane_direction: tuple) -> bytes:
    """
    Generates an SVG section view from 3D model data.
    """
    glb_bytes = _load_project_glb_bytes(project_id)
    if glb_bytes:
        normal = [float(cut_plane_direction[0]), float(cut_plane_direction[1]), float(cut_plane_direction[2])]
        if not any(normal):
            normal = [1.0, 0.0, 0.0]
        origin = [float(cut_plane_origin[0]), float(cut_plane_origin[1]), float(cut_plane_origin[2])]
        svg_bytes, _ = _generate_svg_from_glb_bytes(
            glb_bytes,
            title="Section view",
            plane_origin=origin,
            plane_normal=normal,
        )
        return svg_bytes

    # Placeholder fallback
    width, height = 800, 600
    if not _HAS_CAIRO or cairo is None:
        return _placeholder_svg(
            width,
            height,
            "Section view",
            [
                '<rect x="150" y="150" width="500" height="300" fill="none" stroke="#111827" stroke-width="2" />',
                '<line x1="150" y1="150" x2="650" y2="450" stroke="#2563eb" stroke-width="2" />',
            ],
        )

    surface = cairo.SVGSurface(io.BytesIO(), width, height)
    ctx = cairo.Context(surface)

    ctx.set_source_rgb(1, 1, 1)
    ctx.paint()

    ctx.set_source_rgb(0, 0, 0)
    ctx.set_line_width(2)

    ctx.rectangle(150, 150, 500, 300)
    ctx.stroke()

    surface.flush()
    buffer = surface.get_memory_buffer()
    return bytes(buffer)


def _find_first_raw_file(project_id: str) -> str | None:
    """Return the storage object name for the first file in raw/{project_id}/ or None."""
    # If local storage, list files from LOCAL_STORAGE_PATH/raw/{project_id}
    if STORAGE_MODE == "local":
        folder = LOCAL_STORAGE_PATH / f"raw/{project_id}"
        if folder.exists() and folder.is_dir():
            for p in folder.iterdir():
                if p.is_file():
                    # return storage object name relative to storage root
                    rel = f"raw/{project_id}/{p.name}"
                    return rel
        return None
    else:
        # For MinIO, try common names (project.ifc, model.glb)
        for candidate in (f"raw/{project_id}/project.ifc", f"raw/{project_id}/model.glb"):
            try:
                _ = get_file_content(candidate)
                return candidate
            except Exception:
                continue
        return None


def _first_existing_object(candidates: list[str]) -> str | None:
    for obj in candidates:
        if not obj:
            continue
        try:
            _ = get_file_content(obj)
            return obj
        except Exception:
            continue
    return None


def _project_model_candidates(project_id: str, preferred_object: str | None = None) -> list[str]:
    return [
        preferred_object or "",
        f"glb/{project_id}/model.glb",
        f"glb/{project_id}/converted.glb",
        f"viewable/{project_id}/original.glb",
        f"viewable/{project_id}/original.gltf",
        _find_first_raw_file(project_id) or "",
    ]


def _load_project_glb_bytes(project_id: str, preferred_object: str | None = None) -> bytes | None:
    obj = _first_existing_object(_project_model_candidates(project_id, preferred_object))
    if not obj:
        return None
    if not (obj.lower().endswith(".glb") or obj.lower().endswith(".gltf")):
        return None
    try:
        return get_file_content(obj)
    except Exception:
        return None


def _mesh_from_glb_bytes(glb_bytes: bytes):
    if not _HAS_TRIMESH:
        return None
    try:
        loaded = trimesh.load(io.BytesIO(glb_bytes), file_type="glb", force="scene")
    except Exception:
        loaded = None
    if loaded is None:
        return None
    try:
        if isinstance(loaded, trimesh.Trimesh):
            return loaded
        if isinstance(loaded, trimesh.Scene):
            meshes = []
            for geom in loaded.geometry.values():
                if isinstance(geom, trimesh.Trimesh) and geom.vertices is not None and len(geom.vertices) > 0:
                    meshes.append(geom)
            if not meshes:
                return None
            return trimesh.util.concatenate(meshes)
    except Exception:
        return None
    return None


def _polygons_from_section(mesh, plane_origin: list[float], plane_normal: list[float]) -> list:
    if mesh is None:
        return []
    try:
        section = mesh.section(plane_origin=plane_origin, plane_normal=plane_normal)
    except Exception:
        section = None
    if section is None:
        return []

    polygons = []
    try:
        planar, _ = section.to_planar()
    except Exception:
        return []

    try:
        polys = list(getattr(planar, "polygons_full", []) or [])
    except Exception:
        polys = []

    if not polys:
        for path in getattr(planar, "paths", []):
            for poly in getattr(path, "polygons_full", []) or []:
                polys.append(poly)

    for poly in polys:
        try:
            shp = Polygon(poly)
        except Exception:
            continue
        if shp.is_valid and not shp.is_empty and shp.area > 1e-6:
            polygons.append(shp)
    return polygons


def _svg_from_polygons(polygons: list, title: str) -> bytes:
    merged = unary_union(polygons)
    if merged.geom_type == 'Polygon':
        polys = [merged]
    else:
        polys = list(merged.geoms) if hasattr(merged, "geoms") else list(merged)

    minx, miny, maxx, maxy = merged.bounds
    span_x = max(maxx - minx, 1.0)
    span_y = max(maxy - miny, 1.0)
    scale = max(30.0, min(140.0, min(1200.0 / span_x, 900.0 / span_y)))
    width = max(800, int(span_x * scale) + 140)
    height = max(600, int(span_y * scale) + 140)
    pad = 70.0

    dwg = svgwrite.Drawing(size=(f"{width}px", f"{height}px"))
    dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill='white'))
    dwg.add(dwg.text(title, insert=(24, 36), fill="#111827", font_size="20px", font_family="Arial, Helvetica, sans-serif"))

    for poly in polys:
        exterior = [((x - minx) * scale + pad, height - ((y - miny) * scale + pad)) for x, y in poly.exterior.coords]
        dwg.add(dwg.polygon(points=exterior, stroke='black', fill='none', stroke_width=1.2))

        bxmin, bymin, bxmax, bymax = poly.bounds
        spacing = max(0.1, (bxmax - bxmin) / 20.0)
        x = bxmin
        while x <= bxmax:
            line = LineString([(x, bymin), (x, bymax)])
            intr = poly.intersection(line)
            if intr.is_empty:
                x += spacing
                continue
            segments = []
            if intr.geom_type == "LineString":
                segments = [intr]
            elif hasattr(intr, "geoms"):
                segments = [g for g in intr.geoms if getattr(g, "geom_type", "") == "LineString"]
            for seg in segments:
                sx1, sy1 = seg.coords[0]
                sx2, sy2 = seg.coords[-1]
                dwg.add(
                    dwg.line(
                        start=((sx1 - minx) * scale + pad, height - ((sy1 - miny) * scale + pad)),
                        end=((sx2 - minx) * scale + pad, height - ((sy2 - miny) * scale + pad)),
                        stroke="#9ca3af",
                        stroke_width=0.5,
                    )
                )
            x += spacing

        dim_text = f"{(bxmax - bxmin):.2f}m"
        dwg.add(
            dwg.text(
                dim_text,
                insert=(width / 2, height - ((bymin - miny) * scale + pad) - 10),
                fill="#dc2626",
                font_size="12px",
                text_anchor="middle",
            )
        )

    return dwg.tostring().encode("utf-8")


def _generate_svg_from_glb_bytes(
    glb_bytes: bytes,
    *,
    title: str,
    plane_origin: list[float] | None = None,
    plane_normal: list[float] | None = None,
) -> tuple[bytes, list]:
    if not _HAS_TRIMESH:
        return _placeholder_svg(800, 600, f"{title} unavailable"), []

    mesh = _mesh_from_glb_bytes(glb_bytes)
    if mesh is None or mesh.vertices is None or len(mesh.vertices) == 0:
        return _placeholder_svg(800, 600, f"{title} unavailable"), []

    vertices = mesh.vertices
    if plane_normal is None:
        plane_normal = [0, 0, 1]
    if plane_origin is None:
        mins = vertices.min(axis=0)
        maxs = vertices.max(axis=0)
        centroid = (mins + maxs) / 2.0
        plane_origin = [float(centroid[0]), float(centroid[1]), float(centroid[2])]

    axis = int(np.argmax(np.abs(np.array(plane_normal))))
    coords = vertices[:, axis]
    candidates = np.quantile(coords, [0.30, 0.40, 0.50, 0.60, 0.70]).tolist()

    polygons = []
    for value in candidates:
        origin = list(plane_origin)
        origin[axis] = float(value)
        polygons = _polygons_from_section(mesh, origin, plane_normal)
        if polygons:
            break

    if not polygons:
        mins = vertices.min(axis=0)
        maxs = vertices.max(axis=0)
        if axis == 2:  # plan XY envelope
            envelope = Polygon([(mins[0], mins[1]), (maxs[0], mins[1]), (maxs[0], maxs[1]), (mins[0], maxs[1])])
        elif axis == 0:  # section/elevation YZ envelope
            envelope = Polygon([(mins[1], mins[2]), (maxs[1], mins[2]), (maxs[1], maxs[2]), (mins[1], maxs[2])])
        else:  # XZ envelope
            envelope = Polygon([(mins[0], mins[2]), (maxs[0], mins[2]), (maxs[0], maxs[2]), (mins[0], maxs[2])])
        polygons = [envelope]

    return _svg_from_polygons(polygons, title), polygons


def _generate_from_glb_bytes(glb_bytes: bytes) -> tuple[bytes, bytes]:
    """Slice GLB bytes to produce SVG and DXF bytes. Returns (svg_bytes, dxf_bytes)."""
    svg_bytes, polygons = _generate_svg_from_glb_bytes(
        glb_bytes,
        title="Plan view",
        plane_normal=[0, 0, 1],
    )

    # create DXF
    try:
        doc = ezdxf.new('R2010')
        msp = doc.modelspace()
        for poly in polygons:
            coords = [ (x, y) for x, y in poly.exterior.coords ]
            msp.add_lwpolyline(coords, close=True)
        text_buf = io.StringIO()
        doc.write(text_buf)
        dxf_bytes = text_buf.getvalue().encode("utf-8")
    except Exception:
        dxf_bytes = b''

    return svg_bytes, dxf_bytes


def generate_and_store_views_for_project(project_id: str, preferred_object: str | None = None):
    """High-level helper used by background task: generate plan SVG and DXF and upload to storage."""
    obj = _first_existing_object(_project_model_candidates(project_id, preferred_object))
    if not obj:
        return False

    try:
        data = get_file_content(obj)
    except Exception:
        return False

    # Decide by extension
    if obj.lower().endswith('.glb') or obj.lower().endswith('.gltf'):
        svg_bytes, dxf_bytes = _generate_from_glb_bytes(data)
    else:
        # Fallback to simple plan generator placeholder
        svg_bytes = generate_plan_view_svg(data, project_id)
        dxf_bytes = generate_dxf_from_svg_data(svg_bytes, project_id)

    if svg_bytes:
        upload_file(f"viewable/{project_id}/plan.svg", svg_bytes)
    if dxf_bytes:
        upload_file(f"viewable/{project_id}/plan.dxf", dxf_bytes)
    return True

def generate_elevation_view_svg(model_data: bytes, project_id: str, elevation_direction: tuple) -> bytes:
    """
    Generates an SVG elevation view from 3D model data.
    """
    glb_bytes = _load_project_glb_bytes(project_id)
    if glb_bytes:
        normal = [float(elevation_direction[0]), float(elevation_direction[1]), float(elevation_direction[2])]
        if not any(normal):
            normal = [1.0, 0.0, 0.0]
        svg_bytes, _ = _generate_svg_from_glb_bytes(
            glb_bytes,
            title="Elevation view",
            plane_normal=normal,
        )
        return svg_bytes

    # Placeholder fallback
    width, height = 800, 600
    if not _HAS_CAIRO or cairo is None:
        return _placeholder_svg(
            width,
            height,
            "Elevation view",
            [
                '<rect x="200" y="50" width="400" height="500" fill="none" stroke="#111827" stroke-width="2" />',
                '<line x1="200" y1="300" x2="600" y2="300" stroke="#2563eb" stroke-width="2" />',
            ],
        )

    surface = cairo.SVGSurface(io.BytesIO(), width, height)
    ctx = cairo.Context(surface)

    ctx.set_source_rgb(1, 1, 1)
    ctx.paint()

    ctx.set_source_rgb(0, 0, 0)
    ctx.set_line_width(2)

    ctx.rectangle(200, 50, 400, 500)
    ctx.stroke()

    surface.flush()
    buffer = surface.get_memory_buffer()
    return bytes(buffer)

def generate_dxf_from_svg_data(svg_data: bytes, project_id: str) -> bytes:
    """
    Converts SVG data to DXF. This is a placeholder and will need a proper SVG parsing library
    and mapping to DXF entities.
    """
    if _HAS_EZDXF and ezdxf is not None:
        doc = ezdxf.new('R2010')  # create a new DXF drawing (AC1024)
        msp = doc.modelspace()

        # Placeholder: In a real scenario, you would parse the SVG data
        # and add corresponding DXF entities.
        msp.add_line((0, 0), (10, 10))
        msp.add_circle((5, 5), 2)

        buffer = io.BytesIO()
        doc.write(buffer)
        return buffer.getvalue()

    # Fallback minimal DXF content when ezdxf is unavailable.
    return (
        "0\nSECTION\n2\nENTITIES\n"
        "0\nLINE\n8\n0\n10\n0\n20\n0\n11\n10\n21\n10\n"
        "0\nCIRCLE\n8\n0\n10\n5\n20\n5\n40\n2\n"
        "0\nENDSEC\n0\nEOF\n"
    ).encode("ascii")
