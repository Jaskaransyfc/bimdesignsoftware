# backend/app/tasks.py

import os
import json
import shutil
import tempfile
import traceback
import subprocess

import ifcopenshell
import ifcopenshell.validate
from .plan_generator import generate_and_store_views_for_project

from .database import SessionLocalSync
from .models import Project, ProjectStatus, Element, BOQItem
from .storage import get_file_content, upload_file

ALLOWED_EXTENSIONS = {"ifc", "rvt", "glb", "gltf", "obj", "fbx", "dae", "stp", "step", "xyz", "e57", "blend"}


def process_upload(project_id: str, extension: str):
    print(f"DEBUG: [Project {project_id}] Starting Module 3 processing... (extension: {extension})")
    db = SessionLocalSync()
    project = None
    tmp_dir = None

    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"ERROR: [Project {project_id}] Not found.")
            return

        project.status = ProjectStatus.PROCESSING
        db.commit()

        raw_data = get_file_content(project.original_file)
        tmp_dir = tempfile.mkdtemp()
        input_path = os.path.join(tmp_dir, f"input.{extension}")
        with open(input_path, "wb") as f:
            f.write(raw_data)

        # ── IFC processing ─────────────────────────────
        if extension == "ifc":
            # 1. Validation
            validation = validate_ifc_file(input_path)
            if not validation.get("valid") and not os.environ.get("SKIP_IFC_VALIDATION"):
                project.status = ProjectStatus.ERROR
                project.error_message = json.dumps(validation)
                db.commit()
                print(f"ERROR: IFC validation failed for {project_id}")
                return

            # 2. Extract elements & BOQ
            model = ifcopenshell.open(input_path)
            extract_elements_and_boq(db, project_id, model)
            
            # 3. Extract Hierarchy (Module 3 version)
            project.hierarchy = extract_hierarchy_dict(model)

            # 4. Conversion (Unified to GLB for browser-ready view)
            output_glb = os.path.join(tmp_dir, "model.glb")
            run_ifc_convert(input_path, output_glb)

            viewer_key = f"glb/{project_id}/model.glb"
            with open(output_glb, "rb") as f:
                upload_file(viewer_key, f.read())
            
            project.viewer_file = viewer_key
            project.xkt_file = viewer_key # Keep for compatibility
            # Generate 2D views (SVG/DXF) in background
            try:
                generate_and_store_views_for_project(project_id, preferred_object=viewer_key)
            except Exception:
                pass

        # ── RVT upload (store + fallback 2D placeholders) ─────────────
        elif extension == "rvt":
            # Revit RVT is proprietary and not directly processable with the
            # open-source toolchain in this workspace. Keep the upload, store
            # a minimal hierarchy, and generate placeholder 2D outputs so the
            # project remains usable in Module 11.
            project.hierarchy = {
                "id": "root",
                "name": project.name,
                "type": "Project",
                "children": []
            }
            project.viewer_file = None
            project.xkt_file = None
            try:
                generate_and_store_views_for_project(project_id)
            except Exception:
                pass

        # ── GLB / GLTF (ready to view) ─────────────────
        elif extension in ("glb", "gltf"):
            viewer_key = f"viewable/{project_id}/original.{extension}"
            upload_file(viewer_key, raw_data)
            project.viewer_file = viewer_key
            project.xkt_file = viewer_key  # Fix: Ensure xkt_file is set for viewer compatibility
            
            # Simple hierarchy for non-IFC
            project.hierarchy = {
                "id": "root",
                "name": project.name,
                "type": "Project",
                "children": []
            }
            try:
                generate_and_store_views_for_project(project_id, preferred_object=viewer_key)
            except Exception:
                pass

        # ── All other formats (OBJ, STL, FBX, DXF, BLEND, etc.) ─────
        else:
            output_glb = os.path.join(tmp_dir, "converted.glb")
            try:
                # Special handling for .blend if needed, else assimp
                if extension == "blend" and _is_blender_available():
                    _convert_blend_with_blender(input_path, output_glb)
                else:
                    convert_to_glb(input_path, output_glb, extension)
                
                viewer_key = f"glb/{project_id}/converted.glb"
                with open(output_glb, "rb") as f:
                    upload_file(viewer_key, f.read())
                project.viewer_file = viewer_key
                project.xkt_file = viewer_key  # Fix: Ensure xkt_file is set for viewer compatibility
                
                project.hierarchy = {
                    "id": "root",
                    "name": project.name,
                    "type": "Project",
                    "children": []
                }
                try:
                    generate_and_store_views_for_project(project_id, preferred_object=viewer_key)
                except Exception:
                    pass
            except Exception as e:
                raise Exception(f"Conversion failed for {extension}: {str(e)}")

        project.status = ProjectStatus.READY
        db.commit()
        print(f"INFO: [Project {project_id}] Module 3 processing complete.")

    except Exception as e:
        print(f"CRITICAL ERROR: [Project {project_id}] {e}")
        traceback.print_exc()
        if project:
            db.rollback()
            project.status = ProjectStatus.ERROR
            project.error_message = f"{type(e).__name__}: {str(e)}"
            db.commit()
    finally:
        db.close()
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)

