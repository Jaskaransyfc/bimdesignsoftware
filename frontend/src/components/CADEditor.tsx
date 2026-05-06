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
  Dimension,
  TextElement,
  Point2D,
  ToolType,
  Level,
  FurnitureItem,
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
} from "lucide-react";
import { formatImperial } from "@/lib/calculations";

interface CADEditorProps {
  projectId: string;
  onSave?: (elements: Element[]) => void;
  onElementsChange?: (elements: Element[]) => void;
  initialElements?: Element[];
}

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

export default function CADEditor({
  projectId,
  onSave,
  onElementsChange,
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

  // Levels and Furniture
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [furnitureLibrary, setFurnitureLibrary] = useState<any[]>([]);
  const [doorLibrary, setDoorLibrary] = useState<any[]>([]);
  const [windowLibrary, setWindowLibrary] = useState<any[]>([]);
  const [selectedDoorModelUrl, setSelectedDoorModelUrl] = useState<
    string | null
  >(null);
  const [selectedWindowModelUrl, setSelectedWindowModelUrl] = useState<
    string | null
  >(null);
  const [customDoorUrl, setCustomDoorUrl] = useState<string>("");
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<
    string | null
  >(null);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const [isSavingFurniture, setIsSavingFurniture] = useState(false);

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
    }
  };

  const handleMouseMove = (e: any) => {
    const pos = snapToGrid(getMousePos(e));
    if (activeTool === "wall" && isDrawing) {
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
      default:
        return null;
    }
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
        onClick={() => !isPreview && setSelectedIds([door.id])}
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
        {(activeTool === "door" ||
          activeTool === "window" ||
          activeTool === "furniture") && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border-2 border-blue-200 rounded-md animate-in slide-in-from-left-2 duration-200 shadow-sm">
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
                  {windowLibrary.map((w) => (
                    <option key={w.path} value={w.raw_url || w.download_url}>
                      {w.name}
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
