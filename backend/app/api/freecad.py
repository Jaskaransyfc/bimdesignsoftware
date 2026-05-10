from fastapi import APIRouter
import json
import urllib.request
import os
from typing import List

router = APIRouter(prefix="/api/freecad", tags=["freecad"])



