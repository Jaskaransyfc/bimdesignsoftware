from fastapi import APIRouter
import json
import urllib.request
import os
from typing import List

router = APIRouter(prefix="/api/freecad", tags=["freecad"])


def _fetch_github_repo_tree(owner: str, repo: str, branch: str = "master"):
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "bimdesign-agent"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)


@router.get("/doors", response_model=List[dict])
def list_freecad_doors():
    """Return only the curated list of professional BIM doors.
    """
    results = [
        {
            "name": "Luxury Modern Designer Door",
            "filename": "luxury_modern_door.fcstd",
            "path": "architectural parts/doors/luxury_modern_door.fcstd",
            "raw_url": "LUXURY_MODERN_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Modern Wood + Inlay Luxury Door",
            "filename": "modern_wood_inlay_door.fcstd",
            "path": "architectural parts/doors/modern_wood_inlay_door.fcstd",
            "raw_url": "MODERN_WOOD_INLAY_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Classic Luxury Double Door",
            "filename": "classic_double_door.fcstd",
            "path": "architectural parts/doors/classic_double_door.fcstd",
            "raw_url": "CLASSIC_DOUBLE_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Mandala Luxury Double Door",
            "filename": "mandala_double_door.fcstd",
            "path": "architectural parts/doors/mandala_double_door.fcstd",
            "raw_url": "MANDALA_DOUBLE_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Slatted Walnut Pivot Door",
            "filename": "slatted_pivot_door.fcstd",
            "path": "architectural parts/doors/slatted_pivot_door.fcstd",
            "raw_url": "SLATTED_PIVOT_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Standard BIM Door",
            "filename": "standard_bim_door.fcstd",
            "path": "architectural parts/doors/standard_bim_door.fcstd",
            "raw_url": "STANDARD_BIM_V1",
            "ext": ".fcstd"
        }
    ]
    return results


@router.get("/windows", response_model=List[dict])
def list_freecad_windows():
    """Return only the curated list of professional BIM windows.
    """
    results = [
        {
            "name": "Modern Sliding Glass Window",
            "filename": "modern_sliding_window.fcstd",
            "path": "architectural parts/windows/modern_sliding_window.fcstd",
            "raw_url": "MODERN_SLIDING_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Double Casement Window with Transom",
            "filename": "double_casement_transom.fcstd",
            "path": "architectural parts/windows/double_casement_transom.fcstd",
            "raw_url": "DOUBLE_CASEMENT_TRANSOM_V1",
            "ext": ".fcstd"
        },
        {
            "name": "Standard BIM Window",
            "filename": "standard_bim_window.fcstd",
            "path": "architectural parts/windows/standard_bim_window.fcstd",
            "raw_url": "STANDARD_WINDOW_V1",
            "ext": ".fcstd"
        }
    ]
    return results


@router.get("/stairs", response_model=List[dict])
def list_freecad_stairs():
    """Return only the curated list of professional BIM stairs.
    """
    results = [
        {
            "name": "Floating Switchback Staircase",
            "filename": "floating_switchback_stairs.fcstd",
            "path": "architectural parts/stairs/floating_switchback_stairs.fcstd",
            "raw_url": "FLOATING_SWITCHBACK_V1",
            "ext": ".fcstd"
        }
    ]
    return results


@router.get("/floors", response_model=List[dict])
def list_freecad_floors():
    """Return only the curated list of professional BIM floors.
    """
    results = [
        {
            "name": "Marble Vitrified Tile Floor",
            "filename": "marble_vitrified_floor.fcstd",
            "path": "architectural parts/floors/marble_vitrified_floor.fcstd",
            "raw_url": "MARBLE_VITRIFIED_V1",
            "ext": ".fcstd"
        }
    ]
    return results


@router.get("/walls", response_model=List[dict])
def list_freecad_walls():
    """Return a list of wall-related .stl/.obj/.gltf/.glb files from FreeCAD-library.

    Queries the repo tree recursively and filters for files whose path contains
    'wall' with a renderable extension. Returns objects with `name`, `path`, and `raw_url`.
    """
    owner = "FreeCAD"
    repo = "FreeCAD-library"
    branch_candidates = ["master", "main"]

    tree = None
    for br in branch_candidates:
        try:
            data = _fetch_github_repo_tree(owner, repo, br)
            if data and data.get("tree"):
                tree = data["tree"]
                break
        except Exception:
            continue

    if not tree:
        return []

    exts = (".stl", ".obj", ".gltf", ".glb")
    results = []
    seen = set()
    for entry in tree:
        path = entry.get("path", "")
        if not path:
            continue
        lower = path.lower()
        if "wall" in lower and lower.endswith(exts):
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{path}"
            name = os.path.basename(path)
            if raw_url not in seen:
                results.append({"name": name, "path": path, "raw_url": raw_url})
                seen.add(raw_url)

    results.sort(key=lambda x: x["name"])
    return results
