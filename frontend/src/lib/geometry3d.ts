/**
 * 2D to 3D Conversion
 * Convert 2D BIM models to 3D geometry for rendering
 */

import {
  Element,
  Wall,
  Door,
  Window,
  Room,
  Level,
  FurnitureItem,
  Point2D,
  Point3D,
  Model3D,
  WallGeometry3D,
  DoorGeometry3D,
  WindowGeometry3D,
  RoomGeometry3D,
  FurnitureGeometry3D,
  Face3D,
} from "@/types/modeling";

// ─────────────────────────────────────────────────────────
// 3D Point Creation
// ─────────────────────────────────────────────────────────

export const point2DTo3D = (p: Point2D, height: number = 0): Point3D => ({
  x: p.x,
  y: p.y,
  z: height,
});

export const createPoint3D = (x: number, y: number, z: number): Point3D => ({
  x,
  y,
  z,
});

const DEFAULT_LEVEL: Level = {
  id: "level_0",
  projectId: "default",
  name: "Level 1",
  elevation_m: 0,
  floor_height_m: 3,
  order: 0,
};

// NOTE: Levels are now fetched from the API separately
// This function extracts levels for backward compatibility
const getLevels = (): Level[] => {
  return [DEFAULT_LEVEL];
};

const getLevelById = (levels: Level[], levelId?: string): Level => {
  if (levelId) {
    const found = levels.find((level) => level.id === levelId);
    if (found) return found;
  }
  return levels[0] || DEFAULT_LEVEL;
};

// ─────────────────────────────────────────────────────────
// Wall 3D Geometry Generation
// ─────────────────────────────────────────────────────────

export const wallTo3D = (wall: Wall, levelElevation = 0): WallGeometry3D => {
  return {
    id: wall.id,
    startPoint: point2DTo3D(wall.startPoint, levelElevation),
    endPoint: point2DTo3D(wall.endPoint, levelElevation),
    thickness: wall.thickness,
    height: wall.height,
    material: wall.material,
    levelId: wall.levelId,
  };
};

export const generateWallVertices = (wall: Wall): Point3D[] => {
  const w = wall.thickness / 2; // Half thickness for center line

  // Calculate perpendicular direction
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = (-dy / len) * w;
  const perpY = (dx / len) * w;

  return [
    // Bottom face
    { x: wall.startPoint.x + perpX, y: wall.startPoint.y + perpY, z: 0 },
    { x: wall.endPoint.x + perpX, y: wall.endPoint.y + perpY, z: 0 },
    { x: wall.endPoint.x - perpX, y: wall.endPoint.y - perpY, z: 0 },
    { x: wall.startPoint.x - perpX, y: wall.startPoint.y - perpY, z: 0 },
    // Top face
    {
      x: wall.startPoint.x + perpX,
      y: wall.startPoint.y + perpY,
      z: wall.height,
    },
    { x: wall.endPoint.x + perpX, y: wall.endPoint.y + perpY, z: wall.height },
    { x: wall.endPoint.x - perpX, y: wall.endPoint.y - perpY, z: wall.height },
    {
      x: wall.startPoint.x - perpX,
      y: wall.startPoint.y - perpY,
      z: wall.height,
    },
  ];
};

export const generateWallFaces = (
  wallIndex: number,
  vertexOffset: number,
): Face3D[] => {
  const baseOffset = vertexOffset;
  return [
    // Front face
    {
      id: `wall_${wallIndex}_front`,
      vertexIndices: [
        baseOffset + 0,
        baseOffset + 1,
        baseOffset + 5,
        baseOffset + 4,
      ],
      normal: { x: 0, y: 1, z: 0 },
      color: "#e8d4c0",
    },
    // Back face
    {
      id: `wall_${wallIndex}_back`,
      vertexIndices: [
        baseOffset + 2,
        baseOffset + 3,
        baseOffset + 7,
        baseOffset + 6,
      ],
      normal: { x: 0, y: -1, z: 0 },
      color: "#d4b5a0",
    },
    // Top face (roof)
    {
      id: `wall_${wallIndex}_top`,
      vertexIndices: [
        baseOffset + 4,
        baseOffset + 5,
        baseOffset + 6,
        baseOffset + 7,
      ],
      normal: { x: 0, y: 0, z: 1 },
      color: "#c0a090",
    },
    // Bottom face (ground)
    {
      id: `wall_${wallIndex}_bottom`,
      vertexIndices: [
        baseOffset + 0,
        baseOffset + 3,
        baseOffset + 2,
        baseOffset + 1,
      ],
      normal: { x: 0, y: 0, z: -1 },
      color: "#a08070",
    },
  ];
};

