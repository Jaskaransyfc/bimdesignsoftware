from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import Project, FurnitureModel
import uuid
import os
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from starlette.concurrency import run_in_threadpool
import shutil
from typing import Optional

router = APIRouter(prefix="/api/projects", tags=["models"])

# Directory for storing uploaded models
MODELS_DIR = Path("storage/models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions for 3D models
ALLOWED_EXTENSIONS = {
    ".glb",
    ".gltf",
    ".obj",
    ".fbx",
    ".dxf",
    ".dwg",
    ".dwf",
    ".mtl",
    # Additional CAD/BIM formats (accepted for upload; visualization may be limited)
    ".ifc",
    ".rvt",
    ".rfa",
    ".stp",
    ".step",
    ".dae",
    ".stl",
    ".3ds",
    ".max",
    ".skp",
    ".blend",
}


class FurnitureModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    file_path: str
    file_size: int
    model_type: str  # "chair", "sofa", "table", etc.
    created_at: datetime
    warning: Optional[str] = None  # Warning message for unsupported formats


@router.post("/{project_id}/models/upload")
async def upload_model(
    project_id: str,
    file: UploadFile,
    model_type: str = "custom",
    db: AsyncSession = Depends(get_db),
):
    """Upload a 3D model file for furniture."""
    # Verify project exists
    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validate and stream file to disk (don't load all into memory)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    file_size = 0
    
    try:
        model_id = str(uuid.uuid4())
        file_path = MODELS_DIR / f"{model_id}{file_ext}"

        # Stream file to disk in a threadpool to avoid blocking the event loop.
        def _write_chunks(src, dest, max_size):
            written = 0
            while True:
                chunk = src.read(8192)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_size:
                    raise ValueError("File too large")
                dest.write(chunk)
            return written

        with open(file_path, "wb") as f:
            try:
                # file.file is a SpooledTemporaryFile (synchronous). Run the blocking
                # read/write loop in a threadpool.
                file_size = await run_in_threadpool(_write_chunks, file.file, f, MAX_FILE_SIZE)
            except ValueError:
                if file_path.exists():
                    file_path.unlink()
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum 50MB allowed.",
                )
    except HTTPException:
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )

    # Save to database
    try:
        new_model = FurnitureModel(
            id=model_id,
            project_id=project_id,
            name=Path(file.filename or "model").stem,
            file_path=str(file_path),
            file_size=file_size,
            model_type=model_type,
        )
        db.add(new_model)
        await db.commit()
        await db.refresh(new_model)

        # Generate warning message for formats that have limited visualization
        warning = None
        if file_ext in {".dwg", ".dwf"}:
            warning = f"⚠️ {file_ext.upper()} files are not directly supported for visualization. Please export as .dxf, .obj, or .gltf from AutoCAD for best results."
        elif file_ext == ".dxf":
            warning = "⚠️ DXF files have limited visualization support. GLTF/OBJ export recommended for better results."
        elif file_ext == ".mtl":
            warning = "⚠️ MTL (Material) files should be uploaded together with OBJ files in the same folder. Upload the OBJ file instead."
        elif file_ext in {".ifc", ".rvt", ".rfa", ".stp", ".step", ".dae", ".stl", ".3ds", ".max", ".skp", ".blend"}:
            warning = f"⚠️ {file_ext.upper()} files are accepted for upload but may have limited or no direct 3D preview. Convert/export to GLTF, GLB, or OBJ for best results."

        # Return a plain dict with stringified datetime to avoid Pydantic
        # validation issues when returning ORM objects directly.
        return {
            "id": new_model.id,
            "project_id": new_model.project_id,
            "name": new_model.name,
            "file_path": new_model.file_path,
            "file_size": new_model.file_size,
            "model_type": new_model.model_type,
            "created_at": new_model.created_at.isoformat() if new_model.created_at else None,
            "warning": warning,
        }
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save model to database: {str(e)}"
        )


@router.get("/{project_id}/models", response_model=List[FurnitureModelResponse])
async def get_project_models(
    project_id: str, db: AsyncSession = Depends(get_db)
):
    """Get all uploaded models for a project."""
    result = await db.execute(
        select(FurnitureModel).where(FurnitureModel.project_id == project_id)
    )
    models = result.scalars().all()
    return models


@router.get("/{project_id}/models/{model_id}/download")
async def download_model(
    project_id: str, model_id: str, db: AsyncSession = Depends(get_db)
):
    """Download a model file."""
    result = await db.execute(
        select(FurnitureModel).where(
            FurnitureModel.id == model_id,
            FurnitureModel.project_id == project_id,
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Return file response
    from fastapi.responses import FileResponse

    return FileResponse(model.file_path, filename=f"{model.name}{Path(model.file_path).suffix}")


@router.delete("/{project_id}/models/{model_id}")
async def delete_model(
    project_id: str, model_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete an uploaded model."""
    result = await db.execute(
        select(FurnitureModel).where(
            FurnitureModel.id == model_id,
            FurnitureModel.project_id == project_id,
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Delete file
    file_path = Path(model.file_path)
    if file_path.exists():
        file_path.unlink()

    # Delete from database
    await db.delete(model)
    await db.commit()

    return {"success": True, "message": "Model deleted"}
