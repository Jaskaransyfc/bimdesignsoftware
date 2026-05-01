"use client";

import React, { useRef, useEffect, useState } from "react";
import { Line, Rect, Circle, Stage, Layer, Group, Arc, Text as KonvaText } from "react-konva";
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
} from "@/types/modeling";
import { Plus, Minus, Trash2, Save, Square, Move, Hand, Type, Ruler, DoorOpen as DoorIcon, Layout } from "lucide-react";
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

const snapToGrid = (p: Point2D): Point2D => ({
  x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
});

const clamp = (v: number, min: number, max: number): number => {
  if (v < min) return min;
  if (v > max) return max;
  return v;
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
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    setElements(initialElements);
  }, [initialElements]);

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
    let nearest: Wall | null = null;
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
    const openingHalf = (openingWidthMm / MM_TO_CANVAS) / 2;
    
    const hit = projectPointOnWall(p, wall);
    
    // Snapping logic - snap to center
    let t = hit.t;
    if (Math.abs(t - 0.5) < 0.05) t = 0.5;

    // Clamp distance to keep the opening fully within the wall
    const snappedDistance = clamp(
      t * len, 
      openingHalf, 
      len - openingHalf
    );

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
      
      const openingWidth = activeTool === "door" ? 900 : 1200;
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
              width: openingWidth,
              height: 2100,
              swingDirection: "right",
              wallId: hostWall?.id,
              orientation,
              openingSide: "inside",
              material: "Wood",
              fireRating: "-"
            }
          : {
              id: `win_${Date.now()}`,
              type: "window",
              position,
              width: openingWidth,
              height: 1200,
              wallId: hostWall?.id,
              orientation,
              material: "Glass",
              glazing: "Clear"
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
    }
  };

  const handleMouseMove = (e: any) => {
    const pos = snapToGrid(getMousePos(e));
    if (activeTool === "wall" && isDrawing) {
      setEndPoint(pos);
    } else if (activeTool === "dimension" && isDrawing) {
      setEndPoint(pos);
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
          // Try to find a new wall at the mouse position
          let hostWall = findWallAt(newPos);
          
          // If no new wall found, but it was already on a wall, keep it on the same wall
          if (!hostWall && opening.wallId) {
            hostWall = prev.find(w => w.id === opening.wallId && w.type === "wall") as Wall;
          }

          if (!hostWall) {
            return { ...el, position: newPos, wallId: undefined };
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

  const renderDoor = (door: Door) => {
    const hostWall = walls.find((w) => w.id === door.wallId);
    if (!hostWall) return null;

    const { dir, normal } = getWallDirection(hostWall);
    const openingWidth = door.width / MM_TO_CANVAS;
    const openingDepth = Math.max(10, hostWall.thickness / 35);
    const half = openingWidth / 2;

    const p1 = {
      x: door.position.x - dir.x * half,
      y: door.position.y - dir.y * half,
    };
    const p2 = {
      x: door.position.x + dir.x * half,
      y: door.position.y + dir.y * half,
    };

    const hingePoint = door.swingDirection === "left" ? p1 : p2;
    const insideSign = door.openingSide === "outside" ? 1 : -1;
    const arcRotation =
      (Math.atan2(normal.y * insideSign, normal.x * insideSign) * 180) /
        Math.PI -
      (door.swingDirection === "left" ? 90 : 0);

    const leafEnd = {
      x: hingePoint.x + normal.x * insideSign * openingWidth,
      y: hingePoint.y + normal.y * insideSign * openingWidth,
    };

    return (
      <Group key={door.id}>
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#f8fafc"
          strokeWidth={openingDepth + 2}
          lineCap="round"
        />
        <Line
          points={[hingePoint.x, hingePoint.y, leafEnd.x, leafEnd.y]}
          stroke="#7c2d12"
          strokeWidth={2.5}
        />
        <Arc
          x={hingePoint.x}
          y={hingePoint.y}
          innerRadius={openingWidth - 0.5}
          outerRadius={openingWidth}
          angle={90}
          rotation={arcRotation}
          stroke="#7c2d12"
          strokeWidth={2}
        />
        <Circle
          x={door.position.x}
          y={door.position.y}
          radius={Math.max(8, openingDepth / 2)}
          fill={selectedIds.includes(door.id) ? "#ef4444" : "#8B4513"}
          stroke="#111827"
          strokeWidth={2}
          draggable={activeTool === "select"}
          onClick={() => setSelectedIds([door.id])}
          onDragStart={() => setSelectedIds([door.id])}
          onDragEnd={(e) => {
            updateOpeningPosition(door.id, {
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
        />
      </Group>
    );
  };

  const renderWindow = (window_: Window) => {
    const hostWall = walls.find((w) => w.id === window_.wallId);
    if (!hostWall) return null;

    const { dir } = getWallDirection(hostWall);
    const width = window_.width / MM_TO_CANVAS;
    const depth = Math.max(10, hostWall.thickness / 45);
    const half = width / 2;

    const p1 = {
      x: window_.position.x - dir.x * half,
      y: window_.position.y - dir.y * half,
    };
    const p2 = {
      x: window_.position.x + dir.x * half,
      y: window_.position.y + dir.y * half,
    };

    return (
      <Group key={window_.id}>
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#0ea5e9"
          strokeWidth={depth + 4}
          lineCap="round"
        />
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#e0f2fe"
          strokeWidth={Math.max(4, depth - 2)}
          lineCap="round"
        />
        <Circle
          x={window_.position.x}
          y={window_.position.y}
          radius={Math.max(7, depth / 2)}
          fill={selectedIds.includes(window_.id) ? "#ef4444" : "#0ea5e9"}
          stroke="#082f49"
          strokeWidth={2}
          draggable={activeTool === "select"}
          onClick={() => setSelectedIds([window_.id])}
          onDragStart={() => setSelectedIds([window_.id])}
          onDragEnd={(e) => {
            updateOpeningPosition(window_.id, {
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
        />
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

    const p1 = { x: dim.startPoint.x + nx * offset, y: dim.startPoint.y + ny * offset };
    const p2 = { x: dim.endPoint.x + nx * offset, y: dim.endPoint.y + ny * offset };

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
                    startPoint: { x: (el as Dimension).startPoint.x + e.target.x(), y: (el as Dimension).startPoint.y + e.target.y() },
                    endPoint: { x: (el as Dimension).endPoint.x + e.target.x(), y: (el as Dimension).endPoint.y + e.target.y() },
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

  return (
    <div className="w-full h-full flex flex-col bg-slate-800">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 p-4 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTool("select")}
          className={`p-2.5 rounded ${activeTool === "select" ? "bg-blue-500 text-white" : "bg-white"}`}
          title="Select"
        >
          <Move className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTool("wall")}
          className={`p-2.5 rounded ${activeTool === "wall" ? "bg-blue-500 text-white" : "bg-white"}`}
          title="Draw Wall"
        >
          <Square className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTool("door")}
          className={`px-3 py-2 rounded hover:bg-gray-200 text-base ${activeTool === "door" ? "bg-blue-100 border-blue-500 border" : "bg-white"}`}
          title="Place Door"
        >
          <DoorIcon size={20} className="text-orange-800" />
        </button>

        <button
          onClick={() => setActiveTool("window")}
          className={`px-3 py-2 rounded hover:bg-gray-200 text-base ${activeTool === "window" ? "bg-blue-100 border-blue-500 border" : "bg-white"}`}
          title="Place Window"
        >
          <Layout size={20} className="text-blue-600" />
        </button>

        <button
          onClick={() => setActiveTool("dimension")}
          className={`p-2.5 rounded ${activeTool === "dimension" ? "bg-blue-500 text-white" : "bg-white"}`}
          title="Dimension Tool"
        >
          <Ruler className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTool("text")}
          className={`p-2.5 rounded ${activeTool === "text" ? "bg-blue-500 text-white" : "bg-white"}`}
          title="Text Tool"
        >
          <Type className="w-5 h-5" />
        </button>

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

            {/* Preview */}
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

            {isDrawing && activeTool === "dimension" && startPoint && endPoint && (
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
          Windows: {elements.filter((e) => e.type === "window").length}
        </span>
      </div>
    </div>
  );
}