// ─────────────────────────────────────────────────────────
// Door 3D Geometry Generation
// ─────────────────────────────────────────────────────────

export const doorTo3D = (door: Door, levelElevation = 0): DoorGeometry3D => {
  return {
    id: door.id,
    position: point2DTo3D(door.position, levelElevation),
    width: door.width,
    height: door.height,
    swingDirection: door.swingDirection,
    wallId: door.wallId || "",
  };
};

export const generateDoorVertices = (door: Door): Point3D[] => {
  const baseHeight = 0;
  const w = door.width / 1000; // Convert mm to world units
  const h = door.height / 1000;

  return [
    { x: door.position.x, y: door.position.y, z: baseHeight },
    { x: door.position.x + w, y: door.position.y, z: baseHeight },
    { x: door.position.x + w, y: door.position.y, z: baseHeight + h },
    { x: door.position.x, y: door.position.y, z: baseHeight + h },
  ];
};

// ─────────────────────────────────────────────────────────
// Window 3D Geometry Generation
// ─────────────────────────────────────────────────────────

export const windowTo3D = (
  window_: Window,
  levelElevation = 0,
): WindowGeometry3D => {
  return {
    id: window_.id,
    position: point2DTo3D(window_.position, levelElevation + 1000), // Windows are usually 1m above floor
    width: window_.width,
    height: window_.height,
    wallId: window_.wallId || "",
  };
};

export const generateWindowVertices = (window_: Window): Point3D[] => {
  const baseHeight = 1000; // 1m above floor
  const w = window_.width / 1000;
  const h = window_.height / 1000;

  return [
    { x: window_.position.x, y: window_.position.y, z: baseHeight },
    { x: window_.position.x + w, y: window_.position.y, z: baseHeight },
    { x: window_.position.x + w, y: window_.position.y, z: baseHeight + h },
    { x: window_.position.x, y: window_.position.y, z: baseHeight + h },
  ];
};

// ─────────────────────────────────────────────────────────
// Room 3D Geometry Generation
// ─────────────────────────────────────────────────────────

export const roomTo3D = (room: Room, levelElevation = 0): RoomGeometry3D => {
  return {
    id: room.id,
    name: room.name,
    vertices: room.vertices.map((v) => point2DTo3D(v, levelElevation)),
    height: room.height,
    floorVertices: [],
    ceilingVertices: [],
    wallVertices: [],
  };
};

export const furnitureTo3D = (
  furniture: FurnitureItem,
  levelElevation = 0,
): FurnitureGeometry3D => ({
  id: furniture.id,
  kind: furniture.assetType,
  label: furniture.family,
  position: createPoint3D(furniture.x, furniture.y, levelElevation),
  width: furniture.width,
  depth: furniture.depth,
  height: furniture.height,
  rotation: furniture.z,
  levelId: furniture.levelId,
  material: furniture.materialId,
});

export const generateRoomVertices = (room: Room): Point3D[] => {
  const vertices: Point3D[] = [];

  // Floor vertices
  room.vertices.forEach((v) => {
    vertices.push(point2DTo3D(v, 0));
  });

  // Ceiling vertices
  room.vertices.forEach((v) => {
    vertices.push(point2DTo3D(v, room.height));
  });

  return vertices;
};

export const generateRoomFaces = (
  room: Room,
  vertexOffset: number,
): Face3D[] => {
  const faces: Face3D[] = [];
  const n = room.vertices.length;

  // Floor
  const floorIndices = Array.from({ length: n }, (_, i) => vertexOffset + i);
  faces.push({
    id: `room_${room.id}_floor`,
    vertexIndices: floorIndices,
    normal: { x: 0, y: 0, z: -1 },
    color: "#d4a574",
  });

  // Ceiling
  const ceilingIndices = Array.from(
    { length: n },
    (_, i) => vertexOffset + n + i,
  );
  faces.push({
    id: `room_${room.id}_ceiling`,
    vertexIndices: ceilingIndices.reverse(),
    normal: { x: 0, y: 0, z: 1 },
    color: "#f5f5f5",
  });

  // Walls
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    faces.push({
      id: `room_${room.id}_wall_${i}`,
      vertexIndices: [
        vertexOffset + i,
        vertexOffset + next,
        vertexOffset + n + next,
        vertexOffset + n + i,
      ],
      normal: { x: 0, y: 1, z: 0 },
      color: "#ffffff",
    });
  }

  return faces;
};

