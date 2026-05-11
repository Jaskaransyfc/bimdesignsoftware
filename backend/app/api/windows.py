from fastapi import APIRouter
from typing import List

router = APIRouter(prefix="/api/projects", tags=["windows"])

# Default window library
DEFAULT_WINDOWS = [
    {
        "name": "Triple Casement Window",
        "raw_url": "TRIPLE_CASEMENT_V1",
        "width": 1.8,
        "height": 2.2,
        "style": "triple_casement"
    },
    {
        "name": "Circular Window",
        "raw_url": "CIRCULAR_FIXED_V1",
        "width": 1.0,
        "height": 1.0,
        "style": "circular_fixed"
    },
    {
        "name": "Triangle Window",
        "raw_url": "TRIANGLE_CASEMENT_V1",
        "width": 1.6,
        "height": 1.2,
        "style": "triangle_casement"
    },
    {
        "name": "Pattern Arch Window",
        "raw_url": "PATTERN_ARCH_V1",
        "width": 2.0,
        "height": 2.5,
        "style": "pattern_arch"
    },
    {
        "name": "Oval Grille Window",
        "raw_url": "OVAL_GRILLE_V1",
        "width": 0.8,
        "height": 1.1,
        "style": "oval_grille"
    },
    {
        "name": "Curved Arch Window",
        "raw_url": "CURVED_ARCH_V1",
        "width": 4.0,
        "height": 2.5,
        "style": "curved_arch"
    },
    {
        "name": "Semi-Curved Grille Window",
        "raw_url": "SEMI_CURVED_GRILLE_V1",
        "width": 4.0,
        "height": 2.5,
        "style": "semi_curved_grille"
    },
    {
        "name": "Modern Sliding Window",
        "raw_url": "MODERN_SLIDING_V1",
        "width": 3.0,
        "height": 2.0,
        "style": "sliding"
    },
    {
        "name": "Double Casement Transom",
        "raw_url": "DOUBLE_CASEMENT_TRANSOM_V1",
        "width": 1.2,
        "height": 1.4,
        "style": "double_casement_transom"
    }
]

@router.get("/{project_id}/windows/library")
async def get_window_library(project_id: str):
    """Get the default window library."""
    return {
        "library": DEFAULT_WINDOWS,
        "count": len(DEFAULT_WINDOWS),
    }