def extract_hierarchy_dict(model) -> dict:
    """Build a Revit‑like spatial tree: Project → Site → Building → Storey → typed elements."""
    projects = model.by_type("IfcProject")
    if not projects:
        return {"id": "root", "name": "No Project", "type": "Project", "children": []}

    project = projects[0]
    tree = {
        "id": project.GlobalId,
        "name": project.Name or "Project",
        "type": "IfcProject",
        "children": []
    }

    # 1. Collect sites aggregated by the project
    sites = _get_related_objects(project, "IsDecomposedBy")
    if not sites:
        # If no site, put buildings directly under project
        buildings = _get_buildings(model)
        for building in buildings:
            tree["children"].append(build_building_node(building))
    else:
        for site in sites:
            if site.is_a("IfcSite"):
                site_node = {
                    "id": site.GlobalId,
                    "name": site.Name or "Site",
                    "type": "IfcSite",
                    "children": []
                }
                # Get buildings under this site
                buildings = _get_related_objects(site, "IsDecomposedBy")
                for building in buildings:
                    site_node["children"].append(build_building_node(building))
                # Also look for buildings directly in model if not under site
                for building in _get_buildings(model):
                    if building not in buildings:
                        site_node["children"].append(build_building_node(building))
                tree["children"].append(site_node)

    return tree


def _get_related_objects(obj, attribute):
    """Helper: return related objects via IfcRelAggregates."""
    related = []
    for rel in getattr(obj, attribute, []):
        if rel.is_a("IfcRelAggregates"):
            related.extend(rel.RelatedObjects)
    return related


def _get_buildings(model):
    """Return all IfcBuilding entities in the model."""
    return model.by_type("IfcBuilding") or []


def build_building_node(building):
    """Create a building node with storeys and typed elements."""
    node = {
        "id": building.GlobalId,
        "name": building.Name or "Building",
        "type": "IfcBuilding",
        "children": []
    }

    # Find storeys related to this building
    storeys = []
    for rel in getattr(building, "IsDecomposedBy", []):
        if rel.is_a("IfcRelAggregates"):
            for obj in rel.RelatedObjects:
                if obj.is_a("IfcBuildingStorey"):
                    storeys.append(obj)

    # If no storeys found, still include elements grouped by type directly
    if not storeys:
        elements = _get_contained_elements(building)
        type_groups = _group_by_type(elements)
        for group_name, elems in type_groups.items():
            node["children"].append({
                "id": f"group-{building.GlobalId}-{group_name}",
                "name": group_name,
                "type": "IfcGroup",
                "children": [make_element_leaf(e) for e in elems]
            })
    else:
        for storey in storeys:
            storey_node = {
                "id": storey.GlobalId,
                "name": storey.Name or f"Level {storey.Elevation}" if hasattr(storey, "Elevation") else "Level",
                "type": "IfcBuildingStorey",
                "children": []
            }
            # Get contained elements (walls,etc.) via IfcRelContainedInSpatialStructure
            elements = _get_contained_elements(storey)
            type_groups = _group_by_type(elements)
            for group_name, elems in type_groups.items():
                storey_node["children"].append({
                    "id": f"group-{storey.GlobalId}-{group_name}",
                    "name": group_name,
                    "type": "IfcGroup",
                    "children": [make_element_leaf(e) for e in elems]
                })
            node["children"].append(storey_node)

    return node


def _get_contained_elements(spatial_element):
    """Get all IfcElements directly contained in a spatial structure (storey/building)."""
    contained = []
    for rel in getattr(spatial_element, "ContainsElements", []):
        if rel.is_a("IfcRelContainedInSpatialStructure"):
            contained.extend(rel.RelatedElements)
    return contained


def _group_by_type(elements):
    """Group elements by a friendly category name."""
    groups = {}
    type_map = {
        "IfcWall": "Walls",
        "IfcWallStandardCase": "Walls",
        "IfcSlab": "Slabs",
        "IfcBeam": "Beams",
        "IfcColumn": "Columns",
        "IfcDoor": "Doors",
        "IfcWindow": "Windows",
        "IfcStair": "Stairs",
        "IfcRailing": "Railings",
        "IfcMember": "Framing",
        "IfcPlate": "Plates",
        "IfcRoof": "Roofs",
        "IfcBuildingElementProxy": "Misc"
    }
    for elem in elements:
        type_name = elem.is_a()
        friendly = type_map.get(type_name, type_name.replace("Ifc", ""))
        groups.setdefault(friendly, []).append(elem)
    return groups


def make_element_leaf(element):
    """Convert an IFC element into a leaf node for the tree."""
    return {
        "id": element.GlobalId,
        "name": element.Name or "Unnamed",
        "type": element.is_a(),
        "children": []
    }

