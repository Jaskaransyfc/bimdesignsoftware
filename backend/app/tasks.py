# backend/app/tasks.py

import os
import json
import shutil
import tempfile
import traceback
import subprocess

import ifcopenshell
import ifcopenshell.validate

from .database import SessionLocalSync
from .models import Project, ProjectStatus, Element, BOQItem
from .storage import get_file_content, upload_file

ALLOWED_EXTENSIONS = {"ifc", "glb", "gltf", "obj", "fbx", "dae", "stp", "step", "xyz", "e57", "blend"}


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
    """Module 3 version: Extracts full BIM hierarchy site -> building -> storey -> element."""
    projects = model.by_type("IfcProject")
    if not projects:
        return {"id": "root", "name": "No Project Found", "type": "Project", "children": []}
    
    return recursive_decompose(projects[0])


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