import pathlib, tempfile, os, ifcopenshell, subprocess, json, shutil
from uuid import UUID
from .database import SessionLocalSync
from .models import Project, ProjectStatus, Element
from .storage import get_file_content, upload_file

def process_ifc(project_id: str):
    print(f"DEBUG: Starting processing for project {project_id}")
    db = SessionLocalSync()
    project = None

    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"DEBUG: Project {project_id} not found")
            return
            
        project.status = ProjectStatus.PROCESSING
        db.commit()

        # 1. Download IFC from storage
        ifc_data = get_file_content(project.original_file)
        tmp_dir = tempfile.mkdtemp()
        input_path = os.path.join(tmp_dir, "model.ifc")
        with open(input_path, "wb") as f:
            f.write(ifc_data)

        # 2. Convert to glTF using IfcConvert
        output_glb = os.path.join(tmp_dir, "model.glb")
        print(f"DEBUG: Running IfcConvert on {input_path} -> {output_glb}")
        
        # Removed --overwrite as we use fresh temp directories
        result = subprocess.run([
            "IfcConvert", input_path, output_glb, 
            "--use-element-guids"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"ERROR: IfcConvert failed: {result.stderr}")
            raise Exception(f"IfcConvert failed: {result.stderr}")

        # Verify if the file exists
        if not os.path.exists(output_glb):
            raise Exception("Conversion failed: No output file was generated.")

        # Upload to storage
        glb_key = f"glb/{project_id}/model.glb"
        with open(output_glb, "rb") as f:
            upload_file(glb_key, f.read())

        project.xkt_file = glb_key
        print(f"DEBUG: 3D file successfully created and saved.")

        # 3. Extract metadata
        print(f"DEBUG: Extracting BIM metadata...")
        model = ifcopenshell.open(input_path)
        elements = model.by_type("IfcElement")
        for el in elements:
            props = {}
            for rel in getattr(el, "IsDefinedBy", []):
                if rel.is_a("IfcRelDefinesByProperties"):
                    pset = rel.RelatingPropertyDefinition
                    if pset.is_a("IfcPropertySet"):
                        for prop in pset.HasProperties:
                            if prop.is_a("IfcPropertySingleValue"):
                                try:
                                    val = str(prop.NominalValue.wrappedValue) if prop.NominalValue else None
                                    props[prop.Name] = val
                                except: continue

            db.add(Element(
                project_id=project.id,
                global_id=el.GlobalId,
                ifc_type=el.is_a(),
                name=el.Name,
                properties=props
            ))

        project.status = ProjectStatus.READY
        db.commit()
        print(f"DEBUG: SUCCESS - Project {project_id} is ready for viewing.")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        if project:
            db.rollback()
            project.status = ProjectStatus.ERROR
            db.commit()
        raise
    finally:
        db.close()
        if 'tmp_dir' in locals() and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)
