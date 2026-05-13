/**
 * BIM Calculation Utilities
 * Dimensions, areas, volumes, BOQ generation
 */

import {
  Element,
  Wall,
  Door,
  Window,
  Room,
  Point2D,
  Point3D,
  Dimension,
  DrawingCalculations,
  RoomProperties,
  ProjectBOM,
  WallSchedule,
  MaterialUsage,
  MM_SCALE,
} from "@/types/modeling";

// ─────────────────────────────────────────────────────────
// Distance & Dimension Calculations
// ─────────────────────────────────────────────────────────

export const calculateDistance = (p1: Point2D, p2: Point2D): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const calculateDistance3D = (p1: Point3D, p2: Point3D): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const createDimension = (
  startPoint: Point2D,
  endPoint: Point2D,
  unit: "mm" | "m" | "ft" = "mm",
): Dimension => {
  const distance = calculateDistance(startPoint, endPoint);

  let convertedValue = distance;
  if (unit === "m") convertedValue = distance / 1000;
  if (unit === "ft") convertedValue = distance / 304.8;

  return {
    id: `dim_${Date.now()}`,
    type: "dimension",
    startPoint,
    endPoint,
    value: Math.round(convertedValue * 100) / 100,
    unit,
    orientation:
      Math.abs(endPoint.x - startPoint.x) > Math.abs(endPoint.y - startPoint.y)
        ? "horizontal"
        : "vertical",
  };
};

// ─────────────────────────────────────────────────────────
// Distance & Dimension Calculations
// ─────────────────────────────────────────────────────────

export const formatImperial = (mm: number): string => {
  const inchesTotal = mm / 25.4;
  const feet = Math.floor(inchesTotal / 12);
  const inches = Math.round(inchesTotal % 12);

  if (feet === 0) return `${inches}''`;
  if (inches === 0) return `${feet}'`;
  return `${feet}' ${inches}''`;
};

export const mmToWorldY = (mm: number): number => mm / MM_SCALE;

export const mmToFeetInches = (mm: number): string => {
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}' ${inches}"`;
};

export const metersToMM = (m: number): number => Math.round(m * 1000);

export const mmToMeters = (mm: number): number => mm / 1000;

