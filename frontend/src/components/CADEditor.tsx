"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Line,
  Rect,
  Circle,
  Stage,
  Layer,
  Group,
  Arc,
  Text as KonvaText,
} from "react-konva";
import Konva from "konva";
import {
  Element,
  Wall,
  Door,
  Window,
  Room,
  Dimension,
  TextElement,
  Point2D,
  ToolType,
  Level,
  FurnitureItem,
  Stair,
  Floor,
  Railing,
  Roof,
  ElectricalFixture,
  Polyline,
} from "@/types/modeling";
import {
  Plus,
  Minus,
  Trash2,
  Save,
  Square,
  Move,
  Hand,
  Type,
  Ruler,
  DoorOpen as DoorIcon,
  Layout,
  Package2,
  Menu as StairsIcon,
  Grid as FloorIcon,
  Triangle as RoofIcon,
  Fence as RailingIcon,
} from "lucide-react";
import { formatImperial } from "@/lib/calculations";

interface CADEditorProps {
  projectId: string;
  onSave?: (elements: Element[]) => void;
  onElementsChange?: (elements: Element[]) => void;
  onSelectionChange?: (element: Element | null) => void;
  initialElements?: Element[];
}

type DoorSelectionData = {
  width_mm: number;
  height_mm: number;
  swingDirection: Door["swingDirection"];
  openingSide?: Door["openingSide"];
  material: string;
  fireRating?: string;
};

const GRID_SIZE = 20; // pixels per grid square
const MM_TO_CANVAS = 50;
const OPENING_ATTACH_DISTANCE = 80;

/** Returns the canvas stroke-width used to draw a wall (mirrors renderWall). */
const wallStrokeWidth = (wall: Wall) => Math.max(8, wall.thickness / 50);

const snapToGrid = (p: Point2D): Point2D => ({
  x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
});

const clamp = (v: number, min: number, max: number): number => {
  if (v < min) return min;
  if (v > max) return max;
  return v;
};

const deriveDoorPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  const isDouble = /double|2\s*leaf|2leaf|bi\s*fold|bifold|pair/.test(raw);
  const isMulti =
    /multi|triple|3\s*leaf|3leaf|quad|4\s*leaf|4leaf|sliding|fold/.test(raw);
  const isGlass = /glass|glazed|frameless/.test(raw);

  if (isMulti) {
    return {
      width: 2400,
      height: 2400,
      swingDirection: "double" as Door["swingDirection"],
      openingSide: "inside" as Door["openingSide"],
      material: isGlass ? "Glass" : "Wood",
      doorStyle: "multi",
    };
  }

  if (isDouble) {
    return {
      width: 1800,
      height: 2300,
      swingDirection: "double" as Door["swingDirection"],
      openingSide: "inside" as Door["openingSide"],
      material: isGlass ? "Glass" : "Wood",
      doorStyle: "double",
    };
  }

  if (isGlass) {
    return {
      width: 1200,
      height: 2200,
      swingDirection: "right" as Door["swingDirection"],
      openingSide: "inside" as Door["openingSide"],
      material: "Glass",
      doorStyle: "glass",
    };
  }

  return {
    width: 900,
    height: 2100,
    swingDirection: "right" as Door["swingDirection"],
    openingSide: "inside" as Door["openingSide"],
    material: "Wood",
    doorStyle: "single",
  };
};

const deriveWindowPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  const isWide = /wide|double|2\s*leaf|2leaf|bay|panorama|slider|sliding/.test(
    raw,
  );
  const isTall = /tall|vertical|slim|narrow/.test(raw);
  const isLarge = /large|big|full/.test(raw);
  const isGlass = /glass|glazed|frameless/.test(raw);

  if (isWide && isLarge) {
    return {
      width: 2400,
      height: 1800,
      windowStyle: "wide",
      glazing: isGlass ? "Clear" : "Standard",
      material: isGlass ? "Glass" : "Aluminum",
    };
  }

  if (isWide) {
    return {
      width: 1800,
      height: 1500,
      windowStyle: "wide",
      glazing: isGlass ? "Clear" : "Standard",
      material: isGlass ? "Glass" : "Aluminum",
    };
  }

  if (isTall) {
    return {
      width: 1200,
      height: 1800,
      windowStyle: "tall",
      glazing: isGlass ? "Clear" : "Standard",
      material: isGlass ? "Glass" : "Aluminum",
    };
  }

  return {
    width: 1200,
    height: 1200,
    windowStyle: "single",
    glazing: isGlass ? "Clear" : "Standard",
    material: isGlass ? "Glass" : "Aluminum",
  };
};

const deriveStairPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  const isFloatingSwitchback =
    /floating_switchback|switchback|FLOATING_SWITCHBACK_V1/.test(raw);
  const isSpiralMetal = /spiral_metal|spiral|SPIRAL_METAL_V1/.test(raw);
  const isConcreteParametric =
    /concrete_parametric|concrete|CONCRETE_PARAMETRIC_V1/.test(raw);

  if (isConcreteParametric) {
    return {
      type: "concrete_parametric",
      width: 2400,
      height: 3000,
      metadata: {
        stair_style: "concrete_parametric",
        number_of_steps: "8",
        stair_width: "2.40",
        tread_depth: "0.42",
        rise_height: "0.22",
        landing_depth: "0.65",
        concrete_brightness: "0.62",
        show_dark_edges: true,
        metalness: "0.02",
        roughness: "0.58",
      },
    };
  }

  if (isSpiralMetal) {
    return {
      type: "spiral_metal",
      width: 2000,
      height: 3450,
      metadata: {
        stair_style: "spiral_metal",
      },
    };
  }

  if (isFloatingSwitchback) {
    return {
      type: "floating_switchback",
      width: 2050,
      height: 2450,
      metadata: {
        stair_style: "floating_switchback",
      },
    };
  }

  return {
    type: "standard",
    width: 1000,
    height: 3000,
  };
};

const deriveRailingPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  if (raw.includes("glass"))
    return { railingStyle: "glass", length: 6000, height: 1100 };
  if (raw.includes("horizontal"))
    return { railingStyle: "horizontal", length: 8000, height: 1100 };
  if (raw.includes("tree") || raw.includes("branch"))
    return { railingStyle: "tree_branch", length: 2240, height: 1000 };
  return { railingStyle: "modern", length: 8000, height: 1100 };
};

const deriveRoofPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  if (raw.includes("rounded"))
    return { roofStyle: "soft_rounded", width: 9000, depth: 6000 };
  if (raw.includes("modern"))
    return { roofStyle: "modern_flat", width: 8000, depth: 6000 };
  if (raw.includes("tile"))
    return { roofStyle: "sloped_tile", width: 8000, depth: 8000 };
  if (raw.includes("gable"))
    return { roofStyle: "symmetric_gable", width: 8000, depth: 8000 };
  if (raw.includes("thatch"))
    return { roofStyle: "thatched", width: 7000, depth: 5000 };
  return { roofStyle: "modern_flat", width: 8000, depth: 6000 };
};

const deriveFloorPreset = (source?: string | null) => {
  const raw = String(source || "").toLowerCase();
  const isMarble = /marble|vitrified|MARBLE_VITRIFIED_V1/.test(raw);
  const isConcrete = /concrete|CONCRETE_TILE_V1/.test(raw);
  const isDecorative = /decorative|medallion|DECORATIVE_MEDALLION_V1/.test(raw);
  const isLuxury = /luxury|stone|LUXURY_STONE_V1/.test(raw);
  const isChecker = /checker|ceramic|CHECKER_CERAMIC_V1/.test(raw);

  if (isMarble) {
    return {
      type: "marble_vitrified",
      width: 3000,
      depth: 3000,
      material: "Marble Vitrified",
      color: "#f8fafc",
    };
  }
  if (isConcrete) {
    return {
      type: "concrete_tile",
      width: 4000,
      depth: 4000,
      material: "Concrete Tile",
      color: "#94a3b8",
    };
  }
  if (isDecorative) {
    return {
      type: "decorative_medallion",
      width: 3000,
      depth: 3000,
      material: "Decorative Medallion",
      color: "#fef3c7",
    };
  }
  if (isLuxury) {
    return {
      type: "luxury_stone",
      width: 3500,
      depth: 3500,
      material: "Luxury Stone",
      color: "#e2e8f0",
    };
  }
  if (isChecker) {
    return {
      type: "checker_ceramic",
      width: 2500,
      depth: 2500,
      material: "Checker Ceramic",
      color: "#f1f5f9",
    };
  }

  return {
    type: "marble_vitrified",
    width: 3000,
    depth: 3000,
    material: "Marble Vitrified",
    color: "#f8fafc",
  };
};

const deriveWallPreset = (materialName?: string | null) => {
  const raw = String(materialName || "").toLowerCase();
  if (raw.includes("clear_glass_partition"))
    return { material: "Clear Glass Partition", color: "#e0f2fe" };
  if (raw.includes("frosted_glass_partition"))
    return { material: "Frosted Glass Partition", color: "#f1f5f9" };
  if (raw.includes("ribbed_glass_partition"))
    return { material: "Ribbed Glass Partition", color: "#cbd5e1" };
  if (raw.includes("smoked_glass_partition"))
    return { material: "Smoked Glass Partition", color: "#334155" };
  if (raw.includes("gradient_glass_partition"))
    return { material: "Gradient Glass Partition", color: "#94a3b8" };
  if (raw.includes("colored_laminated_partition"))
    return { material: "Colored Laminated Partition", color: "#3b82f6" };
  if (raw.includes("oak_slat_partition"))
    return { material: "Oak Slat Partition", color: "#8b5e3c" };
  if (raw.includes("ash_wood_partition"))
    return { material: "Ash Wood Partition", color: "#d2b48c" };
  if (raw.includes("matte_black_wood_partition"))
    return { material: "Matte Black Wood Partition", color: "#1a1a1a" };

  // Compound Walls
  if (raw.includes("exposed_concrete_compound"))
    return { material: "Exposed Concrete Compound", color: "#8F8C87" };
  if (raw.includes("natural_stone_compound"))
    return { material: "Natural Stone Compound", color: "#8A8176" };
  if (raw.includes("wooden_slat_compound"))
    return { material: "Wooden Slat Compound", color: "#8A5B34" };
  if (raw.includes("brick_texture_compound"))
    return { material: "Brick Texture Compound", color: "#8E4F39" };

  if (raw.includes("glass")) return { material: "Glass", color: "#a5f3fc" };
  if (raw.includes("brick")) return { material: "Red Brick", color: "#d4a574" };
  if (raw.includes("cmu") || raw.includes("block"))
    return { material: "CMU Block", color: "#95a5a6" };
  if (raw.includes("slat"))
    return { material: "Wooden Slat", color: "#8B4513" };
  if (raw.includes("steel") || raw.includes("metal"))
    return { material: "Steel", color: "#b8c4cf" };
  if (raw.includes("wood")) return { material: "Wood Frame", color: "#8B4513" };
  return { material: "Standard", color: "#ffffff" };
};