// ─────────────────────────────────────────────────────────
// Complete 3D Model Generation
// ─────────────────────────────────────────────────────────

export const convert2DTo3D = (
  elements: Element[],
  projectId: string,
): Model3D => {
  const levels = getLevels();
  const walls = elements.filter((e) => e.type === "wall") as Wall[];
  const doors = elements.filter((e) => e.type === "door") as Door[];
  const windows = elements.filter((e) => e.type === "window") as Window[];
  const rooms = elements.filter((e) => e.type === "room") as Room[];
  // NOTE: Furniture items are now stored separately in the database, not as elements
  // const furniture = elements.filter((e) => e.type === "furniture") as FurnitureItem[];

  const levelElevationMap = new Map(
    levels.map((level) => [level.id, level.elevation_m]),
  );
  const resolveElevation = (levelId?: string) =>
    levelElevationMap.get(levelId || "") ?? levels[0]?.elevation_m ?? 0;

  let vertices: Point3D[] = [];
  let faces: Face3D[] = [];
  let vertexOffset = 0;

  // Process walls
  const wall3Ds: WallGeometry3D[] = [];
  walls.forEach((wall, idx) => {
    wall3Ds.push(wallTo3D(wall, resolveElevation(wall.levelId)));
    const wallVertices = generateWallVertices(wall);
    const wallFaces = generateWallFaces(idx, vertexOffset);

    vertices.push(...wallVertices);
    faces.push(...wallFaces);
    vertexOffset += wallVertices.length;
  });

  // Process doors
  const door3Ds: DoorGeometry3D[] = [];
  doors.forEach((door) => {
    door3Ds.push(doorTo3D(door, resolveElevation(door.levelId)));
    const doorVertices = generateDoorVertices(door);
    vertices.push(...doorVertices);
    vertexOffset += doorVertices.length;
  });

  // Process windows
  const window3Ds: WindowGeometry3D[] = [];
  windows.forEach((window_) => {
    window3Ds.push(windowTo3D(window_, resolveElevation(window_.levelId)));
    const windowVertices = generateWindowVertices(window_);
    vertices.push(...windowVertices);
    vertexOffset += windowVertices.length;
  });

  // Process rooms
  const room3Ds: RoomGeometry3D[] = [];
  rooms.forEach((room) => {
    room3Ds.push(roomTo3D(room, resolveElevation(room.levelId)));
    const roomVertices = generateRoomVertices(room);
    const roomFaces = generateRoomFaces(room, vertexOffset);

    vertices.push(...roomVertices);
    faces.push(...roomFaces);
    vertexOffset += roomVertices.length;
  });

  // NOTE: Furniture items are stored separately and handled in Model3DPreview
  // const furniture3Ds: FurnitureGeometry3D[] = furniture.map((item) =>
  //   furnitureTo3D(item, resolveElevation(item.levelId)),
  // );

  return {
    id: `model_${projectId}`,
    projectId,
    walls: wall3Ds,
    doors: door3Ds,
    windows: window3Ds,
    rooms: room3Ds,
    vertices,
    faces,
  };
};

// ─────────────────────────────────────────────────────────
// Export to GLB/GLTF
// ─────────────────────────────────────────────────────────

export const exportModelAsJSON = (model3D: Model3D): string => {
  return JSON.stringify(
    {
      type: "BIMModel",
      projectId: model3D.projectId,
      walls: model3D.walls,
      doors: model3D.doors,
      windows: model3D.windows,
      rooms: model3D.rooms,
      vertices: model3D.vertices,
      faces: model3D.faces,
    },
    null,
    2,
  );
};

// ─────────────────────────────────────────────────────────
// IFC Export Preparation
// ─────────────────────────────────────────────────────────

export const prepareForIFCExport = (model3D: Model3D) => {
  return {
    projectId: model3D.projectId,
    elements: {
      walls: model3D.walls.map((w) => ({
        id: w.id,
        type: "IfcWall",
        startPoint: w.startPoint,
        endPoint: w.endPoint,
        thickness: w.thickness,
        height: w.height,
        material: w.material,
      })),
      doors: model3D.doors.map((d) => ({
        id: d.id,
        type: "IfcDoor",
        position: d.position,
        width: d.width,
        height: d.height,
        swingDirection: d.swingDirection,
      })),
      windows: model3D.windows.map((w) => ({
        id: w.id,
        type: "IfcWindow",
        position: w.position,
        width: w.width,
        height: w.height,
      })),
    },
  };
};