export const calculatePolygonArea = (vertices: Point2D[]): number => {
  if (vertices.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2 / 1000000; // Convert to m²
};

export const calculatePolygonPerimeter = (vertices: Point2D[]): number => {
  if (vertices.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    perimeter += calculateDistance(vertices[i], vertices[j]);
  }
  return perimeter / 1000; // Convert to m
};

export const calculateWallArea = (wall: Wall): number => {
  const length = calculateDistance(wall.startPoint, wall.endPoint);
  const area = (length * wall.height) / 1000000; // Convert to m²
  return Math.round(area * 100) / 100;
};

export const calculateWallLength = (wall: Wall): number => {
  return calculateDistance(wall.startPoint, wall.endPoint) / 1000; // Convert to m
};

// ─────────────────────────────────────────────────────────
// Room Properties
// ─────────────────────────────────────────────────────────

export const calculateRoomProperties = (room: Room): RoomProperties => {
  const area = calculatePolygonArea(room.vertices);
  const perimeter = calculatePolygonPerimeter(room.vertices);
  const volume = (area * room.height) / 1000; // m³

  return {
    area: Math.round(area * 100) / 100,
    perimeter: Math.round(perimeter * 100) / 100,
    volume: Math.round(volume * 100) / 100,
  };
};

// ─────────────────────────────────────────────────────────
// Drawing Calculations
// ─────────────────────────────────────────────────────────

export const calculateDrawingStats = (
  elements: Element[],
): DrawingCalculations => {
  const walls = elements.filter((e) => e.type === "wall") as Wall[];
  const doors = elements.filter((e) => e.type === "door") as Door[];
  const windows = elements.filter((e) => e.type === "window") as Window[];
  const rooms = elements.filter((e) => e.type === "room") as Room[];

  const totalWallLength = walls.reduce(
    (sum, w) => sum + calculateWallLength(w),
    0,
  );
  const totalWallArea = walls.reduce((sum, w) => sum + calculateWallArea(w), 0);
  const totalFloorArea = rooms.reduce((sum, r) => sum + r.properties.area, 0);
  const totalVolume = rooms.reduce((sum, r) => sum + r.properties.volume, 0);

  return {
    totalWallArea: Math.round(totalWallArea * 100) / 100,
    totalFloorArea: Math.round(totalFloorArea * 100) / 100,
    totalWallLength: Math.round(totalWallLength * 100) / 100,
    roomCount: rooms.length,
    doorCount: doors.length,
    windowCount: windows.length,
    estimatedVolume: Math.round(totalVolume * 100) / 100,
  };
};

// ─────────────────────────────────────────────────────────
// Material Schedule & BOQ
// ─────────────────────────────────────────────────────────

export const generateMaterialSchedule = (
  elements: Element[],
): MaterialUsage[] => {
  const walls = elements.filter((e) => e.type === "wall") as Wall[];
  const doors = elements.filter((e) => e.type === "door") as Door[];
  const windows = elements.filter((e) => e.type === "window") as Window[];

  const materials: Map<string, MaterialUsage> = new Map();

  // Walls
  walls.forEach((wall) => {
    const key = `Wall - ${wall.material}`;
    const area = calculateWallArea(wall);

    if (materials.has(key)) {
      const m = materials.get(key)!;
      m.quantity += area;
    } else {
      materials.set(key, {
        material: wall.material,
        quantity: area,
        unit: "m²",
        cost: area * 150, // Example: ₹150/m²
      });
    }
  });

  // Doors
  doors.forEach((door) => {
    const key = `Door - ${door.material || "Standard"}`;
    if (materials.has(key)) {
      const m = materials.get(key)!;
      m.quantity += 1;
    } else {
      materials.set(key, {
        material: door.material || "Standard Door",
        quantity: 1,
        unit: "Unit",
        cost: 5000, // Example: ₹5000 per door
      });
    }
  });

  // Windows
  windows.forEach((window_) => {
    const key = `Window - ${window_.material || "Glass"}`;
    const area = (window_.width * window_.height) / 1000000;

    if (materials.has(key)) {
      const m = materials.get(key)!;
      m.quantity += area;
    } else {
      materials.set(key, {
        material: window_.material || "Glass Window",
        quantity: area,
        unit: "m²",
        cost: area * 2000, // Example: ₹2000/m²
      });
    }
  });

  return Array.from(materials.values()).map((m) => ({
    ...m,
    quantity: Math.round(m.quantity * 100) / 100,
    cost: m.cost ? Math.round(m.cost * 100) / 100 : 0,
  }));
};

export const generateWallSchedule = (elements: Element[]): WallSchedule[] => {
  const walls = elements.filter((e) => e.type === "wall") as Wall[];
  const doors = elements.filter((e) => e.type === "door") as Door[];
  const windows = elements.filter((e) => e.type === "window") as Window[];

  return walls.map((wall) => {
    const wallDoors = doors.filter((d) => d.wallId === wall.id);
    const wallWindows = windows.filter((w) => w.wallId === wall.id);

    return {
      id: wall.id,
      totalLength: calculateWallLength(wall),
      totalArea: calculateWallArea(wall),
      material: wall.material,
      thickness: wall.thickness,
      height: wall.height,
      doorCount: wallDoors.length,
      windowCount: wallWindows.length,
    };
  });
};

// ─────────────────────────────────────────────────────────
// Complete BOM Generation
// ─────────────────────────────────────────────────────────

export const generateProjectBOM = (elements: Element[]): ProjectBOM => {
  const walls = elements.filter((e) => e.type === "wall") as Wall[];
  const doors = elements.filter((e) => e.type === "door") as Door[];
  const windows = elements.filter((e) => e.type === "window") as Window[];

  const wallSchedules = generateWallSchedule(elements);
  const materials = generateMaterialSchedule(elements);
  const stats = calculateDrawingStats(elements);

  const doorSchedules = doors.map((door, idx) => ({
    id: door.id,
    description: `Door ${idx + 1} - ${door.width}x${door.height}mm`,
    quantity: 1,
    width: door.width,
    height: door.height,
    material: door.material || "Wood",
    fireRating: door.fireRating,
  }));

  const windowSchedules = windows.map((window_, idx) => ({
    id: window_.id,
    description: `Window ${idx + 1} - ${window_.width}x${window_.height}mm`,
    quantity: 1,
    width: window_.width,
    height: window_.height,
    glazing: window_.glazing || "Standard Glass",
  }));

  return {
    walls: wallSchedules,
    doors: doorSchedules,
    windows: windowSchedules,
    materials,
    summary: stats,
  };
};

// ─────────────────────────────────────────────────────────
// Indian SOR/Cost Estimation (India-specific)
// ─────────────────────────────────────────────────────────

const SOR_RATES = {
  "Fly Ash Brick": 150, // ₹/m²
  "Red Brick": 180,
  "Concrete Block": 200,
  Marble: 500,
  Granite: 450,
  "Ceramic Tile": 300,
  Paint: 50,
  Plaster: 80,
};

export const estimateProjectCost = (elements: Element[]): number => {
  const bom = generateProjectBOM(elements);
  let totalCost = 0;

  bom.materials.forEach((material) => {
    const rate = (SOR_RATES as any)[material.material] || 100;
    totalCost += material.quantity * rate;
  });

  return Math.round(totalCost);
};

// ─────────────────────────────────────────────────────────
// Quantity Takeoff (BOQ Extraction)
// ─────────────────────────────────────────────────────────

export const generateQuantityTakeoff = (elements: Element[]) => {
  const bom = generateProjectBOM(elements);
  const cost = estimateProjectCost(elements);

  return {
    summary: bom.summary,
    wallSchedule: bom.walls,
    doorSchedule: bom.doors,
    windowSchedule: bom.windows,
    materials: bom.materials,
    estimatedCost: {
      total: cost,
      currency: "INR",
      perSquareMeter:
        Math.round((cost / bom.summary.totalFloorArea) * 100) / 100,
    },
  };
};