def recursive_decompose(obj):
    node = {
        "id": obj.GlobalId,
        "name": getattr(obj, "Name", None) or obj.is_a(),
        "type": obj.is_a(),
        "children": []
    }
    
    # Aggregates (Project -> Site -> Building -> Storey)
    if hasattr(obj, "IsDecomposedBy"):
        for rel in obj.IsDecomposedBy:
            if rel.is_a("IfcRelAggregates"):
                for child in rel.RelatedObjects:
                    node["children"].append(recursive_decompose(child))
                    
    # Contained elements (Storey -> Elements)
    if hasattr(obj, "ContainsElements"):
        for rel in obj.ContainsElements:
            for elem in rel.RelatedElements:
                node["children"].append({
                    "id": elem.GlobalId,
                    "name": getattr(elem, "Name", None) or elem.is_a(),
                    "type": elem.is_a(),
                    "children": []
                })
    return node


# ──────────────── Conversion Helpers ────────────────

def validate_ifc_file(file_path: str) -> dict:
    import logging
    try:
        model = ifcopenshell.open(file_path)
        if not model.by_type("IfcProject"):
            return {"valid": False, "error": "No IfcProject found"}
        
        # Check for at least one element to ensure it's not a dummy file
        if not model.by_type("IfcElement") and not model.by_type("IfcProduct"):
             return {"valid": False, "error": "Model contains no 3D elements"}

        # Quick schema validation
        logger = logging.getLogger("ifc_validate")
        issues = ifcopenshell.validate.validate(file_path, logger)
        if issues is None:
            issues = []
        return {"valid": len(issues) < 50, "issues": [str(i) for i in issues[:20]]} # Allow some minor issues
    except Exception as e:
        return {"valid": False, "error": str(e)}


def run_ifc_convert(input_ifc: str, output_glb: str):
    """Uses IfcConvert to create a browser-ready GLB with GUIDs preserved."""
    subprocess.run([
        "IfcConvert", input_ifc, output_glb, 
        "--use-element-guids", 
        "--separate-z-up-node"
    ], check=True, capture_output=True, text=True, timeout=600)


def convert_to_glb(input_path: str, output_path: str, original_ext: str):
    """Universal fallback using assimp."""
    subprocess.run(
        ["assimp", "export", input_path, output_path, "--format", "glb2"],
        check=True, timeout=300
    )


def _is_blender_available() -> bool:
    try:
        subprocess.run(["blender", "--version"], capture_output=True, check=True, timeout=10)
        return True
    except:
        return False


def _convert_blend_with_blender(input_blend: str, output_glb: str):
    script = f"import bpy; bpy.ops.wm.open_mainfile(filepath='{input_blend}'); bpy.ops.export_scene.gltf(filepath='{output_glb}', export_format='GLB')"
    subprocess.run(["blender", "--background", "--python-expr", script], check=True, timeout=300)


def extract_elements_and_boq(db, project_id, model):
    """Extracts all IfcElements and their PSet properties."""
    # Delete previous if reprocessing
    db.query(Element).filter(Element.project_id == project_id).delete()
    db.query(BOQItem).filter(BOQItem.project_id == project_id).delete()
    
    elements = model.by_type("IfcElement")
    for el in elements:
        try:
            props = {}
            for rel in getattr(el, "IsDefinedBy", []):
                if rel.is_a("IfcRelDefinesByProperties"):
                    pset = rel.RelatingPropertyDefinition
                    if pset.is_a("IfcPropertySet"):
                        for prop in getattr(pset, "HasProperties", []):
                            if prop.is_a("IfcPropertySingleValue"):
                                val = prop.NominalValue.wrappedValue if prop.NominalValue else None
                                props[str(prop.Name)] = str(val) if val is not None else ""
            
            db.add(Element(
                project_id=project_id, 
                global_id=el.GlobalId, 
                ifc_type=el.is_a(), 
                name=el.Name or "Unnamed", 
                properties=props
            ))
        except: continue

    # BOQ Extraction (Quantities)
    for el in elements:
        try:
            for qto_def in getattr(el, "IsDefinedBy", []):
                if qto_def.is_a("IfcRelDefinesByProperties"):
                    qto = qto_def.RelatingPropertyDefinition
                    if qto.is_a("IfcElementQuantity"):
                        for qty in qto.Quantities:
                            val = None
                            unit = ""
                            if qty.is_a("IfcQuantityLength"): val = qty.LengthValue; unit = "m"
                            elif qty.is_a("IfcQuantityArea"): val = qty.AreaValue; unit = "m²"
                            elif qty.is_a("IfcQuantityVolume"): val = qty.VolumeValue; unit = "m³"
                            elif qty.is_a("IfcQuantityCount"): val = qty.CountValue; unit = "pcs"
                            
                            if val is not None:
                                db.add(BOQItem(
                                    project_id=project_id, 
                                    ifc_type=el.is_a(), 
                                    element_name=el.Name, 
                                    quantity_name=qty.Name, 
                                    quantity_value=float(val), 
                                    unit=unit
                                ))
        except: continue
    db.commit()