from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import projects, elements
from .database import engine, Base
from .config import STORAGE_MODE, LOCAL_STORAGE_PATH
import os

app = FastAPI(title="BIM Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

app.include_router(projects.router)
app.include_router(elements.router)
