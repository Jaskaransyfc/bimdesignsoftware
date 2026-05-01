/**
 * BIM Modeling Types
 * Revit-like 2D/3D modeling system
 */

// ─────────────────────────────────────────────────────────
// 2D Drawing Elements
// ─────────────────────────────────────────────────────────

export type ElementType =
  | "wall"
  | "door"
  | "window"
  | "room"
  | "dimension"
  | "text"
  | "line"
  | "arc"
  | "column"
  | "beam";

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Wall {
  id: string;
  type: "wall";
  startPoint: Point2D;
  endPoint: Point2D;
  thickness: number; // mm
  height: number; // mm
  material: string;
  fireRating?: string;
  color?: string;
}

export interface Door {
  id: string;
  type: "door";
  position: Point2D;
  width: number; // mm
  height: number; // mm
  swingDirection: "left" | "right" | "double";
  wallId?: string; // Reference to parent wall
  orientation: number; // rotation in degrees
  material?: string;
  fireRating?: string;
  openingSide?: "inside" | "outside";
}

export interface Window {
  id: string;
  type: "window";
  position: Point2D;
  width: number; // mm
  height: number; // mm
  wallId?: string;
  orientation: number;
  material?: string;
  glazing?: string;
}

export interface Room {
  id: string;
  type: "room";
  name: string;
  vertices: Point2D[]; // Polygon vertices
  height: number;
  floorMaterial?: string;
  ceilingMaterial?: string;
  properties: RoomProperties;
}

export interface RoomProperties {
  area: number; // m²
  perimeter: number; // m
  volume: number; // m³
  fireRating?: string;
  acousticRating?: string;
}

export interface Dimension {
  id: string;
  type: "dimension";
  startPoint: Point2D;
  endPoint: Point2D;
  value: number;
  unit: "mm" | "m" | "ft";
  label?: string;
  orientation: "horizontal" | "vertical" | "aligned";
}

export interface TextElement {
  id: string;
  type: "text";
  position: Point2D;
  text: string;
  fontSize: number;
  rotation: number;
  color?: string;
}

export interface DrawingElement {
  id: string;
  type: ElementType;
  visible: boolean;
  locked: boolean;
  layer?: string;
  metadata?: Record<string, any>;
}

export type Element =
  | Wall
  | Door
  | Window
  | Room
  | Dimension
  | TextElement
  | DrawingElement;

// ─────────────────────────────────────────────────────────
// 2D Drawing Document
// ─────────────────────────────────────────────────────────

export interface Drawing2D {
  id: string;
  projectId: string;
  name: string;
  elements: Element[];
  layers: DrawingLayer[];
  selectedElements: string[];
  zoomLevel: number;
  viewOffset: Point2D;
  gridSize: number;
  snapToGrid: boolean;
  showDimensions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
  elementIds: string[];
}

// ─────────────────────────────────────────────────────────
// 3D Conversion
// ─────────────────────────────────────────────────────────

export interface WallGeometry3D {
  id: string;
  startPoint: Point3D;
  endPoint: Point3D;
  thickness: number;
  height: number;
  material: string;
}

export interface Model3D {
  id: string;
  projectId: string;
  walls: WallGeometry3D[];
  doors: DoorGeometry3D[];
  windows: WindowGeometry3D[];
  rooms: RoomGeometry3D[];
  vertices: Point3D[];
  faces: Face3D[];
}

export interface DoorGeometry3D {
  id: string;
  position: Point3D;
  width: number;
  height: number;
  swingDirection: string;
  wallId: string;
}

export interface WindowGeometry3D {
  id: string;
  position: Point3D;
  width: number;
  height: number;
  wallId: string;
}

export interface RoomGeometry3D {
  id: string;
  name: string;
  vertices: Point3D[];
  height: number;
  floorVertices: number[];
  ceilingVertices: number[];
  wallVertices: number[][];
}

export interface Face3D {
  id: string;
  vertexIndices: number[];
  normal: Point3D;
  material?: string;
  color?: string;
}

// ─────────────────────────────────────────────────────────
// Tools & Drawing State
// ─────────────────────────────────────────────────────────

export type ToolType =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "room"
  | "dimension"
  | "text"
  | "polyline"
  | "erase"
  | "pan"
  | "zoom";

export interface DrawingToolState {
  activeTool: ToolType;
  isDrawing: boolean;
  currentPoints: Point2D[];
  previewElement?: Partial<Element>;
  cursorPosition: Point2D;
  snappedPosition?: Point2D;
  snapIndicators: Point2D[];
}

// ─────────────────────────────────────────────────────────
// Calculations & Properties
// ─────────────────────────────────────────────────────────

export interface WallSchedule {
  id: string;
  totalLength: number; // m
  totalArea: number; // m²
  material: string;
  thickness: number;
  height: number;
  doorCount: number;
  windowCount: number;
}

export interface DrawingCalculations {
  totalWallArea: number; // m²
  totalFloorArea: number; // m²
  totalWallLength: number; // m
  roomCount: number;
  doorCount: number;
  windowCount: number;
  estimatedVolume: number; // m³
}

export interface ProjectBOM {
  walls: WallSchedule[];
  doors: DoorSchedule[];
  windows: WindowSchedule[];
  materials: MaterialUsage[];
  summary: DrawingCalculations;
}

export interface DoorSchedule {
  id: string;
  description: string;
  quantity: number;
  width: number;
  height: number;
  material: string;
  fireRating?: string;
}

export interface WindowSchedule {
  id: string;
  description: string;
  quantity: number;
  width: number;
  height: number;
  glazing?: string;
}

export interface MaterialUsage {
  material: string;
  quantity: number;
  unit: string;
  cost?: number;
}
