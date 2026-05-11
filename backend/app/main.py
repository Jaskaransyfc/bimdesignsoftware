from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from .api import projects, elements, auth, modeling, drawings, engines, collab, advanced_modules, levels, furniture, models, enterprise_modules, freecad, windows
from .database import engine, Base
from .config import STORAGE_MODE, LOCAL_STORAGE_PATH
import os

app = FastAPI(title="BIM Platform API")

# Custom middleware to increase max body size for file uploads
class LimitUploadSize(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request, call_next):
        if request.method == "POST" and "models/upload" in request.url.path:
            if request.headers.get("content-length"):
                content_length = int(request.headers["content-length"])
                if content_length > self.max_upload_size:
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max size: {self.max_upload_size / (1024*1024):.0f}MB"
                    )
        return await call_next(request)

# Add middleware for upload size limit (50MB)
app.add_middleware(LimitUploadSize, max_upload_size=50 * 1024 * 1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local storage files if in local mode
if STORAGE_MODE == "local":
    if not os.path.exists(LOCAL_STORAGE_PATH):
        os.makedirs(LOCAL_STORAGE_PATH)
    app.mount("/api/storage", StaticFiles(directory=LOCAL_STORAGE_PATH), name="storage")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.url.get_backend_name().startswith("sqlite"):
            def _repair_sqlite_schema(sync_conn):
                from sqlalchemy import inspect as sync_inspect

                inspector = sync_inspect(sync_conn)
                table_names = set(inspector.get_table_names())
                if "model_elements" in table_names:
                    model_element_columns = {
                        column["name"] for column in inspector.get_columns("model_elements")
                    }
                    if "level_id" not in model_element_columns:
                        sync_conn.execute(text("ALTER TABLE model_elements ADD COLUMN level_id VARCHAR(36)"))
                if "furniture_items" in table_names:
                    furniture_columns = {
                        column["name"] for column in inspector.get_columns("furniture_items")
                    }
                    if "level_id" not in furniture_columns:
                        sync_conn.execute(text("ALTER TABLE furniture_items ADD COLUMN level_id VARCHAR(36)"))

            await conn.run_sync(_repair_sqlite_schema)

app.include_router(projects.router)
app.include_router(elements.router)
app.include_router(auth.router)
app.include_router(modeling.router)
app.include_router(drawings.router)
app.include_router(engines.router)
app.include_router(collab.router)
app.include_router(advanced_modules.router)
app.include_router(levels.router)
app.include_router(furniture.router)
app.include_router(models.router)
app.include_router(enterprise_modules.router)
app.include_router(freecad.router)
app.include_router(windows.router)