export default function CADEditor({
  projectId,
  onSave,
  onElementsChange,
  onSelectionChange,
  initialElements = [],
}: CADEditorProps) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [isClient, setIsClient] = useState(false);

  const [elements, setElements] = useState<Element[]>(initialElements);
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point2D | null>(null);
  const [endPoint, setEndPoint] = useState<Point2D | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 1200, height: 700 });
  // Ghost preview position while door/window tool is active
  const [previewPos, setPreviewPos] = useState<Point2D | null>(null);
  const [previewWall, setPreviewWall] = useState<Wall | undefined>(undefined);
  const [roomLabelMode, setRoomLabelMode] = useState<"area" | "dimensions">(
    "dimensions",
  );

  // Levels and Furniture
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [furnitureLibrary, setFurnitureLibrary] = useState<any[]>([]);
  const [doorLibrary, setDoorLibrary] = useState<any[]>([]);
  const [windowLibrary, setWindowLibrary] = useState<any[]>([]);
  const [stairLibrary, setStairLibrary] = useState<any[]>([]);
  const [floorLibrary, setFloorLibrary] = useState<any[]>([]);
  const [selectedDoorModelUrl, setSelectedDoorModelUrl] = useState<
    string | null
  >(null);
  const [selectedWindowModelUrl, setSelectedWindowModelUrl] = useState<
    string | null
  >(null);
  const [selectedStairModelUrl, setSelectedStairModelUrl] = useState<
    string | null
  >(null);
  const [selectedFloorModelUrl, setSelectedFloorModelUrl] = useState<
    string | null
  >(null);
  const [selectedRailingModelUrl, setSelectedRailingModelUrl] = useState<
    string | null
  >(null);
  const [selectedRoofStyle, setSelectedRoofStyle] =
    useState<string>("modern_flat");
  const [selectedWallMaterial, setSelectedWallMaterial] =
    useState<string>("Standard");
  const [customDoorUrl, setCustomDoorUrl] = useState<string>("");
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<
    string | null
  >(null);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isSavingFurniture, setIsSavingFurniture] = useState(false);

  // Door Management - New Integration
  const [showDoorSelector, setShowDoorSelector] = useState(false);
  const [selectedDoor, setSelectedDoor] = useState<Door | null>(null);
  const [showDoorPropertyPanel, setShowDoorPropertyPanel] = useState(false);

  const normalizeFurnitureItem = (item: any): FurnitureItem => ({
    id: item.id,
    projectId: item.projectId ?? item.project_id,
    levelId: item.levelId ?? item.level_id,
    assetType: item.assetType ?? item.asset_type,
    family: item.family,
    x: Number(item.x ?? 0),
    y: Number(item.y ?? 0),
    z: Number(item.z ?? 0),
    width: item.width ?? undefined,
    depth: item.depth ?? undefined,
    height: item.height ?? undefined,
    materialId: item.materialId ?? item.material_id,
    metadata: item.metadata ?? {},
  });

  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedId = selectedIds[0];
    if (!selectedId) {
      onSelectionChange(null);
      return;
    }
    const el = elements.find((e) => e.id === selectedId) ?? null;
    onSelectionChange(el);
  }, [selectedIds, elements, onSelectionChange]);

  useEffect(() => {
    const updateViewport = () => {
      if (!canvasWrapRef.current) return;
      setViewport({
        width: Math.max(1, canvasWrapRef.current.clientWidth),
        height: Math.max(1, canvasWrapRef.current.clientHeight),
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    const observer = new ResizeObserver(() => {
      updateViewport();
    });

    if (canvasWrapRef.current) {
      observer.observe(canvasWrapRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateViewport);
      observer.disconnect();
    };
  }, []);

  // Load levels and furniture
  useEffect(() => {
    const loadLevels = async () => {
      try {
        setIsLoadingLevels(true);
        const res = await fetch(`/api/projects/${projectId}/levels`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setLevels(data);
            setSelectedLevelId((current) => current || data[0].id);
          } else {
            const initRes = await fetch(
              `/api/projects/${projectId}/levels/init`,
              {
                method: "POST",
              },
            );
            if (initRes.ok) {
              const level = await initRes.json();
              setLevels([level]);
              setSelectedLevelId(level.id);
            } else {
              setLevels([]);
              setSelectedLevelId(null);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load levels:", error);
        // Create default level if none exist
        try {
          const initRes = await fetch(
            `/api/projects/${projectId}/levels/init`,
            {
              method: "POST",
            },
          );
          if (initRes.ok) {
            const level = await initRes.json();
            setLevels([level]);
            setSelectedLevelId(level.id);
          }
        } catch (initError) {
          console.error("Failed to initialize default level:", initError);
        }
      } finally {
        setIsLoadingLevels(false);
      }
    };

    const loadFurniture = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/furniture`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : [];
          setFurnitureItems(items.map(normalizeFurnitureItem));
        }
      } catch (error) {
        console.error("Failed to load furniture:", error);
      }
    };

    const loadFurnitureLibrary = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/furniture/library`);
        if (res.ok) {
          const data = await res.json();
          const library = data.library || [];
          setFurnitureLibrary(library);
          if (library.length > 0) {
            setSelectedFurnitureType(
              (current) =>
                current || `${library[0].asset_type}_${library[0].family}`,
            );
          }
        }
      } catch (error) {
        console.error("Failed to load furniture library:", error);
      }
    };

    loadLevels();
    loadFurniture();
    loadFurnitureLibrary();
  }, [projectId]);

  useEffect(() => {
    const loadDoorLibrary = async () => {
      try {
        const res = await fetch(`/api/freecad/doors`);
        if (res.ok) {
          const data = await res.json();
          const library = Array.isArray(data) ? data : [];
          // Very permissive pre-filter: only remove obvious hardware parts
          const filtered = library.filter((d: any) => {
            const path = d.path.toLowerCase();
            const name = d.name.toLowerCase();
            // Only exclude specific non-door hardware items
            const hardwareTerms = [
              "hinge",
              "handle",
              "knob",
              "accessories",
              "hardware",
            ];
            return !hardwareTerms.some(
              (term) => path.includes(term) || name.includes(term),
            );
          });
          setDoorLibrary(filtered);
          if (filtered.length > 0) {
            setSelectedDoorModelUrl(
              filtered[0].raw_url || filtered[0].download_url,
            );
          }
        }
      } catch (err) {
        console.error("Failed to load FreeCAD door library:", err);
      }
    };
    loadDoorLibrary();
  }, []);

  useEffect(() => {
    const loadWindowLibrary = async () => {
      try {
        const res = await fetch(`/api/freecad/windows`);
        if (res.ok) {
          const data = await res.json();
          const library = Array.isArray(data) ? data : [];
          setWindowLibrary(library);
          if (library.length > 0) {
            setSelectedWindowModelUrl(
              (current) =>
                current || library[0].raw_url || library[0].download_url,
            );
          }
        }
      } catch (err) {
        console.error("Failed to load FreeCAD window library:", err);
      }
    };
    loadWindowLibrary();
  }, []);

  useEffect(() => {
    if (!selectedLevelId && levels.length > 0) {
      setSelectedLevelId(levels[0].id);
    }
  }, [levels, selectedLevelId]);

  useEffect(() => {
    // Avoid parent-child feedback loops: only hydrate from props when local editor is empty.
    if (elements.length === 0 && initialElements.length > 0) {
      setElements(initialElements);
    }
  }, [initialElements, elements.length]);

  useEffect(() => {
    onElementsChange?.(elements);
  }, [elements, onElementsChange]);

  if (!isClient) return <div className="w-full h-full bg-slate-700" />;

  // ─────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────

  const walls = elements.filter((e): e is Wall => e.type === "wall");
  const polylines = elements.filter(
    (e): e is Polyline => e.type === "polyline",
  );

  const getCircuitId = (element: Element): string | null => {
    if (element.type === "electrical_fixture") {
      const fixture = element as ElectricalFixture;
      return fixture.circuitId || fixture.metadata?.circuitId || null;
    }
    if (element.type === "polyline") {
      return element.metadata?.circuitId || null;
    }
    return null;
  };

  const selectedCircuitIds = new Set(
    selectedIds
      .map((id) => elements.find((element) => element.id === id))
      .filter((element): element is Element => Boolean(element))
      .map((element) => getCircuitId(element))
      .filter((value): value is string => Boolean(value)),
  );

  const polylineIdsForCircuit = (circuitId: string | null) =>
    circuitId
      ? polylines
          .filter((poly) => poly.metadata?.circuitId === circuitId)
          .map((poly) => poly.id)
      : [];

  const polylineIdsForFixture = (fixtureId: string) =>
    polylines
      .filter(
        (poly) =>
          poly.metadata?.branchId === fixtureId ||
          poly.metadata?.fixtureId === fixtureId,
      )
      .map((poly) => poly.id);

  const getWallDirection = (wall: Wall) => {
    const dx = wall.endPoint.x - wall.startPoint.x;
    const dy = wall.endPoint.y - wall.startPoint.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      return {
        len: 1,
        dir: { x: 1, y: 0 },
        normal: { x: 0, y: 1 },
      };
    }

    const dir = { x: dx / len, y: dy / len };
    const normal = { x: -dir.y, y: dir.x };
    return { len, dir, normal };
  };

  const projectPointOnWall = (p: Point2D, wall: Wall) => {
    const { len, dir } = getWallDirection(wall);
    const vx = p.x - wall.startPoint.x;
    const vy = p.y - wall.startPoint.y;
    const proj = vx * dir.x + vy * dir.y;
    const t = clamp(proj / len, 0, 1);
    const point = {
      x: wall.startPoint.x + dir.x * len * t,
      y: wall.startPoint.y + dir.y * len * t,
    };
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    return { t, point, distance };
  };

  const findWallAt = (p: Point2D) => {
    let nearest: Wall | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const wall of walls) {
      const hit = projectPointOnWall(p, wall);
      if (hit.distance < nearestDistance) {
        nearestDistance = hit.distance;
        nearest = wall;
      }
    }

    if (nearestDistance > OPENING_ATTACH_DISTANCE) return undefined;
    return nearest;
  };

  const constrainOpeningOnWall = (
    p: Point2D,
    wall: Wall | undefined,
    openingWidthMm: number,
  ) => {
    if (!wall) return { position: p, orientation: 0 };
    const { len, dir } = getWallDirection(wall);
    const openingHalf = openingWidthMm / MM_TO_CANVAS / 2;

    const hit = projectPointOnWall(p, wall);

    // Snapping logic - snap to center
    let t = hit.t;
    if (Math.abs(t - 0.5) < 0.05) t = 0.5;

    // Clamp distance to keep the opening fully within the wall
    const snappedDistance = clamp(t * len, openingHalf, len - openingHalf);

    const orientation = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    const snappedPos = {
      x: wall.startPoint.x + dir.x * snappedDistance,
      y: wall.startPoint.y + dir.y * snappedDistance,
    };
    return { position: snappedPos, orientation };
  };

  const getMousePos = (e: any): Point2D => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return { x: 0, y: 0 };

    return {
      x: (pointerPos.x - stage.x()) / stage.scaleX(),
      y: (pointerPos.y - stage.y()) / stage.scaleY(),
    };
  };

  const handleMouseDown = (e: any) => {
    if (activeTool === "select") {
      if (e.target === e.target.getStage()) {
        setSelectedIds([]);
      }
      return;
    }

    const pos = snapToGrid(getMousePos(e));

    if (activeTool === "wall") {
      if (!isDrawing) {
        setStartPoint(pos);
        setIsDrawing(true);
      }
    } else if (activeTool === "room") {
      if (!isDrawing) {
        setStartPoint(pos);
        setEndPoint(pos);
        setIsDrawing(true);
      }
    } else if (activeTool === "door" || activeTool === "window") {
      const pos = getMousePos(e);
      const hostWall = findWallAt(pos);

      // Openings must be wall-hosted to keep 2D and 3D placement consistent.
      if (!hostWall) {
        return;
      }

      const doorPreset = deriveDoorPreset(selectedDoorModelUrl);
      const windowPreset = deriveWindowPreset(selectedWindowModelUrl);
      const openingWidth =
        activeTool === "door" ? doorPreset.width : windowPreset.width;
      const { position, orientation } = constrainOpeningOnWall(
        pos,
        hostWall,
        openingWidth,
      );

      const newElement: Element =
        activeTool === "door"
          ? {
              id: `door_${Date.now()}`,
              type: "door",
              position,
              width: doorPreset.width,
              height: doorPreset.height,
              swingDirection: doorPreset.swingDirection,
              wallId: hostWall?.id,
              orientation,
              openingSide: doorPreset.openingSide,
              material: doorPreset.material,
              metadata: selectedDoorModelUrl
                ? {
                    door_model_url: selectedDoorModelUrl,
                    door_style: doorPreset.doorStyle,
                  }
                : { door_style: doorPreset.doorStyle },
              fireRating: "-",
            }
          : {
              id: `win_${Date.now()}`,
              type: "window",
              position,
              width: openingWidth,
              height: windowPreset.height,
              wallId: hostWall?.id,
              orientation,
              material: windowPreset.material,
              glazing: windowPreset.glazing,
              metadata: selectedWindowModelUrl
                ? {
                    window_model_url: selectedWindowModelUrl,
                    window_style: windowPreset.windowStyle,
                  }
                : { window_style: windowPreset.windowStyle },
            };

      setElements((prev) => [...prev, newElement]);
      setIsDrawing(false);
      return;
    } else if (activeTool === "dimension") {
      if (!isDrawing) {
        setStartPoint(pos);
        setIsDrawing(true);
      }
    } else if (activeTool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        const newText: TextElement = {
          id: `text_${Date.now()}`,
          type: "text",
          position: pos,
          text,
          fontSize: 14,
          rotation: 0,
          color: "#334155",
        };
        setElements((prev) => [...prev, newText]);
      }
    } else if (activeTool === "stairs" && previewPos) {
      const preset = deriveStairPreset(selectedStairModelUrl);
      const newStair: Stair = {
        id: `stair-${Date.now()}`,
        type: "stairs",
        position: previewPos,
        width: 2050, // default or from preset
        height: 2450,
        rotation: 0,
        metadata: {
          stair_style: preset.type,
          stair_model_url: selectedStairModelUrl,
        },
      };
      setElements((prev) => [...prev, newStair]);
      setIsDrawing(false);
    } else if (activeTool === "floor" && previewPos) {
      const preset = deriveFloorPreset(selectedFloorModelUrl);
      const newFloor: Floor = {
        id: `floor-${Date.now()}`,
        type: "floor",
        position: previewPos,
        width: preset.width,
        depth: preset.depth,
        rotation: 0,
        metadata: {
          floor_style: preset.type,
          floor_model_url: selectedFloorModelUrl,
        },
      };
      setElements((prev) => [...prev, newFloor]);
      setIsDrawing(false);
    } else if (activeTool === "furniture" && selectedFurnitureType) {
      // Find selected furniture from library
      const selectedFurniture = furnitureLibrary.find(
        (item) => `${item.asset_type}_${item.family}` === selectedFurnitureType,
      );

      if (!selectedFurniture) {
        console.error("Furniture type not selected");
        return;
      }

      const levelId = selectedLevelId || levels[0]?.id;
      if (!levelId) {
        console.error("Level not selected");
        return;
      }

      // Create furniture item
      const newFurniture = {
        asset_type: selectedFurniture.asset_type,
        family: selectedFurniture.family,
        level_id: levelId,
        x: pos.x / MM_TO_CANVAS, // Convert to meters
        y: pos.y / MM_TO_CANVAS,
        z: 0, // rotation in degrees
        width: selectedFurniture.width ?? 1,
        depth: selectedFurniture.depth ?? 1,
        height: selectedFurniture.height ?? 1,
        metadata: selectedFurniture.metadata || {},
      };

      // Save to backend
      setIsSavingFurniture(true);
      fetch(`/api/projects/${projectId}/furniture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFurniture),
      })
        .then(async (res) => {
          if (res.ok) return res.json();
          const errorText = await res.text();
          throw new Error(errorText || "Failed to save furniture");
        })
        .then((savedFurniture) => {
          // Add to local state immediately for visual feedback
          setFurnitureItems((prev) => [
            ...prev,
            normalizeFurnitureItem(savedFurniture),
          ]);
        })
        .catch((error) => {
          console.error("Failed to place furniture:", error);
          alert("Failed to place furniture. Please try again.");
        })
        .finally(() => {
          setIsSavingFurniture(false);
        });
    } else if (activeTool === "roof" && previewPos) {
      const preset = deriveRoofPreset(selectedRoofStyle);
      const newRoof: Roof = {
        id: `roof-${Date.now()}`,
        type: "roof",
        position: previewPos,
        width: preset.width,
        depth: preset.depth,
        rotation: 0,
        metadata: {
          roof_style: preset.roofStyle,
        },
      };
      setElements((prev) => [...prev, newRoof]);
      setIsDrawing(false);
    } else if (activeTool === "railing" && previewPos) {
      const newRailing: Railing = {
        id: `railing-${Date.now()}`,
        type: "railing",
        position: previewPos,
        length: 4000,
        height: 1100,
        rotation: 0,
        metadata: {
          railing_style: selectedRailingModelUrl || "modern_metal",
        },
      };
      setElements((prev) => [...prev, newRailing]);
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: any) => {
    const pos = snapToGrid(getMousePos(e));
    if (activeTool === "wall" && isDrawing) {
      setEndPoint(pos);
    } else if (activeTool === "room" && isDrawing) {
      setEndPoint(pos);
    } else if (activeTool === "dimension" && isDrawing) {
      setEndPoint(pos);
    }
    // Update ghost preview ONLY when door/window tool is active AND cursor is near a wall
    if (activeTool === "door" || activeTool === "window") {
      const rawPos = getMousePos(e);
      const nearestWall = findWallAt(rawPos);
      const doorPreset = deriveDoorPreset(selectedDoorModelUrl);
      const openingWidth = activeTool === "door" ? doorPreset.width : 1200;
      if (nearestWall) {
        const { position } = constrainOpeningOnWall(
          rawPos,
          nearestWall,
          openingWidth,
        );
        setPreviewPos(position);
        setPreviewWall(nearestWall);
      } else {
        // No wall nearby — hide the ghost so it doesn't float
        setPreviewPos(null);
        setPreviewWall(undefined);
      }
    } else if (
      activeTool === "stairs" ||
      activeTool === "floor" ||
      activeTool === "roof" ||
      activeTool === "railing"
    ) {
      const rawPos = snapToGrid(getMousePos(e));
      setPreviewPos(rawPos);
      setPreviewWall(undefined);
    } else {
      setPreviewPos(null);
      setPreviewWall(undefined);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === "wall" && isDrawing && startPoint && endPoint) {
      // Create wall
      const newWall: Wall = {
        id: `wall_${Date.now()}`,
        type: "wall",
        startPoint,
        endPoint,
        thickness: 230,
        height: 3000,
        material: "Red Brick",
        fireRating: "-",
        color: "#d4a574",
        metadata: {},
      };

      setElements((prev) => [...prev, newWall]);
      setStartPoint(null);
      setEndPoint(null);
      setIsDrawing(false);
    }

    if (activeTool === "room" && isDrawing && startPoint && endPoint) {
      const left = Math.min(startPoint.x, endPoint.x);
      const right = Math.max(startPoint.x, endPoint.x);
      const top = Math.min(startPoint.y, endPoint.y);
      const bottom = Math.max(startPoint.y, endPoint.y);
      const widthMm = Math.round((right - left) * MM_TO_CANVAS);
      const depthMm = Math.round((bottom - top) * MM_TO_CANVAS);
      if (widthMm >= 400 && depthMm >= 400) {
        const roomCount = elements.filter((el) => el.type === "room").length;
        const roomName =
          prompt("Room name:", `Room ${roomCount + 1}`) ||
          `Room ${roomCount + 1}`;
        const newRoom: Room = {
          id: `room_${Date.now()}`,
          type: "room",
          name: roomName,
          vertices: [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom },
          ],
          height: 3000,
          properties: {
            area: (widthMm * depthMm) / 1000000,
            perimeter: ((widthMm + depthMm) * 2) / 1000,
            volume: ((widthMm * depthMm) / 1000000) * 3,
          },
        };
        setElements((prev) => [...prev, newRoom]);
      }
      setStartPoint(null);
      setEndPoint(null);
      setIsDrawing(false);
    }

    if (activeTool === "dimension" && isDrawing && startPoint && endPoint) {
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const lengthMm = Math.round(Math.hypot(dx, dy) * MM_TO_CANVAS);

      const newDim: Dimension = {
        id: `dim_${Date.now()}`,
        type: "dimension",
        startPoint,
        endPoint,
        value: lengthMm,
        unit: "mm",
        orientation: Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical",
      };

      setElements((prev) => [...prev, newDim]);
      setStartPoint(null);
      setEndPoint(null);
      setIsDrawing(false);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    setZoom(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.position(newPos);
    stage.scale({ x: newScale, y: newScale });
    stage.batchDraw();
  };

  const deleteSelected = () => {
    setElements((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(elements);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Door Management Handlers
  // ─────────────────────────────────────────────────────────

  const handleAddDoorFromSelector = (doorData: DoorSelectionData) => {
    const newDoor: Door = {
      id: `door-${Date.now()}`,
      type: "door",
      position: { x: 500, y: 500 },
      width: doorData.width_mm,
      height: doorData.height_mm,
      swingDirection: doorData.swingDirection,
      openingSide: doorData.openingSide || "inside",
      material: doorData.material,
      fireRating: doorData.fireRating,
      orientation: 0,
      levelId: selectedLevelId || undefined,
    };

    setElements([...elements, newDoor]);
    setSelectedIds([newDoor.id]);
    setSelectedDoor(newDoor);
    setShowDoorPropertyPanel(true);
    setShowDoorSelector(false);
  };

  const handleUpdateDoor = (updatedDoor: Door) => {
    setElements((prev) =>
      prev.map((e) => (e.id === updatedDoor.id ? updatedDoor : e)),
    );
    setSelectedDoor(updatedDoor);
  };

  const handleDeleteDoor = (doorId: string) => {
    setElements((prev) => prev.filter((e) => e.id !== doorId));
    setSelectedDoor(null);
    setShowDoorPropertyPanel(false);
    setSelectedIds([]);
  };

  const updateWallPosition = (wallId: string, dx: number, dy: number) => {
    const snappedDx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
    const snappedDy = Math.round(dy / GRID_SIZE) * GRID_SIZE;

    setElements((prev) =>
      prev.map((element) => {
        if (element.type === "wall" && element.id === wallId) {
          const wallElement = element as Wall;
          return {
            ...element,
            startPoint: {
              x: wallElement.startPoint.x + snappedDx,
              y: wallElement.startPoint.y + snappedDy,
            },
            endPoint: {
              x: wallElement.endPoint.x + snappedDx,
              y: wallElement.endPoint.y + snappedDy,
            },
          };
        }

        if (
          (element.type === "door" || element.type === "window") &&
          (element as Door | Window).wallId === wallId
        ) {
          const opening = element as Door | Window;
          return {
            ...element,
            position: {
              x: opening.position.x + snappedDx,
              y: opening.position.y + snappedDy,
            },
          };
        }

        return element;
      }),
    );
  };

  const updateOpeningPosition = (elementId: string, newPos: Point2D) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== elementId) return el;
        if (el.type === "door" || el.type === "window") {
          const opening = el as Door | Window;
          // Prefer current host wall to avoid jumpy re-assignment while dragging.
          let hostWall = opening.wallId
            ? (prev.find(
                (w) => w.id === opening.wallId && w.type === "wall",
              ) as Wall | undefined)
            : undefined;

          // If not attached yet, try nearest wall.
          if (!hostWall) {
            hostWall = findWallAt(newPos);
          }

          // If there is still no host wall, keep the element unchanged so it never disappears.
          if (!hostWall) {
            return el;
          }

          const { position, orientation } = constrainOpeningOnWall(
            newPos,
            hostWall,
            opening.width,
          );

          return {
            ...el,
            position,
            orientation,
            wallId: hostWall.id,
          };
        }
        return el;
      }),
    );
  };

  const getOpeningDragBound = (opening: Door | Window, hostWall: Wall) => {
    return (pos: Point2D) =>
      constrainOpeningOnWall(pos, hostWall, opening.width).position;
  };

  const updateSelectedDoor = (updates: Partial<Door>) => {
    const selectedDoorId = selectedIds.find((id) =>
      elements.some((element) => element.id === id && element.type === "door"),
    );
    if (!selectedDoorId) return;

    setElements((prev) =>
      prev.map((element) => {
        if (element.type === "door" && element.id === selectedDoorId) {
          return { ...(element as Door), ...updates };
        }
        return element;
      }),
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render Elements
  // ─────────────────────────────────────────────────────────

  const renderElement = (element: Element) => {
    switch (element.type) {
      case "wall":
        return renderWall(element as Wall);
      case "door":
        return renderDoor(element as Door);
      case "window":
        return renderWindow(element as Window);
      case "dimension":
        return renderDimension(element as Dimension);
      case "text":
        return renderText(element as TextElement);
      case "stairs":
        return renderStairs(element);
      case "floor":
        return renderFloor(element as Floor);
      case "railing":
        return renderRailing(element);
      case "roof":
        return renderRoof(element);
      case "room":
        return renderRoom(element as Room);
      case "polyline":
        return renderPolyline(element as any);
      case "electrical_fixture":
        return renderElectricalFixture(element as ElectricalFixture);
      default:
        return null;
    }
  };

  const renderPolyline = (poly: any) => {
    const circuitId = poly.metadata?.circuitId || null;
    const isSelected =
      selectedIds.includes(poly.id) ||
      (circuitId ? selectedCircuitIds.has(circuitId) : false);
    const vDrop = poly.metadata?.voltageDropPct || 0;
    const isOverloaded = vDrop > 3.0;
    
    return (
      <Group key={poly.id} onClick={() => setSelectedIds([poly.id])}>
        <Line
          points={poly.points || []}
          stroke={
            isSelected 
              ? "#f59e0b" 
              : isOverloaded 
                ? "#ef4444" 
                : poly.stroke || "#9ca3af"
          }
          strokeWidth={
            isSelected || isOverloaded 
              ? (poly.strokeWidth || 2) + 2 
              : poly.strokeWidth || 2
          }
          lineCap="round"
          lineJoin="round"
        />

        {isSelected && (
          <Line
            points={poly.points || []}
            stroke="#ef4444"
            strokeWidth={(poly.strokeWidth || 2) + 6}
            opacity={0.12}
          />
        )}
      </Group>
    );
  };

  const renderRoom = (room: Room, isPreview = false) => {
    const xs = room.vertices.map((v) => v.x);
    const ys = room.vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;
    const widthMm = Math.round(width * MM_TO_CANVAS);
    const heightMm = Math.round(height * MM_TO_CANVAS);
    const areaLabel = `${(room.properties.area || 0).toFixed(2)} m²`;
    const dimensionLabel = `${formatImperial(widthMm)} x ${formatImperial(heightMm)}`;
    const isSelected = selectedIds.includes(room.id);

    return (
      <Group
        key={room.id}
        x={minX}
        y={minY}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([room.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const nextX = e.target.x();
          const nextY = e.target.y();
          const dx = nextX - minX;
          const dy = nextY - minY;
          setElements((prev) =>
            prev.map((el) => {
              if (el.id !== room.id || el.type !== "room") return el;
              const currentRoom = el as Room;
              return {
                ...currentRoom,
                vertices: currentRoom.vertices.map((vertex) => ({
                  x: vertex.x + dx,
                  y: vertex.y + dy,
                })),
              } as Room;
            }),
          );
          e.target.position({ x: 0, y: 0 });
        }}
      >
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={isSelected ? "rgba(59,130,246,0.12)" : "rgba(148,163,184,0.08)"}
          stroke={isSelected ? "#2563eb" : "#64748b"}
          strokeWidth={2}
          dash={isPreview ? [6, 4] : []}
        />
        <KonvaText
          x={8}
          y={8}
          text={`${room.name} | ${
            roomLabelMode === "area" ? areaLabel : dimensionLabel
          }`}
          fontSize={11}
          fill="#334155"
        />
      </Group>
    );
  };

  const renderWall = (wall: Wall) => {
    return (
      <Group key={wall.id}>
        <Line
          points={[
            wall.startPoint.x,
            wall.startPoint.y,
            wall.endPoint.x,
            wall.endPoint.y,
          ]}
          stroke={wall.color}
          strokeWidth={Math.max(8, wall.thickness / 50)}
          lineCap="round"
          draggable={activeTool === "select"}
          onClick={() => setSelectedIds([wall.id])}
          onDragStart={() => setSelectedIds([wall.id])}
          onDragEnd={(e) => {
            updateWallPosition(wall.id, e.target.x(), e.target.y());
            e.target.position({ x: 0, y: 0 });
          }}
        />
        {selectedIds.includes(wall.id) && (
          <>
            <Circle
              x={wall.startPoint.x}
              y={wall.startPoint.y}
              radius={6}
              fill="red"
            />
            <Circle
              x={wall.endPoint.x}
              y={wall.endPoint.y}
              radius={6}
              fill="red"
            />
          </>
        )}
      </Group>
    );
  };

  const renderDoor = (door: Door, isPreview = false) => {
    const hostWall = walls.find((w) => w.id === door.wallId);
    if (!hostWall && !isPreview) return null;

    // For preview without a host wall, use the preview wall
    const wall = hostWall || previewWall;
    if (!wall) return null;

    const { dir, normal } = getWallDirection(wall);
    const openingWidth = door.width / MM_TO_CANVAS;
    // Match the wall stroke width exactly so the gap covers the wall
    const wallSW = wallStrokeWidth(wall);
    const half = openingWidth / 2;

    const p1 = {
      x: door.position.x - dir.x * half,
      y: door.position.y - dir.y * half,
    };
    const p2 = {
      x: door.position.x + dir.x * half,
      y: door.position.y + dir.y * half,
    };

    const doorStyle = ((door as any).metadata?.door_style || "").toLowerCase();
    const isMultiStyle = doorStyle === "multi";
    const isDoubleStyle =
      door.swingDirection === "double" || doorStyle === "double";

    const insideSign = door.openingSide === "outside" ? 1 : -1;

    const hingePoint = door.swingDirection === "left" ? p1 : p2;
    const arcRotation =
      (Math.atan2(normal.y * insideSign, normal.x * insideSign) * 180) /
        Math.PI -
      (door.swingDirection === "left" ? 90 : 0);

    const leafEnd = {
      x: hingePoint.x + normal.x * insideSign * openingWidth,
      y: hingePoint.y + normal.y * insideSign * openingWidth,
    };

    const leftLeafHinge = p1;
    const rightLeafHinge = p2;
    const halfLeaf = openingWidth / 2;
    const leftLeafEnd = {
      x: leftLeafHinge.x + normal.x * insideSign * halfLeaf,
      y: leftLeafHinge.y + normal.y * insideSign * halfLeaf,
    };
    const rightLeafEnd = {
      x: rightLeafHinge.x + normal.x * insideSign * halfLeaf,
      y: rightLeafHinge.y + normal.y * insideSign * halfLeaf,
    };

    const isSelected = selectedIds.includes(door.id);

    return (
      <Group
        key={isPreview ? "door-preview" : door.id}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => {
          if (!isPreview) {
            setSelectedIds([door.id]);
            setSelectedDoor(door);
            setShowDoorPropertyPanel(true);
          }
        }}
        onDragStart={() => !isPreview && setSelectedIds([door.id])}
        onDragMove={(e) => {
          if (isPreview) return;
          // e.target.position() is the drag delta in world (stage-local) space
          const delta = e.target.position();
          const worldPos = {
            x: door.position.x + delta.x,
            y: door.position.y + delta.y,
          };
          const { position } = constrainOpeningOnWall(
            worldPos,
            wall,
            door.width,
          );
          e.target.position({
            x: position.x - door.position.x,
            y: position.y - door.position.y,
          });
        }}
        onDragEnd={(e) => {
          if (isPreview) return;
          const delta = e.target.position();
          updateOpeningPosition(door.id, {
            x: door.position.x + delta.x,
            y: door.position.y + delta.y,
          });
          e.target.position({ x: 0, y: 0 });
        }}
      >
        {/* White gap that erases the wall line beneath the opening */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#f8fafc"
          strokeWidth={wallSW + 4}
          lineCap="butt"
        />
        {/* Door frame outline */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke={isSelected ? "#ef4444" : "#92400e"}
          strokeWidth={2}
          lineCap="butt"
          dash={[0]}
        />
        {/* Door leaf */}
        {!isDoubleStyle && !isMultiStyle && (
          <>
            <Line
              points={[hingePoint.x, hingePoint.y, leafEnd.x, leafEnd.y]}
              stroke="#7c2d12"
              strokeWidth={2}
            />
            <Arc
              x={hingePoint.x}
              y={hingePoint.y}
              innerRadius={openingWidth - 1}
              outerRadius={openingWidth}
              angle={90}
              rotation={arcRotation}
              stroke="#7c2d12"
              strokeWidth={1.5}
            />
            <Circle
              x={hingePoint.x}
              y={hingePoint.y}
              radius={3}
              fill="#7c2d12"
            />
          </>
        )}

        {isDoubleStyle && !isMultiStyle && (
          <>
            <Line
              points={[
                leftLeafHinge.x,
                leftLeafHinge.y,
                leftLeafEnd.x,
                leftLeafEnd.y,
              ]}
              stroke="#7c2d12"
              strokeWidth={2}
            />
            <Line
              points={[
                rightLeafHinge.x,
                rightLeafHinge.y,
                rightLeafEnd.x,
                rightLeafEnd.y,
              ]}
              stroke="#7c2d12"
              strokeWidth={2}
            />
            <Arc
              x={leftLeafHinge.x}
              y={leftLeafHinge.y}
              innerRadius={halfLeaf - 1}
              outerRadius={halfLeaf}
              angle={90}
              rotation={
                (Math.atan2(normal.y * insideSign, normal.x * insideSign) *
                  180) /
                  Math.PI -
                90
              }
              stroke="#7c2d12"
              strokeWidth={1.2}
            />
            <Arc
              x={rightLeafHinge.x}
              y={rightLeafHinge.y}
              innerRadius={halfLeaf - 1}
              outerRadius={halfLeaf}
              angle={90}
              rotation={
                (Math.atan2(normal.y * insideSign, normal.x * insideSign) *
                  180) /
                Math.PI
              }
              stroke="#7c2d12"
              strokeWidth={1.2}
            />
          </>
        )}

        {isMultiStyle && (
          <>
            <Line
              points={[
                p1.x + dir.x * (openingWidth / 3),
                p1.y + dir.y * (openingWidth / 3),
                p1.x +
                  dir.x * (openingWidth / 3) +
                  normal.x * insideSign * (openingWidth / 2.8),
                p1.y +
                  dir.y * (openingWidth / 3) +
                  normal.y * insideSign * (openingWidth / 2.8),
              ]}
              stroke="#7c2d12"
              strokeWidth={2}
            />
            <Line
              points={[
                p1.x + dir.x * ((2 * openingWidth) / 3),
                p1.y + dir.y * ((2 * openingWidth) / 3),
                p1.x +
                  dir.x * ((2 * openingWidth) / 3) +
                  normal.x * insideSign * (openingWidth / 2.8),
                p1.y +
                  dir.y * ((2 * openingWidth) / 3) +
                  normal.y * insideSign * (openingWidth / 2.8),
              ]}
              stroke="#7c2d12"
              strokeWidth={2}
            />
            <Line
              points={[
                p1.x + dir.x * (openingWidth / 3),
                p1.y + dir.y * (openingWidth / 3),
                p1.x + dir.x * ((2 * openingWidth) / 3),
                p1.y + dir.y * ((2 * openingWidth) / 3),
              ]}
              stroke="#7c2d12"
              strokeWidth={1.6}
              dash={[4, 4]}
            />
          </>
        )}
        {/* Selection highlight rect */}
        {isSelected && !isPreview && (
          <Line
            points={[p1.x, p1.y, p2.x, p2.y]}
            stroke="#ef4444"
            strokeWidth={wallSW + 6}
            lineCap="butt"
            opacity={0.18}
          />
        )}
      </Group>
    );
  };

  const renderWindow = (window_: Window, isPreview = false) => {
    const hostWall = walls.find((w) => w.id === window_.wallId);
    if (!hostWall && !isPreview) return null;

    const wall = hostWall || previewWall;
    if (!wall) return null;

    const { dir } = getWallDirection(wall);
    const width = window_.width / MM_TO_CANVAS;
    const wallSW = wallStrokeWidth(wall);
    const half = width / 2;

    const p1 = {
      x: window_.position.x - dir.x * half,
      y: window_.position.y - dir.y * half,
    };
    const p2 = {
      x: window_.position.x + dir.x * half,
      y: window_.position.y + dir.y * half,
    };

    const isSelected = selectedIds.includes(window_.id);

    return (
      <Group
        key={isPreview ? "window-preview" : window_.id}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([window_.id])}
        onDragStart={() => !isPreview && setSelectedIds([window_.id])}
        onDragMove={(e) => {
          if (isPreview) return;
          const delta = e.target.position();
          const worldPos = {
            x: window_.position.x + delta.x,
            y: window_.position.y + delta.y,
          };
          const { position } = constrainOpeningOnWall(
            worldPos,
            wall,
            window_.width,
          );
          e.target.position({
            x: position.x - window_.position.x,
            y: position.y - window_.position.y,
          });
        }}
        onDragEnd={(e) => {
          if (isPreview) return;
          const delta = e.target.position();
          updateOpeningPosition(window_.id, {
            x: window_.position.x + delta.x,
            y: window_.position.y + delta.y,
          });
          e.target.position({ x: 0, y: 0 });
        }}
      >
        {/* White gap covering full wall thickness */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#f8fafc"
          strokeWidth={wallSW + 4}
          lineCap="butt"
        />
        {/* Outer frame */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke={isSelected ? "#ef4444" : "#0369a1"}
          strokeWidth={wallSW}
          lineCap="butt"
        />
        {/* Glass pane (inner lighter line) */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#bae6fd"
          strokeWidth={Math.max(2, wallSW - 4)}
          lineCap="butt"
        />
        {/* Centre divider */}
        <Line
          points={[
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2 - 0,
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2,
          ]}
          stroke="#0369a1"
          strokeWidth={1.5}
        />
        {/* Selection highlight */}
        {isSelected && !isPreview && (
          <Line
            points={[p1.x, p1.y, p2.x, p2.y]}
            stroke="#ef4444"
            strokeWidth={wallSW + 6}
            lineCap="butt"
            opacity={0.18}
          />
        )}
      </Group>
    );
  };

  const renderDimension = (dim: Dimension) => {
    const dx = dim.endPoint.x - dim.startPoint.x;
    const dy = dim.endPoint.y - dim.startPoint.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy);

    // Normal for offset
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const offset = 20;

    const p1 = {
      x: dim.startPoint.x + nx * offset,
      y: dim.startPoint.y + ny * offset,
    };
    const p2 = {
      x: dim.endPoint.x + nx * offset,
      y: dim.endPoint.y + ny * offset,
    };

    return (
      <Group
        key={dim.id}
        onClick={() => setSelectedIds([dim.id])}
        draggable={activeTool === "select"}
        onDragEnd={(e) => {
          setElements((prev) =>
            prev.map((el) =>
              el.id === dim.id
                ? {
                    ...el,
                    startPoint: {
                      x: (el as Dimension).startPoint.x + e.target.x(),
                      y: (el as Dimension).startPoint.y + e.target.y(),
                    },
                    endPoint: {
                      x: (el as Dimension).endPoint.x + e.target.x(),
                      y: (el as Dimension).endPoint.y + e.target.y(),
                    },
                  }
                : el,
            ),
          );
          e.target.position({ x: 0, y: 0 });
        }}
      >
        {/* Dimension Line */}
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#475569"
          strokeWidth={1}
        />
        {/* Extension Lines */}
        <Line
          points={[dim.startPoint.x, dim.startPoint.y, p1.x, p1.y]}
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        <Line
          points={[dim.endPoint.x, dim.endPoint.y, p2.x, p2.y]}
          stroke="#94a3b8"
          strokeWidth={0.5}
        />
        {/* Tick Marks */}
        <Line
          points={[p1.x - ny * 5, p1.y + nx * 5, p1.x + ny * 5, p1.y - nx * 5]}
          stroke="#475569"
          strokeWidth={1}
          rotation={45}
        />
        <Line
          points={[p2.x - ny * 5, p2.y + nx * 5, p2.x + ny * 5, p2.y - nx * 5]}
          stroke="#475569"
          strokeWidth={1}
          rotation={45}
        />
        {/* Label */}
        <KonvaText
          x={(p1.x + p2.x) / 2}
          y={(p1.y + p2.y) / 2 - 15}
          text={`${formatImperial(dim.value)}`}
          fontSize={11}
          fill="#1e293b"
          align="center"
          rotation={(angle * 180) / Math.PI}
          offsetX={40}
        />
      </Group>
    );
  };

  const renderText = (textEl: TextElement) => {
    return (
      <KonvaText
        key={textEl.id}
        x={textEl.position.x}
        y={textEl.position.y}
        text={textEl.text}
        fontSize={textEl.fontSize}
        fill={textEl.color || "#000"}
        rotation={textEl.rotation}
        draggable={activeTool === "select"}
        onClick={() => setSelectedIds([textEl.id])}
        onDragEnd={(e) => {
          setElements((prev) =>
            prev.map((el) =>
              el.id === textEl.id
                ? { ...el, position: { x: e.target.x(), y: e.target.y() } }
                : el,
            ),
          );
        }}
      />
    );
  };

  const renderFloor = (floor: Floor, isPreview = false) => {
    const isSelected = selectedIds.includes(floor.id);
    const w = floor.width / MM_TO_CANVAS;
    const d = floor.depth / MM_TO_CANVAS;

    return (
      <Group
        key={isPreview ? "floor-preview" : floor.id}
        x={floor.position.x}
        y={floor.position.y}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([floor.id])}
        onDragStart={() => !isPreview && setSelectedIds([floor.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const newPos = { x: e.target.x(), y: e.target.y() };
          setElements((prev) =>
            prev.map((el) =>
              el.id === floor.id ? { ...el, position: newPos } : el,
            ),
          );
        }}
      >
        <Rect
          x={-w / 2}
          y={-d / 2}
          width={w}
          height={d}
          fill={isSelected ? "#bfdbfe" : "#f1f5f9"}
          stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
          strokeWidth={1}
        />
        {/* Simple Tile Grid Pattern in 2D */}
        {[...Array(Math.floor(w / 12))].map((_, i) => (
          <Line
            key={`v-${i}`}
            points={[
              -w / 2 + (i + 1) * 12,
              -d / 2,
              -w / 2 + (i + 1) * 12,
              d / 2,
            ]}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        ))}
        {[...Array(Math.floor(d / 12))].map((_, i) => (
          <Line
            key={`h-${i}`}
            points={[
              -w / 2,
              -d / 2 + (i + 1) * 12,
              w / 2,
              -d / 2 + (i + 1) * 12,
            ]}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        ))}
      </Group>
    );
  };

  const renderRailing = (railing: any, isPreview = false) => {
    const isSelected = selectedIds.includes(railing.id);
    const length = (railing.length || 8000) / MM_TO_CANVAS;
    const style = railing.metadata?.railing_style || "modern";

    return (
      <Group
        key={isPreview ? "railing-preview" : railing.id}
        x={railing.position.x}
        y={railing.position.y}
        rotation={railing.rotation || 0}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([railing.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const newPos = { x: e.target.x(), y: e.target.y() };
          setElements((prev) =>
            prev.map((el) =>
              el.id === railing.id ? { ...el, position: newPos } : el,
            ),
          );
        }}
      >
        {/* Main Rail Line */}
        <Line
          points={[0, 0, length, 0]}
          stroke={isSelected ? "#3b82f6" : "#475569"}
          strokeWidth={4}
        />
        {/* Small perpendicular ticks to represent balusters/posts */}
        {[...Array(Math.floor(length / 20))].map((_, i) => (
          <Line
            key={`baluster-${i}`}
            points={[(i + 1) * 20, -5, (i + 1) * 20, 5]}
            stroke={isSelected ? "#3b82f6" : "#64748b"}
            strokeWidth={1}
          />
        ))}
      </Group>
    );
  };

  const renderRoof = (roof: any, isPreview = false) => {
    const isSelected = selectedIds.includes(roof.id);
    const width = (roof.width || 8000) / MM_TO_CANVAS;
    const depth = (roof.depth || 6000) / MM_TO_CANVAS;

    return (
      <Group
        key={isPreview ? "roof-preview" : roof.id}
        x={roof.position.x}
        y={roof.position.y}
        rotation={roof.rotation || 0}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([roof.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const newPos = { x: e.target.x(), y: e.target.y() };
          setElements((prev) =>
            prev.map((el) =>
              el.id === roof.id ? { ...el, position: newPos } : el,
            ),
          );
        }}
      >
        <Rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          fill="#f8fafc"
          stroke={isSelected ? "#3b82f6" : "#64748b"}
          strokeWidth={2}
          dash={[10, 5]}
          opacity={0.6}
        />
        {/* Diagonal lines to indicate roof plane */}
        <Line
          points={[-width / 2, -depth / 2, width / 2, depth / 2]}
          stroke="#cbd5e1"
          strokeWidth={1}
          dash={[5, 5]}
        />
        <Line
          points={[width / 2, -depth / 2, -width / 2, depth / 2]}
          stroke="#cbd5e1"
          strokeWidth={1}
          dash={[5, 5]}
        />
      </Group>
    );
  };

  const renderElectricalFixture = (
    fixture: ElectricalFixture,
    isPreview = false,
  ) => {
    const circuitId = fixture.circuitId || fixture.metadata?.circuitId || null;
    const isSelected = selectedIds.includes(fixture.id);
    const isCircuitSelected =
      isSelected || (circuitId ? selectedCircuitIds.has(circuitId) : false);
    const kind = fixture.fixtureType;
    const fillByKind: Record<ElectricalFixture["fixtureType"], string> = {
      light: "#facc15",
      socket: "#60a5fa",
      switch: "#34d399",
      emergency_light: "#fb7185",
      stage_light: "#f97316",
    };
    const fill = fillByKind[kind] || fixture.color || "#60a5fa";
    const size = Math.max(
      18,
      Math.min(fixture.width || 30, fixture.height || 30) / 2,
    );
    const label =
      kind === "light"
        ? "L"
        : kind === "socket"
          ? "S"
          : kind === "switch"
            ? "SW"
            : kind === "emergency_light"
              ? "E"
              : "ST";

    return (
      <Group
        key={fixture.id}
        x={fixture.position.x}
        y={fixture.position.y}
        draggable={!isPreview && activeTool === "select"}
        opacity={isPreview ? 0.7 : 1}
        onClick={() =>
          !isPreview &&
          setSelectedIds([fixture.id, ...polylineIdsForFixture(fixture.id)])
        }
        onDragStart={() => !isPreview && setSelectedIds([fixture.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const pos = e.target.position();
          const newPos = { x: pos.x, y: pos.y };
          // Delta from the fixture's original canvas position to its new position
          const dx = newPos.x - fixture.position.x;
          const dy = newPos.y - fixture.position.y;
          setElements((prev) =>
            prev.map((el) => {
              // Move the fixture itself
              if (el.id === fixture.id) {
                return { ...el, position: newPos };
              }
              // Move the branch wire's fixture-end (points[0..1]) by the same delta.
              // points[2..3] (the attach point on the circuit backbone) stays fixed.
              if (
                el.type === "polyline" &&
                ((el as Polyline).metadata?.branchId === fixture.id ||
                  (el as Polyline).metadata?.fixtureId === fixture.id)
              ) {
                const poly = el as Polyline;
                const pts = [...poly.points];
                if (pts.length >= 2) {
                  pts[0] = pts[0] + dx;
                  pts[1] = pts[1] + dy;
                }
                return { ...poly, points: pts };
              }
              return el;
            }),
          );
          e.target.position({ x: 0, y: 0 });
        }}
      >
        {isCircuitSelected && (
          <Circle
            x={0}
            y={0}
            radius={size / 2 + 4}
            stroke="#ef4444"
            strokeWidth={4}
            opacity={0.15}
          />
        )}
        <Circle
          x={0}
          y={0}
          radius={size / 2}
          fill={fill}
          stroke={
            isSelected ? "#ffffff" : isCircuitSelected ? "#f59e0b" : "#0f172a"
          }
          strokeWidth={isSelected ? 3 : isCircuitSelected ? 2.5 : 1.5}
        />
        <KonvaText
          text={label}
          fontSize={10}
          fontStyle="bold"
          fill={isSelected ? "#ffffff" : isCircuitSelected ? "#f59e0b" : "#0f172a"}
          align="center"
          verticalAlign="middle"
          width={size}
          height={size}
          offsetX={size / 2}
          offsetY={5}
        />
      </Group>

    );
  };

  const renderStairs = (stair: any, isPreview = false) => {
    const isSelected = selectedIds.includes(stair.id);
    const style =
      (stair as any).metadata?.stair_style ||
      (stair as any).metadata?.stairStyle ||
      "standard";

    // Straight Parametric Style (Concrete)
    if (style === "concrete_parametric") {
      const steps = parseInt(stair.metadata?.number_of_steps || "8");
      const width = (stair.width || 2400) / 50;
      const tread =
        (parseFloat(stair.metadata?.tread_depth || "0.42") * 1000) / 50;
      const landing =
        (parseFloat(stair.metadata?.landing_depth || "0.65") * 1000) / 50;
      const totalL = steps * tread + landing;

      return (
        <Group
          key={isPreview ? "stair-preview" : stair.id}
          x={stair.position.x}
          y={stair.position.y}
          rotation={stair.rotation || 0}
          opacity={isPreview ? 0.55 : 1}
          draggable={!isPreview && activeTool === "select"}
          onClick={() => !isPreview && setSelectedIds([stair.id])}
          onDragStart={() => !isPreview && setSelectedIds([stair.id])}
          onDragEnd={(e) => {
            if (isPreview) return;
            const newPos = { x: e.target.x(), y: e.target.y() };
            setElements((prev) =>
              prev.map((el) =>
                el.id === stair.id ? { ...el, position: newPos } : el,
              ),
            );
          }}
        >
          {/* Main Footprint */}
          <Rect
            x={0}
            y={-width / 2}
            width={totalL}
            height={width}
            fill="#f8fafc"
            stroke={isSelected ? "#ef4444" : "#64748b"}
            strokeWidth={isSelected ? 2 : 1}
          />
          {/* Step Lines */}
          {[...Array(steps + 1)].map((_, i) => (
            <Line
              key={`step-${i}`}
              points={[i * tread, -width / 2, i * tread, width / 2]}
              stroke="#cbd5e1"
              strokeWidth={1}
            />
          ))}
          {/* Path Arrow */}
          <Line
            points={[tread / 2, 0, totalL - 5, 0]}
            stroke="#b45309"
            strokeWidth={1.5}
          />
          <Line
            points={[totalL - 10, -5, totalL - 5, 0, totalL - 10, 5]}
            stroke="#b45309"
            strokeWidth={1.5}
          />
          <KonvaText
            x={10}
            y={-12}
            text="UP"
            fontSize={8}
            fill="#b45309"
            fontStyle="bold"
          />
        </Group>
      );
    }

    // Default Switchback Style
    const run = 6;
    const treadWidth = 20;
    const flightGap = 2;
    const landingWidth = 24;
    const steps = 9;

    const flightLen = steps * run;
    const totalW = flightLen + landingWidth;
    const totalD = treadWidth * 2 + flightGap;

    return (
      <Group
        key={isPreview ? "stair-preview" : stair.id}
        x={stair.position.x}
        y={stair.position.y}
        rotation={stair.rotation || 0}
        opacity={isPreview ? 0.55 : 1}
        draggable={!isPreview && activeTool === "select"}
        onClick={() => !isPreview && setSelectedIds([stair.id])}
        onDragStart={() => !isPreview && setSelectedIds([stair.id])}
        onDragEnd={(e) => {
          if (isPreview) return;
          const newPos = { x: e.target.x(), y: e.target.y() };
          setElements((prev) =>
            prev.map((el) =>
              el.id === stair.id ? { ...el, position: newPos } : el,
            ),
          );
        }}
      >
        {/* Main Footprint */}
        <Rect
          x={0}
          y={-totalD / 2}
          width={totalW}
          height={totalD}
          fill="#f8fafc"
          stroke={isSelected ? "#ef4444" : "#64748b"}
          strokeWidth={isSelected ? 2 : 1}
        />

        {/* Lower Flight Steps */}
        {[...Array(steps + 1)].map((_, i) => (
          <Line
            key={`lower-${i}`}
            points={[i * run, -totalD / 2, i * run, -totalD / 2 + treadWidth]}
            stroke="#94a3b8"
            strokeWidth={1}
          />
        ))}

        {/* Upper Flight Steps */}
        {[...Array(steps + 1)].map((_, i) => (
          <Line
            key={`upper-${i}`}
            points={[i * run, totalD / 2, i * run, totalD / 2 - treadWidth]}
            stroke="#94a3b8"
            strokeWidth={1}
          />
        ))}

        {/* Landing Split Line */}
        <Line
          points={[flightLen, -totalD / 2, flightLen, totalD / 2]}
          stroke="#94a3b8"
          strokeWidth={1}
        />

        {/* Path Arrow */}
        <Line
          points={[
            run / 2,
            -totalD / 4,
            flightLen + landingWidth / 2,
            -totalD / 4,
            flightLen + landingWidth / 2,
            totalD / 4,
            run / 2,
            totalD / 4,
          ]}
          stroke="#b45309"
          strokeWidth={1.5}
          lineCap="round"
          lineJoin="round"
        />
        <Line
          points={[
            run,
            totalD / 4 - 4,
            run / 2,
            totalD / 4,
            run,
            totalD / 4 + 4,
          ]}
          stroke="#b45309"
          strokeWidth={1.5}
        />

        <KonvaText
          x={5}
          y={-totalD / 4 - 12}
          text="UP"
          fontSize={8}
          fill="#b45309"
          fontStyle="bold"
        />

        {/* Dimensions Hint */}
        {isSelected && (
          <KonvaText
            x={0}
            y={totalD / 2 + 5}
            text={`${steps + steps} Steps | 1.0m Width`}
            fontSize={10}
            fill="#64748b"
          />
        )}
      </Group>
    );
  };

  const getFurnitureColor = (assetType: string): string => {
    const colorMap: Record<string, string> = {
      Chair: "#8B4513", // Saddle brown
      Sofa: "#A9A9A9", // Dark gray
      Table: "#CD853F", // Peru
      TV: "#2F4F4F", // Dark slate gray
      Bed: "#FFB6C1", // Light pink
      Cabinet: "#8B4513", // Saddle brown
      Desk: "#A0826D", // Brown
      Bookshelf: "#654321", // Dark brown
    };
    return colorMap[assetType] || "#666666"; // Default gray
  };

  const renderFurniture = (item: FurnitureItem) => {
    // Convert from meters back to canvas coordinates
    const x = item.x * MM_TO_CANVAS;
    const y = item.y * MM_TO_CANVAS;
    const width = (item.width || 1) * MM_TO_CANVAS;
    const depth = (item.depth || 1) * MM_TO_CANVAS;
    const color = getFurnitureColor(item.assetType);

    return (
      <Group
        key={item.id}
        onClick={() => setSelectedIds([item.id])}
        draggable={activeTool === "select"}
        onDragStart={() => setSelectedIds([item.id])}
        onDragEnd={(e) => {
          // Konva drag position is a delta for this group (its children use
          // absolute coordinates), so apply delta to the current model coords.
          const deltaX = e.target.x() / MM_TO_CANVAS;
          const deltaY = e.target.y() / MM_TO_CANVAS;
          const newX = item.x + deltaX;
          const newY = item.y + deltaY;

          // Update local state
          setFurnitureItems((prev) =>
            prev.map((furn) =>
              furn.id === item.id ? { ...furn, x: newX, y: newY } : furn,
            ),
          );

          // Reset target position
          e.target.position({ x: 0, y: 0 });

          // Save to backend
          fetch(`/api/projects/${projectId}/furniture/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              x: newX,
              y: newY,
              z: item.z,
            }),
          }).catch((error) => {
            console.error("Failed to update furniture position:", error);
          });
        }}
      >
        {/* Furniture Rectangle */}
        <Rect
          x={x - width / 2}
          y={y - depth / 2}
          width={width}
          height={depth}
          fill={color}
          stroke={selectedIds.includes(item.id) ? "#ef4444" : "#333333"}
          strokeWidth={selectedIds.includes(item.id) ? 3 : 2}
          opacity={0.8}
          rotation={item.z || 0}
        />

        {/* Furniture Label */}
        <KonvaText
          x={x}
          y={y - 12}
          text={item.family}
          fontSize={10}
          fill="#ffffff"
          align="center"
          offsetX={0}
          rotation={item.z || 0}
        />
      </Group>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-800">
      {/* Toolbar */}
      <div className="bg-slate-200 border-b-2 border-gray-400 px-4 py-2 flex items-center gap-4 overflow-x-auto shadow-md">
        {/* Navigation Group */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-md border-2 border-gray-400 shadow-sm">
          <button
            onClick={() => setActiveTool("select")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "select" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Select"
          >
            <Move className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Select
            </span>
          </button>
          <button
            onClick={() => setActiveTool("pan")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "pan" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Pan"
          >
            <Hand className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Pan
            </span>
          </button>
        </div>

        {/* Drawing Group */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-md border-2 border-gray-400 shadow-sm">
          <button
            onClick={() => setActiveTool("wall")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "wall" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Wall (W)"
          >
            <Square className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Wall
            </span>
          </button>
          <button
            onClick={() => setActiveTool("door")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "door" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Door (D)"
          >
            <DoorIcon size={20} />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Door
            </span>
          </button>
          <button
            onClick={() => setActiveTool("window")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "window" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Window (N)"
          >
            <Layout size={20} />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Window
            </span>
          </button>
          <button
            onClick={() => setActiveTool("room")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "room" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Room / Area (R)"
          >
            <Square className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Room
            </span>
          </button>
          <button
            onClick={() => setActiveTool("stairs")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "stairs" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Stairs (S)"
          >
            <StairsIcon size={20} />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Stairs
            </span>
          </button>
          <button
            onClick={() => setActiveTool("floor")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "floor" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Floor (F)"
          >
            <FloorIcon size={20} />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Floor
            </span>
          </button>
          <button
            onClick={() => setActiveTool("railing")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "railing" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Railing (R)"
          >
            <RailingIcon className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Rail
            </span>
          </button>
          <button
            onClick={() => setActiveTool("roof")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "roof" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Roof (U)"
          >
            <RoofIcon size={20} />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Roof
            </span>
          </button>
          <button
            onClick={() => setActiveTool("furniture")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "furniture" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Furniture (F)"
          >
            <Package2 className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Item
            </span>
          </button>
        </div>

        {/* Annotation Group */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-md border-2 border-gray-400 shadow-sm">
          <button
            onClick={() => setActiveTool("dimension")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "dimension" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Dimension (L)"
          >
            <Ruler className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Dim
            </span>
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${activeTool === "text" ? "bg-blue-700 text-white shadow-inner" : "hover:bg-gray-100 text-gray-800"}`}
            title="Text (T)"
          >
            <Type className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Text
            </span>
          </button>
        </div>

        {/* Contextual Options Bar */}
        {(activeTool === "wall" ||
          activeTool === "door" ||
          activeTool === "window" ||
          activeTool === "room" ||
          activeTool === "stairs" ||
          activeTool === "floor" ||
          activeTool === "roof" ||
          activeTool === "railing" ||
          activeTool === "furniture") && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border-2 border-blue-200 rounded-md animate-in slide-in-from-left-2 duration-200 shadow-sm">
            {activeTool === "wall" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Wall Style:
                </span>
                <select
                  value={selectedWallMaterial}
                  onChange={(e) => setSelectedWallMaterial(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="Standard">Standard Wall</option>
                  <option value="Red Brick">Red Brick Wall</option>
                  <option value="CMU Block">CMU Block Wall</option>
                  <option value="Glass">Glass Partition</option>
                  <option value="Wooden Slat">Wooden Slat Wall</option>
                  <option value="Steel">Steel Panel</option>
                  <option value="Wood Frame">Wood Frame</option>
                  <optgroup label="Partition Walls">
                    <option value="clear_glass_partition">
                      Clear Glass Partition
                    </option>
                    <option value="frosted_glass_partition">
                      Frosted Glass Partition
                    </option>
                    <option value="ribbed_glass_partition">
                      Ribbed Glass Partition
                    </option>
                    <option value="smoked_glass_partition">
                      Smoked Glass Partition
                    </option>
                    <option value="gradient_glass_partition">
                      Gradient Glass Partition
                    </option>
                    <option value="colored_laminated_partition">
                      Colored Laminated Partition
                    </option>
                    <option value="oak_slat_partition">
                      Oak Slat Partition
                    </option>
                    <option value="ash_wood_partition">
                      Ash Wood Partition
                    </option>
                    <option value="matte_black_wood_partition">
                      Matte Black Wood Partition
                    </option>
                  </optgroup>
                  <optgroup label="Compound Walls">
                    <option value="exposed_concrete_compound">
                      Exposed Concrete Compound
                    </option>
                    <option value="natural_stone_compound">
                      Natural Stone Compound
                    </option>
                    <option value="wooden_slat_compound">
                      Wooden Slat Compound
                    </option>
                    <option value="brick_texture_compound">
                      Brick Texture Compound
                    </option>
                  </optgroup>
                </select>
              </>
            )}
            {activeTool === "door" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Door Style:
                </span>
                <select
                  value={selectedDoorModelUrl || ""}
                  onChange={(e) => setSelectedDoorModelUrl(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="">Standard BIM Door</option>
                  <option value="LUXURY_MODERN_V1">Luxury Modern Door</option>
                  <option value="MODERN_WOOD_INLAY_V1">
                    Modern Wood Inlay
                  </option>
                  <option value="SLATTED_PIVOT_V1">Slatted Pivot Door</option>
                  <option value="CLASSIC_DOUBLE_V1">Classic Double Door</option>
                  <option value="MANDALA_DOUBLE_V1">Mandala Double Door</option>
                  <option value="SLIM_BLACK_GLASS_V1">Modern Wood Glass</option>
                  <option value="GEOMETRIC_DOUBLE_GLASS_V1">
                    Geometric Double Glass
                  </option>
                  <option value="LUXURY_WHITE_GOLD_V1">
                    Luxury White & Gold
                  </option>
                  <option value="MODERN_SLIDING_GLASS_V1">
                    Modern Sliding Glass
                  </option>
                  {doorLibrary.map((d) => (
                    <option key={d.path} value={d.raw_url || d.download_url}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTool === "window" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Window Style:
                </span>
                <select
                  value={selectedWindowModelUrl || ""}
                  onChange={(e) =>
                    setSelectedWindowModelUrl(e.target.value || null)
                  }
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="">Standard BIM Window</option>
                  <option value="DOUBLE_CASEMENT_TRANSOM_V1">
                    Double Casement Transom
                  </option>
                  <option value="MODERN_SLIDING_V1">
                    Modern Sliding Glass
                  </option>
                  {windowLibrary.map((w) => (
                    <option key={w.path} value={w.raw_url || w.download_url}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTool === "stairs" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Stair Style:
                </span>
                <select
                  value={selectedStairModelUrl || ""}
                  onChange={(e) => setSelectedStairModelUrl(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="FLOATING_SWITCHBACK_V1">
                    Floating Switchback
                  </option>
                  <option value="SPIRAL_METAL_V1">Spiral Metal</option>
                  <option value="CONCRETE_PARAMETRIC_V1">
                    Concrete Parametric
                  </option>

                  {stairLibrary.map((s) => (
                    <option key={s.path} value={s.raw_url || s.download_url}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTool === "roof" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Roof Style:
                </span>
                <select
                  value={selectedRoofStyle}
                  onChange={(e) => setSelectedRoofStyle(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="modern_flat">Modern Flat Roof</option>
                  <option value="soft_rounded">Soft Rounded Roof</option>
                  <option value="sloped_tile">Sloped Tile Roof</option>
                  <option value="symmetric_gable">Symmetric Gable</option>
                  <option value="thatched">Thatched Roof</option>
                </select>
              </>
            )}

            {activeTool === "railing" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Railing Style:
                </span>
                <select
                  value={selectedRailingModelUrl || ""}
                  onChange={(e) => setSelectedRailingModelUrl(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="">Modern Metal</option>
                  <option value="horizontal">Horizontal Metal</option>
                  <option value="glass">Glass Panel</option>
                  <option value="tree_branch">Tree Branch Railing</option>
                </select>
              </>
            )}

            {activeTool === "floor" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Floor Style:
                </span>
                <select
                  value={selectedFloorModelUrl || ""}
                  onChange={(e) => setSelectedFloorModelUrl(e.target.value)}
                  className="min-w-35 max-w-55 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="MARBLE_VITRIFIED_V1">Marble Vitrified</option>
                  <option value="CONCRETE_TILE_V1">Concrete Tile</option>
                  <option value="DECORATIVE_MEDALLION_V1">
                    Decorative Medallion
                  </option>
                  <option value="LUXURY_STONE_V1">Luxury Stone</option>
                  <option value="CHECKER_CERAMIC_V1">Checker Ceramic</option>
                  {floorLibrary.map((f) => (
                    <option key={f.path} value={f.raw_url || f.download_url}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTool === "furniture" && (
              <>
                <span className="text-[10px] uppercase font-black text-blue-500">
                  Library:
                </span>
                <select
                  value={selectedFurnitureType || ""}
                  onChange={(e) =>
                    setSelectedFurnitureType(e.target.value || null)
                  }
                  className="min-w-35 text-xs border-none bg-transparent focus:ring-0 font-bold text-blue-900 cursor-pointer"
                >
                  <option value="">Select Furniture...</option>
                  {furnitureLibrary.map((item) => (
                    <option
                      key={`${item.asset_type}_${item.family}`}
                      value={`${item.asset_type}_${item.family}`}
                    >
                      {item.asset_type} - {item.family}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {!selectedLevelId && !isLoadingLevels && levels.length > 0 && (
          <div className="text-xs text-red-600 font-medium">
            Level not ready
          </div>
        )}

        {/* Level Selector */}
        <div className="mx-2 h-6 w-px bg-gray-300" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">Level:</span>
          <select
            value={selectedLevelId || ""}
            onChange={(e) => setSelectedLevelId(e.target.value || null)}
            className="min-w-36 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white shadow-sm"
            disabled={isLoadingLevels}
          >
            {!selectedLevelId && <option value="">Select level...</option>}
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} (Elev. {level.elevation_m}m)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">Room Label:</span>
          <button
            type="button"
            onClick={() =>
              setRoomLabelMode((prev) =>
                prev === "area" ? "dimensions" : "area",
              )
            }
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            title="Toggle room label between area and dimensions"
          >
            {roomLabelMode === "area" ? "Area" : "Dimensions"}
          </button>
        </div>

        {(() => {
          const selectedWall = elements.find(
            (element) =>
              selectedIds.includes(element.id) && element.type === "wall",
          ) as Wall | undefined;

          if (!selectedWall) return null;

          return (
            <>
              <div className="mx-2 h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-1 text-xs text-gray-700">
                <span className="mr-1 font-medium">Wall:</span>
                <button
                  onClick={() => {
                    const thickness = Number(
                      prompt(
                        "Enter wall thickness (mm):",
                        selectedWall.thickness.toString(),
                      ),
                    );
                    if (thickness && !isNaN(thickness)) {
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === selectedWall.id ? { ...el, thickness } : el,
                        ),
                      );
                    }
                  }}
                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  Thickness
                </button>
              </div>
            </>
          );
        })()}

        {(() => {
          const selectedDoor = elements.find(
            (element) =>
              selectedIds.includes(element.id) && element.type === "door",
          ) as Door | undefined;

          if (!selectedDoor) return null;

          return (
            <>
              <div className="mx-2 h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-1 text-xs text-gray-700">
                <span className="mr-1 font-medium">Door:</span>
                <select
                  value={
                    (selectedDoor as any).metadata?.door_model_url ||
                    (selectedDoor as any).metadata?.doorModelUrl ||
                    ""
                  }
                  onChange={(e) => {
                    const url = e.target.value || null;
                    const preset = deriveDoorPreset(url);
                    setElements((prev) =>
                      prev.map((el) => {
                        if (el.id !== selectedDoor.id || el.type !== "door") {
                          return el;
                        }

                        const currentDoor = el as Door;
                        const hostWall = currentDoor.wallId
                          ? (prev.find(
                              (w) =>
                                w.type === "wall" &&
                                w.id === currentDoor.wallId,
                            ) as Wall | undefined)
                          : undefined;
                        const constrained = constrainOpeningOnWall(
                          currentDoor.position,
                          hostWall,
                          preset.width,
                        );

                        return {
                          ...el,
                          width: preset.width,
                          height: preset.height,
                          position: constrained.position,
                          orientation: constrained.orientation,
                          swingDirection: preset.swingDirection,
                          openingSide: preset.openingSide,
                          material: preset.material,
                          metadata: {
                            ...el.metadata,
                            door_model_url: url,
                            door_style: preset.doorStyle,
                          },
                        };
                      }),
                    );
                  }}
                  className="border rounded px-2 py-1 bg-white text-sm max-w-30"
                >
                  <option value="">Default</option>
                  {doorLibrary.map((d) => (
                    <option key={d.path} value={d.raw_url || d.download_url}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    updateSelectedDoor({
                      swingDirection:
                        selectedDoor.swingDirection === "left"
                          ? "right"
                          : "left",
                    })
                  }
                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  title="Toggle hinge left/right"
                >
                  Hinge{" "}
                  {selectedDoor.swingDirection === "left" ? "Left" : "Right"}
                </button>
                <button
                  onClick={() =>
                    updateSelectedDoor({
                      openingSide:
                        selectedDoor.openingSide === "outside"
                          ? "inside"
                          : "outside",
                    })
                  }
                  className="px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  title="Toggle inside/outside opening"
                >
                  Open{" "}
                  {selectedDoor.openingSide === "outside"
                    ? "Outside"
                    : "Inside"}
                </button>
              </div>
            </>
          );
        })()}

        {(() => {
          const selectedWindow = elements.find(
            (element) =>
              selectedIds.includes(element.id) && element.type === "window",
          ) as Window | undefined;

          if (!selectedWindow) return null;

          return (
            <>
              <div className="mx-2 h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-1 text-xs text-gray-700">
                <span className="mr-1 font-medium">Window:</span>
                <select
                  value={
                    (selectedWindow as any).metadata?.window_model_url ||
                    (selectedWindow as any).metadata?.windowModelUrl ||
                    ""
                  }
                  onChange={(e) => {
                    const url = e.target.value || null;
                    const preset = deriveWindowPreset(url);
                    setElements((prev) =>
                      prev.map((el) => {
                        if (
                          el.id !== selectedWindow.id ||
                          el.type !== "window"
                        ) {
                          return el;
                        }

                        const currentWindow = el as Window;
                        const hostWall = currentWindow.wallId
                          ? (prev.find(
                              (w) =>
                                w.type === "wall" &&
                                w.id === currentWindow.wallId,
                            ) as Wall | undefined)
                          : undefined;
                        const constrained = constrainOpeningOnWall(
                          currentWindow.position,
                          hostWall,
                          preset.width,
                        );

                        return {
                          ...el,
                          width: preset.width,
                          height: preset.height,
                          position: constrained.position,
                          orientation: constrained.orientation,
                          material: preset.material,
                          glazing: preset.glazing,
                          metadata: {
                            ...el.metadata,
                            window_model_url: url,
                            window_style: preset.windowStyle,
                          },
                        };
                      }),
                    );
                  }}
                  className="border rounded px-2 py-1 bg-white text-sm max-w-30"
                >
                  <option value="">Default</option>
                  {windowLibrary.map((w) => (
                    <option key={w.path} value={w.raw_url || w.download_url}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          );
        })()}

        <button
          onClick={() => setActiveTool("pan")}
          className={`p-2.5 rounded ${activeTool === "pan" ? "bg-blue-500 text-white" : "bg-white"}`}
          title="Pan"
        >
          <Hand className="w-5 h-5" />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom * 1.2)}
            className="p-2 bg-white rounded hover:bg-gray-200"
          >
            <Plus className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom * 0.8)}
            className="p-2 bg-white rounded hover:bg-gray-200"
          >
            <Minus className="w-5 h-5" />
          </button>
          <button
            onClick={deleteSelected}
            className="p-2 bg-red-100 rounded hover:bg-red-200"
            title="Delete"
          >
            <Trash2 className="w-5 h-5 text-red-600" />
          </button>
          <button
            onClick={handleSave}
            className="p-2 bg-green-100 rounded hover:bg-green-200"
            title="Save"
          >
            <Save className="w-5 h-5 text-green-600" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasWrapRef}
        className="flex-1 bg-gray-50 relative overflow-hidden"
      >
        <Stage
          ref={stageRef}
          width={viewport.width}
          height={viewport.height}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.evt.preventDefault()}
          scale={{ x: zoom, y: zoom }}
        >
          <Layer ref={layerRef}>
            {/* Grid */}
            {Array.from({ length: 100 }).map((_, i) => (
              <Line
                key={`gridV${i}`}
                points={[GRID_SIZE * i, -5000, GRID_SIZE * i, 5000]}
                stroke="#e0e0e0"
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: 100 }).map((_, i) => (
              <Line
                key={`gridH${i}`}
                points={[-5000, GRID_SIZE * i, 5000, GRID_SIZE * i]}
                stroke="#e0e0e0"
                strokeWidth={0.5}
              />
            ))}

            {/* Elements */}
            {elements.map(renderElement)}

            {/* Furniture Items */}
            {furnitureItems
              .filter(
                (item) => !selectedLevelId || item.levelId === selectedLevelId,
              )
              .map(renderFurniture)}

            {/* Wall preview while drawing */}
            {isDrawing && activeTool === "wall" && startPoint && endPoint && (
              <Group>
                <Line
                  points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
                  stroke="#999"
                  strokeWidth={4}
                  opacity={0.5}
                />
                <KonvaText
                  x={(startPoint.x + endPoint.x) / 2}
                  y={(startPoint.y + endPoint.y) / 2 - 20}
                  text={`${Math.round(Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) * MM_TO_CANVAS)} mm (${formatImperial(Math.round(Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) * MM_TO_CANVAS))})`}
                  fontSize={11}
                  fill="#444"
                />
              </Group>
            )}

            {/* Door ghost preview */}
            {activeTool === "door" &&
              previewPos &&
              (() => {
                const preset = deriveDoorPreset(selectedDoorModelUrl);
                return renderDoor(
                  {
                    id: "__preview__",
                    type: "door",
                    position: previewPos,
                    width: preset.width,
                    height: preset.height,
                    swingDirection: preset.swingDirection,
                    wallId: previewWall?.id,
                    orientation: 0,
                    openingSide: preset.openingSide,
                    material: preset.material,
                    metadata: { door_style: preset.doorStyle },
                    fireRating: "-",
                  } as Door,
                  true,
                );
              })()}

            {/* Window ghost preview */}
            {activeTool === "window" &&
              previewPos &&
              renderWindow(
                {
                  id: "__preview__",
                  type: "window",
                  position: previewPos,
                  width: 1200,
                  height: 1200,
                  wallId: previewWall?.id,
                  orientation: 0,
                  material: "Glass",
                  glazing: "Clear",
                } as Window,
                true,
              )}

            {/* Room ghost preview */}
            {activeTool === "room" && isDrawing && startPoint && endPoint && (
              <Group>
                <Rect
                  x={Math.min(startPoint.x, endPoint.x)}
                  y={Math.min(startPoint.y, endPoint.y)}
                  width={Math.max(20, Math.abs(endPoint.x - startPoint.x))}
                  height={Math.max(20, Math.abs(endPoint.y - startPoint.y))}
                  fill="rgba(59,130,246,0.10)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dash={[6, 4]}
                />
                <KonvaText
                  x={Math.min(startPoint.x, endPoint.x) + 8}
                  y={Math.min(startPoint.y, endPoint.y) + 8}
                  text={`${Math.round(Math.abs(endPoint.x - startPoint.x) * MM_TO_CANVAS)} mm × ${Math.round(Math.abs(endPoint.y - startPoint.y) * MM_TO_CANVAS)} mm`}
                  fontSize={11}
                  fill="#1d4ed8"
                />
              </Group>
            )}

            {/* Stair ghost preview */}
            {activeTool === "stairs" &&
              previewPos &&
              renderStairs(
                {
                  id: "__preview__",
                  type: "stairs",
                  position: previewPos,
                  width: 2050,
                  height: 2450,
                },
                true,
              )}

            {/* Floor ghost preview */}
            {activeTool === "floor" &&
              previewPos &&
              renderFloor(
                {
                  id: "__preview__",
                  type: "floor",
                  position: previewPos,
                  width: deriveFloorPreset(selectedFloorModelUrl).width,
                  depth: deriveFloorPreset(selectedFloorModelUrl).depth,
                } as Floor,
                true,
              )}

            {/* Roof ghost preview */}
            {activeTool === "roof" &&
              previewPos &&
              renderRoof(
                {
                  id: "__preview__",
                  type: "roof",
                  position: previewPos,
                  width: deriveRoofPreset(selectedRoofStyle).width,
                  depth: deriveRoofPreset(selectedRoofStyle).depth,
                } as Roof,
                true,
              )}

            {isDrawing &&
              activeTool === "dimension" &&
              startPoint &&
              endPoint && (
                <Line
                  points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[5, 5]}
                />
              )}
          </Layer>
        </Stage>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-200 border-t border-gray-300 px-4 py-2 text-sm text-gray-700">
        <span>Elements: {elements.length} | </span>
        <span>
          Walls: {elements.filter((e) => e.type === "wall").length} |{" "}
        </span>
        <span>
          Doors: {elements.filter((e) => e.type === "door").length} |{" "}
        </span>
        <span>
          Windows: {elements.filter((e) => e.type === "window").length} |{" "}
        </span>
        <span>
          Furniture:{" "}
          {
            furnitureItems.filter(
              (item) => !selectedLevelId || item.levelId === selectedLevelId,
            ).length
          }
        </span>
      </div>
    </div>
  );
}