import pathlib, tempfile, os, ifcopenshell, subprocess, json, shutil, traceback
from uuid import UUID
from .database import SessionLocalSync
from .models import Project, ProjectStatus, Element
from .storage import get_file_content, upload_file

def process_ifc(project_id: str):
    print(f"DEBUG: [Project {project_id}] Starting background processing...")
    db = SessionLocalSync()
    project = None

    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"ERROR: [Project {project_id}] Project not found in database.")
            return
            
        project.status = ProjectStatus.PROCESSING
        db.commit()

        # 1. Download & Save Temporary File
        ifc_data = get_file_content(project.original_file)
        tmp_dir = tempfile.mkdtemp()
        input_path = os.path.join(tmp_dir, "model.ifc")
        with open(input_path, "wb") as f:
            f.write(ifc_data)

        # 2. Convert to GLB
        output_glb = os.path.join(tmp_dir, "model.glb")
        print(f"DEBUG: [Project {project_id}] Running IfcConvert...")
        
        try:
            subprocess.run([
                "IfcConvert", input_path, output_glb, 
                "--use-element-guids",
                "--separate-z-up-node"
            ], check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"ERROR: [Project {project_id}] IfcConvert failed: {e.stderr}")
            raise Exception(f"IfcConvert failed: {e.stderr}")

        # 3. Upload Result
        glb_key = f"glb/{project_id}/model.glb"
        with open(output_glb, "rb") as f:
            upload_file(glb_key, f.read())

        project.xkt_file = glb_key
        print(f"DEBUG: [Project {project_id}] 3D Geometry uploaded.")

        # 4. Extract Metadata & Hierarchy
        print(f"DEBUG: [Project {project_id}] Opening IFC for metadata extraction...")
        model = ifcopenshell.open(input_path)
        
        # 4a. Elements
        elements = model.by_type("IfcElement")
        print(f"DEBUG: [Project {project_id}] Found {len(elements)} elements.")
        
        for el in elements:
            try:
                props = {}
                for rel in getattr(el, "IsDefinedBy", []):
                    if rel.is_a("IfcRelDefinesByProperties"):
                        pset = rel.RelatingPropertyDefinition
                        if pset.is_a("IfcPropertySet"):
                            for prop in getattr(pset, "HasProperties", []):
                                if prop.is_a("IfcPropertySingleValue"):
                                    try:
                                        val = prop.NominalValue.wrappedValue if prop.NominalValue else None
                                        props[str(prop.Name)] = str(val) if val is not None else ""
                                    except: continue

                db.add(Element(
                    project_id=project.id,
                    global_id=el.GlobalId,
                    ifc_type=el.is_a(),
                    name=el.Name or "Unnamed",
                    properties=props
                ))
            except Exception as el_err:
                print(f"WARNING: [Project {project_id}] Failed to process element {el.GlobalId}: {el_err}")
                continue

        # 4b. Hierarchy (Foolproof Relationship Mapping)
        print(f"DEBUG: [Project {project_id}] Mapping relationships...")
        children_map = {}

        # 1. Spatial Decomposition (Project -> Site -> Building -> Storey)
        for rel in model.by_type("IfcRelAggregates"):
            parent = getattr(rel, "RelatingObject", None)
            children = getattr(rel, "RelatedObjects", [])
            if parent and children:
                if parent.GlobalId not in children_map:
                    children_map[parent.GlobalId] = []
                for child in children:
                    children_map[parent.GlobalId].append(child)

        # 2. Element Containment (Storey -> Walls, Windows, etc.)
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            parent = getattr(rel, "RelatingStructure", None)
            children = getattr(rel, "RelatedElements", [])
            if parent and children:
                if parent.GlobalId not in children_map:
                    children_map[parent.GlobalId] = []
                for child in children:
                    children_map[parent.GlobalId].append(child)

        def build_tree(element, depth=0):
            if depth > 20: return None # Safety limit
            
            node = {
                "id": element.GlobalId,
                "name": element.Name or element.is_a(),
                "type": element.is_a(),
                "children": []
            }
            
            for child in children_map.get(element.GlobalId, []):
                child_node = build_tree(child, depth + 1)
                if child_node:
                    node["children"].append(child_node)
                    
            return node

        # Smart Root Search
        root_element = None
        for root_type in ["IfcProject", "IfcSite", "IfcBuilding"]:
            potential_roots = model.by_type(root_type)
            if potential_roots:
                root_element = potential_roots[0]
                break

        if root_element:
            print(f"DEBUG: [Project {project_id}] Building spatial tree from {root_element.is_a()}...")
            project.hierarchy = build_tree(root_element)
        else:
            print(f"WARNING: [Project {project_id}] No spatial root found!")

        project.status = ProjectStatus.READY
        db.commit()
        print(f"DEBUG: [Project {project_id}] Processing complete.")

    except Exception as e:
        print(f"CRITICAL ERROR: [Project {project_id}] {e}")
        print(traceback.format_exc())
        if project:
            db.rollback()
            project.status = ProjectStatus.ERROR
            db.commit()
    finally:
        db.close()
        if 'tmp_dir' in locals(): shutil.rmtree(tmp_dir, ignore_errors=True)
