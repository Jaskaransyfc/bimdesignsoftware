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
    """Return a list of door-related .stl (and other) files from FreeCAD-library.

    This queries the repository tree (recursive) and filters for files whose
    path or filename contains "door" and have a renderable extension (.stl, .obj, .gltf, .glb).
    Returns simplified objects with `name`, `path`, and `raw_url`.
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
        if "door" in lower and lower.endswith(exts):
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{path}"
            # prefer name as filename
            name = os.path.basename(path)
            if raw_url not in seen:
                results.append({"name": name, "path": path, "raw_url": raw_url})
                seen.add(raw_url)

    # Sort by name
    results.sort(key=lambda x: x["name"])
    return results


@router.get("/windows", response_model=List[dict])
def list_freecad_windows():
    """Return a list of window-related .stl (and other) files from FreeCAD-library.

    This queries the repository tree (recursive) and filters for files whose
    path or filename contains "window" and have a renderable extension (.stl, .obj, .gltf, .glb).
    Returns simplified objects with `name`, `path`, and `raw_url`.
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
        if "window" in lower and "arch" in lower and lower.endswith(exts):
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{path}"
            name = os.path.basename(path)
            if raw_url not in seen:
                results.append({"name": name, "path": path, "raw_url": raw_url})
                seen.add(raw_url)

    results.sort(key=lambda x: x["name"])
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
