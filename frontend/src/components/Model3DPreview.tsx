"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// @ts-ignore
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// @ts-ignore
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
// @ts-ignore
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
// @ts-ignore
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
// @ts-ignore
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { convert2DTo3D } from "@/lib/geometry3d";
import { Door, Element, FurnitureItem, Window } from "@/types/modeling";

interface Model3DPreviewProps {
  elements: Element[];
  projectId: string;
}

const PLAN_SCALE = 10;
const MM_SCALE = 500; // 1000mm = 2 units (consistent with 1px = 50mm and PLAN_SCALE = 10)
const MM_TO_CANVAS = 50; // 1 pixel = 50mm
const METERS_TO_WORLD = 2; // 1 meter = 2 units (since 1m = 20px and 10px = 1 unit)

export default function Model3DPreview({
  elements,
  projectId,
}: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showDebugGuides, setShowDebugGuides] = useState(false);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [importedModels, setImportedModels] = useState<
    Array<{
      id: string;
      name: string;
      file_path: string;
      model_type: string;
    }>
  >([]);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const normalizeFurnitureItem = (item: any): FurnitureItem => {
    return {
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
    };
  };

  // Load furniture items
  useEffect(() => {
    let cancelled = false;

    const loadFurniture = async () => {
      try {
        console.log(`📡 Fetching furniture for project: ${projectId}`);
        const res = await fetch(`/api/projects/${projectId}/furniture`);
        if (!res.ok) {
          console.error(`❌ Furniture API returned ${res.status}`);
          return;
        }
        const data = await res.json();
        console.log(`📦 Furniture API response:`, data);

        // Handle both array and object responses
        const items = Array.isArray(data)
          ? data
          : data.furniture || data.data || [];
        console.log(`✅ Parsed ${items.length} furniture items`);

        if (!cancelled) {
          setFurnitureItems(items.map(normalizeFurnitureItem));
        }
      } catch (error) {
        console.error("❌ Failed to load furniture for 3D preview:", error);
      }
    };

    loadFurniture();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Load imported models
  useEffect(() => {
    let cancelled = false;

    const loadImportedModels = async () => {
      try {
        console.log(`📡 Fetching imported models for project: ${projectId}`);
        const res = await fetch(`/api/projects/${projectId}/models`);
        if (!res.ok) {
          console.error(`❌ Models API returned ${res.status}`);
          return;
        }
        const data = await res.json();
        console.log(`📦 Imported models:`, data);

        if (!cancelled) {
          setImportedModels(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("❌ Failed to load imported models:", error);
      }
    };

    loadImportedModels();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1e293b");

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      20000,
    );
    camera.position.set(120, 120, 140);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 20, 0);

    let transformControls: any = null;
    try {
      const tc = new TransformControls(camera, renderer.domElement);
      // In some versions of Three.js, TransformControls is not a direct Object3D
      // but we still need to add it to the scene if it has a visual representation.
      if (tc) {
        tc.setMode("translate");
        tc.showY = false;
        if (tc.isObject3D || tc instanceof THREE.Object3D) {
          scene.add(tc);
        } else if (tc.getHelper) {
          scene.add(tc.getHelper());
        } else {
          // Fallback: try adding directly if no other option
          scene.add(tc as any);
        }
        transformControls = tc;
      }
    } catch (error) {
      console.warn(
        "Failed to initialize TransformControls, continuing without it:",
        error,
      );
    }

    const interactiveObjects: THREE.Object3D[] = [];
    let selectedObject: THREE.Object3D | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const snapObjectToGround = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj);
      if (!box.isEmpty()) {
        obj.position.y += -box.min.y;
      }
    };

    const normalizeImportedModel = (
      obj: THREE.Object3D,
      targetPosition: THREE.Vector3,
      targetWidth?: number,
      targetHeight?: number,
      targetDepth?: number,
      assetName?: string
    ) => {
      // Ensure matrices are up to date
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Auto-orientation: Many CAD models load lying flat (Z-up in CAD, Y-up in Three.js)
      // If Y is significantly smaller than both X and Z, it's likely lying down
      if (size.y < size.x * 0.5 && size.y < size.z * 0.5) {
        obj.rotateX(-Math.PI / 2);
        obj.updateMatrixWorld(true);
        box.setFromObject(obj);
        box.getSize(size);
      }

      // Scaling logic
      if (targetWidth !== undefined && targetHeight !== undefined) {
        // Precise scaling to specified dimensions
        const scaleX = targetWidth / Math.max(size.x, 0.001);
        const scaleY = targetHeight / Math.max(size.y, 0.001);
        // Use specified depth or maintain realistic thickness
        const scaleZ = targetDepth
          ? targetDepth / Math.max(size.z, 0.001)
          : Math.min(scaleX, scaleY);
        
        obj.scale.set(
          obj.scale.x * scaleX,
          obj.scale.y * scaleY,
          obj.scale.z * scaleZ,
        );
      } else {
        const targetMaxSize = METERS_TO_WORLD * 2.2;
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0.0001) {
          const factor = targetMaxSize / maxDim;
          obj.scale.multiplyScalar(factor);
        }
      }

      // Re-calculate bounds after scaling
      obj.updateMatrixWorld(true);
      const postBox = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      postBox.getCenter(center);

      // Final positioning
      obj.position.x += targetPosition.x - center.x;
      obj.position.z += targetPosition.z - center.z;
      obj.position.y += targetPosition.y - postBox.min.y;

      // Premium Materials
      const isGlass = assetName?.toLowerCase().includes("glass");
      const baseColor = isGlass ? "#93c5fd" : "#4a3122"; // Blueish for glass, wood-brown otherwise

      obj.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: isGlass ? 0.1 : 0.7,
            metalness: isGlass ? 0.2 : 0.1,
            transparent: isGlass,
            opacity: isGlass ? 0.6 : 1.0,
            side: THREE.DoubleSide
          });
        }
      });
    };

    const findInteractiveRoot = (
      obj: THREE.Object3D | null,
    ): THREE.Object3D | null => {
      let current: THREE.Object3D | null = obj;
      while (current) {
        if (
          current.userData?.kind === "furniture" ||
          current.userData?.kind === "imported_model"
        ) {
          return current;
        }
        current = current.parent;
      }
      return null;
    };

    const selectObject = (obj: THREE.Object3D | null) => {
      selectedObject = obj;
      if (!transformControls) return;
      if (selectedObject) {
        transformControls.attach(selectedObject);
      } else {
        transformControls.detach();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length === 0) {
        selectObject(null);
        return;
      }

      selectObject(findInteractiveRoot(hits[0].object));
    };

    const onKeyDown = async (event: KeyboardEvent) => {
      if (!selectedObject) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      const kind = selectedObject.userData?.kind;
      const id = selectedObject.userData?.id;
      if (!kind || !id) return;

      if (kind === "furniture") {
        try {
          await fetch(`/api/projects/${projectId}/furniture/${id}`, {
            method: "DELETE",
          });
          setFurnitureItems((prev) => prev.filter((f) => f.id !== id));
        } catch (error) {
          console.error("❌ Failed to delete furniture:", error);
        }
      }

      if (kind === "imported_model") {
        try {
          await fetch(`/api/projects/${projectId}/models/${id}`, {
            method: "DELETE",
          });
          setImportedModels((prev) => prev.filter((m) => m.id !== id));
        } catch (error) {
          console.error("❌ Failed to delete imported model:", error);
        }
      }

      scene.remove(selectedObject);
      const idx = interactiveObjects.indexOf(selectedObject);
      if (idx >= 0) interactiveObjects.splice(idx, 1);
      selectObject(null);
    };

    if (transformControls) {
      transformControls.addEventListener("dragging-changed", (e: any) => {
        controls.enabled = !e.value;
      });

      transformControls.addEventListener("objectChange", () => {
        if (!selectedObject) return;
        // Keep moved objects attached to the ground.
        snapObjectToGround(selectedObject);
      });

      transformControls.addEventListener("mouseUp", async () => {
        if (!selectedObject) return;
        const kind = selectedObject.userData?.kind;
        const id = selectedObject.userData?.id;
        if (kind !== "furniture" || !id) return;

        const x = selectedObject.position.x / METERS_TO_WORLD;
        const y = selectedObject.position.z / METERS_TO_WORLD;
        const z = (selectedObject.rotation.y * 180) / Math.PI;

        try {
          await fetch(`/api/projects/${projectId}/furniture/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x, y, z }),
          });

          setFurnitureItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    x,
                    y,
                    z,
                  }
                : item,
            ),
          );
        } catch (error) {
          console.error("❌ Failed to persist furniture position:", error);
        }
      });
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    // Enhanced lighting for better material visibility of imported models
    scene.add(new THREE.AmbientLight("#ffffff", 0.8));

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.0);
    keyLight.position.set(150, 180, 120);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.6);
    fillLight.position.set(-120, 100, -100);
    scene.add(fillLight);

    // Add back light for better depth and model visibility
    const backLight = new THREE.DirectionalLight("#ffffff", 0.4);
    backLight.position.set(0, 150, -200);
    scene.add(backLight);

    const grid = new THREE.GridHelper(800, 80, "#334155", "#334155");
    scene.add(grid);

    const axis = new THREE.AxesHelper(80);
    scene.add(axis);

    const model3D = convert2DTo3D(elements, projectId);
    const wallById = new Map(model3D.walls.map((wall) => [wall.id, wall]));
    const doorById = new Map(
      elements
        .filter((element): element is Door => element.type === "door")
        .map((door) => [door.id, door]),
    );
    const windowById = new Map(
      elements
        .filter((element): element is Window => element.type === "window")
        .map((window_) => [window_.id, window_]),
    );

    const getWallVectors = (wall: {
      startPoint: { x: number; y: number };
      endPoint: { x: number; y: number };
    }) => {
      const dx = (wall.endPoint.x - wall.startPoint.x) / PLAN_SCALE;
      const dz = (wall.endPoint.y - wall.startPoint.y) / PLAN_SCALE;
      const len = Math.hypot(dx, dz) || 1;
      const dir = { x: dx / len, z: dz / len };
      const normal = { x: -dir.z, z: dir.x };
      return { dir, normal };
    };

    const projectOpeningCenterToWall = (
      opening: Door | Window,
      wall?: {
        startPoint: { x: number; y: number };
        endPoint: { x: number; y: number };
      },
      openingWidthWorld = 0,
    ) => {
      if (!wall) {
        return {
          x: opening.position.x / PLAN_SCALE,
          z: opening.position.y / PLAN_SCALE,
          distAlongWall: undefined as number | undefined,
        };
      }

      const dx = wall.endPoint.x - wall.startPoint.x;
      const dy = wall.endPoint.y - wall.startPoint.y;
      const wallLen2D = Math.hypot(dx, dy);
      const ux = dx / (wallLen2D || 1);
      const uy = dy / (wallLen2D || 1);

      const relX = opening.position.x - wall.startPoint.x;
      const relY = opening.position.y - wall.startPoint.y;
      let distAlongWall = (relX * ux + relY * uy) / PLAN_SCALE;

      // Keep opening center within host wall extents so frames/leaf stay in-bounds.
      if (openingWidthWorld > 0) {
        const wallLengthWorld = wallLen2D / PLAN_SCALE;
        const minCenter = openingWidthWorld / 2;
        const maxCenter = wallLengthWorld - openingWidthWorld / 2;
        if (maxCenter >= minCenter) {
          distAlongWall = Math.min(
            maxCenter,
            Math.max(minCenter, distAlongWall),
          );
        }
      }

      return {
        x: wall.startPoint.x / PLAN_SCALE + ux * distAlongWall,
        z: wall.startPoint.y / PLAN_SCALE + uy * distAlongWall,
        distAlongWall,
      };
    };

    const wallToOpeningMap = new Map<string, (Door | Window)[]>();
    elements.forEach((el) => {
      if (el.type === "door" || el.type === "window") {
        const opening = el as Door | Window;
        if (opening.wallId) {
          const list = wallToOpeningMap.get(opening.wallId) || [];
          list.push(opening);
          wallToOpeningMap.set(opening.wallId, list);
        }
      }
    });

    model3D.walls.forEach((wall) => {
      const dx = wall.endPoint.x - wall.startPoint.x;
      const dy = wall.endPoint.y - wall.startPoint.y;
      const length = Math.sqrt(dx * dx + dy * dy) / PLAN_SCALE;
      const thickness = wall.thickness / MM_SCALE;
      const height = wall.height / MM_SCALE;

      const openings = wallToOpeningMap.get(wall.id) || [];

      // Create a shape for the wall face
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(length, 0);
      shape.lineTo(length, height);
      shape.lineTo(0, height);
      shape.closePath();

      // Add holes for doors and windows
      // Project the opening center onto the wall direction vector for accurate hole placement
      const wallDirLen = Math.hypot(dx, dy);
      const wallUnitX = dx / (wallDirLen || 1);
      const wallUnitY = dy / (wallDirLen || 1);

      openings.forEach((op) => {
        const opW = op.width / MM_SCALE;
        const opH = op.height / MM_SCALE;

        // Project op position onto wall direction to get distance along the wall
        const relX = op.position.x - wall.startPoint.x;
        const relY = op.position.y - wall.startPoint.y;
        const distAlongWallRaw =
          (relX * wallUnitX + relY * wallUnitY) / PLAN_SCALE;
        const minCenter = opW / 2;
        const maxCenter = length - opW / 2;
        const distAlongWall =
          maxCenter >= minCenter
            ? Math.min(maxCenter, Math.max(minCenter, distAlongWallRaw))
            : distAlongWallRaw;

        const sillH = op.type === "window" ? (op as any).sillHeight || 1.0 : 0;

        const hole = new THREE.Path();
        const xStart = distAlongWall - opW / 2;
        // Clamp to wall extents to avoid holes outside the wall
        const clampedStart = Math.max(0.05, xStart);
        const clampedEnd = Math.min(length - 0.05, xStart + opW);

        // Draw hole Clockwise (opposite to outer shape) for proper triangulation
        hole.moveTo(clampedStart, sillH);
        hole.lineTo(clampedStart, sillH + opH);
        hole.lineTo(clampedEnd, sillH + opH);
        hole.lineTo(clampedEnd, sillH);
        hole.closePath();
        shape.holes.push(hole);
      });

      const geometry = new (THREE as any).ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      });
      // Center the geometry on the extrusion axis so it sits centered on the plan line
      geometry.translate(0, 0, -thickness / 2);

      const material = new THREE.MeshStandardMaterial({
        color: "#d4a574",
        roughness: 0.85,
        metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        wall.startPoint.x / PLAN_SCALE,
        0,
        wall.startPoint.y / PLAN_SCALE,
      );
      mesh.rotation.y = -Math.atan2(dy, dx);
      scene.add(mesh);

      // Add corner fillers (columns) to hide gaps between walls
      const fillerGeom = new THREE.BoxGeometry(thickness, height, thickness);
      const fillerMat = material;

      const startFiller = new THREE.Mesh(fillerGeom, fillerMat);
      startFiller.position.set(
        wall.startPoint.x / PLAN_SCALE,
        height / 2,
        wall.startPoint.y / PLAN_SCALE,
      );
      scene.add(startFiller);

      const endFiller = new THREE.Mesh(fillerGeom, fillerMat);
      endFiller.position.set(
        wall.endPoint.x / PLAN_SCALE,
        height / 2,
        wall.endPoint.y / PLAN_SCALE,
      );
      scene.add(endFiller);
    });

    if (showDebugGuides) {
      const wallAxisMaterial = new THREE.LineBasicMaterial({
        color: "#22d3ee",
      });
      const openingAnchorMaterial = new THREE.MeshBasicMaterial({
        color: "#f97316",
      });
      const openingRawMaterial = new THREE.MeshBasicMaterial({
        color: "#ef4444",
      });

      model3D.walls.forEach((wall) => {
        const axisGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(
            wall.startPoint.x / PLAN_SCALE,
            0.15,
            wall.startPoint.y / PLAN_SCALE,
          ),
          new THREE.Vector3(
            wall.endPoint.x / PLAN_SCALE,
            0.15,
            wall.endPoint.y / PLAN_SCALE,
          ),
        ]);
        scene.add(new THREE.Line(axisGeometry, wallAxisMaterial.clone()));

        const openings = wallToOpeningMap.get(wall.id) || [];
        openings.forEach((op) => {
          const opW = Math.max(op.width / MM_SCALE, 0.1);
          const projected = projectOpeningCenterToWall(op, wall, opW);
          const projectedDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            openingAnchorMaterial.clone(),
          );
          projectedDot.position.set(projected.x, 0.2, projected.z);
          scene.add(projectedDot);

          const rawDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 8),
            openingRawMaterial.clone(),
          );
          rawDot.position.set(
            op.position.x / PLAN_SCALE,
            0.2,
            op.position.y / PLAN_SCALE,
          );
          scene.add(rawDot);
        });
      });
    }

    model3D.doors.forEach((door) => {
      const doorW = Math.max(door.width / MM_SCALE, 0.1);
      const doorH = Math.max(door.height / MM_SCALE, 0.1);
      const hostWall = door.wallId ? wallById.get(door.wallId) : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;

      const element = doorById.get(door.id);

      const projectedDoor = projectOpeningCenterToWall(door, hostWall, doorW);
      const px = projectedDoor.x;
      const pz = projectedDoor.z;

      const renderProceduralDoor = () => {
        const doorStyle = String(
          (element as any)?.metadata?.door_style || "",
        ).toLowerCase();
        const isDouble =
          door.swingDirection === "double" || doorStyle === "double";
        const isMulti = doorStyle === "multi";
        const isGlass =
          String((door as any).material || "").toLowerCase() === "glass" ||
          doorStyle === "glass";

        const leafMaterial = new THREE.MeshStandardMaterial({
          color: isGlass ? "#9cc7d8" : "#7c2d12",
          roughness: isGlass ? 0.2 : 0.55,
          metalness: isGlass ? 0.15 : 0.1,
          transparent: isGlass,
          opacity: isGlass ? 0.65 : 1,
        });

        const addLeaf = (
          centerX: number,
          centerY: number,
          centerZ: number,
          leafW: number,
        ) => {
          const doorLeaf = new THREE.Mesh(
            new THREE.BoxGeometry(
              Math.max(leafW - 0.05, 0.08),
              doorH - 0.05,
              doorLeafDepth,
            ),
            leafMaterial,
          );
          doorLeaf.position.set(centerX, centerY, centerZ);
          if (vectors) {
            doorLeaf.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
          }
          scene.add(doorLeaf);
        };

        if (isMulti) {
          const panelW = doorW / 3;
          addLeaf(
            px - (vectors?.dir.x || 0) * panelW,
            doorH / 2,
            pz - (vectors?.dir.z || 0) * panelW,
            panelW,
          );
          addLeaf(px, doorH / 2, pz, panelW);
          addLeaf(
            px + (vectors?.dir.x || 0) * panelW,
            doorH / 2,
            pz + (vectors?.dir.z || 0) * panelW,
            panelW,
          );
        } else if (isDouble) {
          const halfW = doorW / 2;
          addLeaf(
            px - (vectors?.dir.x || 0) * (halfW / 2),
            doorH / 2,
            pz - (vectors?.dir.z || 0) * (halfW / 2),
            halfW,
          );
          addLeaf(
            px + (vectors?.dir.x || 0) * (halfW / 2),
            doorH / 2,
            pz + (vectors?.dir.z || 0) * (halfW / 2),
            halfW,
          );
        } else {
          addLeaf(px, doorH / 2, pz, doorW);
        }

        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(0.05),
          new THREE.MeshStandardMaterial({ color: "#fbbf24" }),
        );
        handle.position.set(
          px + (vectors?.dir.x || 0) * (doorW * 0.4),
          doorH / 2,
          pz + (vectors?.dir.z || 0) * (doorW * 0.4),
        );
        scene.add(handle);

        const frameColor = "#522b11";
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: frameColor,
          roughness: 0.7,
        });
        const frameThickness = hostWall
          ? hostWall.thickness / MM_SCALE + 0.05
          : 0.5;

        const topFrame = new THREE.Mesh(
          new THREE.BoxGeometry(doorW + 0.1, 0.1, frameThickness),
          frameMaterial,
        );
        topFrame.position.set(px, doorH + 0.05, pz);
        if (vectors)
          topFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
        scene.add(topFrame);

        const leftFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, doorH, frameThickness),
          frameMaterial,
        );
        const lx = px - (vectors?.dir.x || 0) * (doorW / 2 + 0.05);
        const lz = pz - (vectors?.dir.z || 0) * (doorW / 2 + 0.05);
        leftFrame.position.set(lx, doorH / 2, lz);
        if (vectors)
          leftFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
        scene.add(leftFrame);

        const rightFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, doorH, frameThickness),
          frameMaterial,
        );
        const rx = px + (vectors?.dir.x || 0) * (doorW / 2 + 0.05);
        const rz = pz + (vectors?.dir.z || 0) * (doorW / 2 + 0.05);
        rightFrame.position.set(rx, doorH / 2, rz);
        if (vectors)
          rightFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
        scene.add(rightFrame);
      };

      // If door has a model URL, load by extension. On any failure, fall back to procedural door.
      const modelUrl =
        (element as any)?.metadata?.door_model_url ||
        (element as any)?.metadata?.doorModelUrl;
      if (modelUrl) {
        const normalizedUrl = String(modelUrl).trim();
        const lowerUrl = normalizedUrl.split("?")[0].toLowerCase();
        const placeholder = new THREE.Group();
        placeholder.position.set(px, 0, pz);
        scene.add(placeholder);

        const placeDoorObject = (obj: THREE.Object3D) => {
          // Normalize FIRST (while unrotated) so we can scale width/height accurately
          normalizeImportedModel(
            obj,
            new THREE.Vector3(0, 0, 0),
            doorW,
            doorH,
            hostWall ? hostWall.thickness / MM_SCALE : 0.46,
            normalizedUrl
          );

          // Then rotate
          obj.rotation.y = vectors
            ? -Math.atan2(vectors.dir.z, vectors.dir.x)
            : 0;

          placeholder.add(obj);
          interactiveObjects.push(obj);
        };

        const failToProcedural = (reason: any) => {
          console.warn(
            "Door model load failed, using procedural fallback:",
            reason,
          );
          scene.remove(placeholder);
          renderProceduralDoor();
        };

        if (lowerUrl.endsWith(".stl")) {
          const stlLoader = new STLLoader();
          stlLoader.load(
            normalizedUrl,
            (geometry: any) => {
              const mesh = new THREE.Mesh(geometry);
              placeDoorObject(mesh);
            },
            undefined,
            failToProcedural,
          );
          return;
        }

        if (lowerUrl.endsWith(".obj")) {
          const objLoader = new OBJLoader();
          objLoader.load(
            normalizedUrl,
            placeDoorObject,
            undefined,
            failToProcedural,
          );
          return;
        }

        const gltfLoader = new GLTFLoader();
        gltfLoader.load(
          normalizedUrl,
          (gltf: any) => {
            const obj = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
            placeDoorObject(obj);
          },
          undefined,
          failToProcedural,
        );
        return;
      }

      // Procedural door fallback (default)
      renderProceduralDoor();
    });

    model3D.windows.forEach((window_) => {
      const winW = Math.max(window_.width / MM_SCALE, 0.1);
      const winH = Math.max(window_.height / MM_SCALE, 0.1);
      const hostWall = window_.wallId
        ? wallById.get(window_.wallId)
        : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;
      const sillHeight = (window_.position.z || 1000) / MM_SCALE;

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.8,
      });

      // Window frame (simplified as a hollow border using 4 boxes)
      const fT = 0.1; // frame thickness
      const frameThickness = hostWall
        ? hostWall.thickness / MM_SCALE + 0.02
        : 0.48;
      const winFrame = new THREE.Group();

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(winW + fT, fT, frameThickness),
        frameMaterial,
      );
      top.position.y = winH / 2 + fT / 2;

      const bottom = new THREE.Mesh(
        new THREE.BoxGeometry(winW + fT, fT, frameThickness),
        frameMaterial,
      );
      bottom.position.y = -winH / 2 - fT / 2;

      const left = new THREE.Mesh(
        new THREE.BoxGeometry(fT, winH, frameThickness),
        frameMaterial,
      );
      left.position.x = -winW / 2 - fT / 2;

      const right = new THREE.Mesh(
        new THREE.BoxGeometry(fT, winH, frameThickness),
        frameMaterial,
      );
      right.position.x = winW / 2 + fT / 2;

      winFrame.add(top, bottom, left, right);

      const projectedWindow = projectOpeningCenterToWall(
        window_,
        hostWall,
        winW,
      );
      const px = projectedWindow.x;
      const pz = projectedWindow.z;

      winFrame.position.set(px, sillHeight + winH / 2, pz);
      if (vectors)
        winFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(winFrame);

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(winW - 0.05, winH - 0.05, 0.1),
        new THREE.MeshStandardMaterial({
          color: "#7dd3fc",
          transparent: true,
          opacity: 0.5,
          roughness: 0.2,
          metalness: 0.15,
        }),
      );
      glass.position.set(px, sillHeight + winH / 2, pz);
      if (vectors) {
        glass.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      }
      scene.add(glass);
    });

    const furnitureColorMap: Record<string, string> = {
      Chair: "#8B4513",
      Sofa: "#A9A9A9",
      Table: "#CD853F",
      TV: "#111111",
      Bed: "#f1d5dc",
      Cabinet: "#7c4a1d",
      Desk: "#9a7f6f",
      Bookshelf: "#654321",
      Sink: "#d1d5db",
    };

    // Function to create furniture-specific geometry
    const createFurnitureGeometry = (item: FurnitureItem) => {
      const w = Math.max((item.width || 1) * METERS_TO_WORLD, 0.05);
      const d = Math.max((item.depth || 1) * METERS_TO_WORLD, 0.05);
      const h = Math.max((item.height || 0.8) * METERS_TO_WORLD, 0.05);

      // Create furniture-specific shapes
      switch (item.assetType) {
        case "Sofa": {
          const group = new THREE.Group();
          // Main seat
          const seatGeo = new THREE.BoxGeometry(w, h * 0.6, d);
          const seatMat = new THREE.MeshStandardMaterial({
            color: furnitureColorMap.Sofa,
            roughness: 0.6,
            metalness: 0.1,
          });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          seat.position.y = h * 0.3;
          group.add(seat);

          // Back cushion
          const backGeo = new THREE.BoxGeometry(w, h * 0.5, d * 0.3);
          const back = new THREE.Mesh(backGeo, seatMat);
          back.position.set(0, h * 0.6, -d * 0.35);
          group.add(back);

          // Left arm
          const armGeo = new THREE.BoxGeometry(d * 0.4, h * 0.5, d);
          const arm = new THREE.Mesh(armGeo, seatMat);
          arm.position.set(-w * 0.5 - d * 0.2, h * 0.4, 0);
          group.add(arm.clone());
          arm.position.x = w * 0.5 + d * 0.2;
          group.add(arm);

          return group;
        }

        case "Bed": {
          const group = new THREE.Group();
          const matGeo = new THREE.BoxGeometry(w * 0.95, h * 0.2, d * 0.95);
          const matMat = new THREE.MeshStandardMaterial({
            color: "#f1d5dc",
            roughness: 0.7,
          });
          const mattress = new THREE.Mesh(matGeo, matMat);
          mattress.position.y = h * 0.5;
          group.add(mattress);

          // Headboard
          const headGeo = new THREE.BoxGeometry(w * 0.95, h * 0.8, d * 0.15);
          const headMat = new THREE.MeshStandardMaterial({
            color: "#8B4513",
            roughness: 0.6,
          });
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.set(0, h * 0.6, -d * 0.5);
          group.add(head);

          return group;
        }

        case "Chair": {
          const group = new THREE.Group();
          const seatGeo = new THREE.BoxGeometry(w, h * 0.3, d);
          const seatMat = new THREE.MeshStandardMaterial({
            color: furnitureColorMap.Chair,
            roughness: 0.5,
          });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          seat.position.y = h * 0.25;
          group.add(seat);

          // Back
          const backGeo = new THREE.BoxGeometry(w, h * 0.6, d * 0.2);
          const back = new THREE.Mesh(backGeo, seatMat);
          back.position.set(0, h * 0.55, -d * 0.4);
          group.add(back);

          // Legs
          const legGeo = new THREE.BoxGeometry(w * 0.2, h * 0.25, d * 0.2);
          const legMat = new THREE.MeshStandardMaterial({
            color: "#654321",
            roughness: 0.7,
          });
          [
            [-w * 0.3, -d * 0.3],
            [-w * 0.3, d * 0.3],
            [w * 0.3, -d * 0.3],
            [w * 0.3, d * 0.3],
          ].forEach(([x, z]) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(x, h * 0.125, z);
            group.add(leg);
          });

          return group;
        }

        case "Table": {
          const group = new THREE.Group();
          const topGeo = new THREE.BoxGeometry(w, h * 0.1, d);
          const topMat = new THREE.MeshStandardMaterial({
            color: furnitureColorMap.Table,
            roughness: 0.4,
          });
          const top = new THREE.Mesh(topGeo, topMat);
          top.position.y = h * 0.9;
          group.add(top);

          // Legs
          const legGeo = new THREE.BoxGeometry(w * 0.15, h * 0.8, d * 0.15);
          const legMat = new THREE.MeshStandardMaterial({
            color: "#654321",
            roughness: 0.6,
          });
          [
            [-w * 0.35, -d * 0.35],
            [-w * 0.35, d * 0.35],
            [w * 0.35, -d * 0.35],
            [w * 0.35, d * 0.35],
          ].forEach(([x, z]) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(x, h * 0.4, z);
            group.add(leg);
          });

          return group;
        }

        case "TV": {
          const group = new THREE.Group();
          const bodyGeo = new THREE.BoxGeometry(w * 0.95, h * 0.95, d * 0.5);
          const bodyMat = new THREE.MeshStandardMaterial({
            color: "#111111",
            roughness: 0.3,
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.y = h * 0.5;
          group.add(body);

          // Screen
          const screenGeo = new THREE.BoxGeometry(w * 0.9, h * 0.85, d * 0.1);
          const screenMat = new THREE.MeshStandardMaterial({
            color: "#0a0a0a",
            emissive: "#1a1a1a",
            roughness: 0.1,
          });
          const screen = new THREE.Mesh(screenGeo, screenMat);
          screen.position.set(0, h * 0.5, d * 0.2);
          group.add(screen);

          // Stand
          const standGeo = new THREE.BoxGeometry(w * 0.4, h * 0.3, d);
          const standMat = new THREE.MeshStandardMaterial({
            color: "#333333",
            roughness: 0.5,
          });
          const stand = new THREE.Mesh(standGeo, standMat);
          stand.position.y = h * 0.15;
          group.add(stand);

          return group;
        }

        case "Cabinet": {
          const group = new THREE.Group();
          const bodyGeo = new THREE.BoxGeometry(w, h, d);
          const bodyMat = new THREE.MeshStandardMaterial({
            color: furnitureColorMap.Cabinet,
            roughness: 0.6,
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.y = h * 0.5;
          group.add(body);

          // Doors
          const doorGeo = new THREE.BoxGeometry(w * 0.45, h * 0.9, d * 0.05);
          const doorMat = new THREE.MeshStandardMaterial({
            color: "#6B3A1F",
            roughness: 0.5,
          });
          const door1 = new THREE.Mesh(doorGeo, doorMat);
          door1.position.set(-w * 0.25, h * 0.5, d * 0.48);
          group.add(door1);
          const door2 = door1.clone();
          door2.position.x = w * 0.25;
          group.add(door2);

          return group;
        }

        default:
          return new THREE.BoxGeometry(w, h, d);
      }
    };

    console.log("🛋️ Furniture items to render:", furnitureItems.length);

    furnitureItems.forEach((item, idx) => {
      const h = Math.max((item.height || 0.8) * METERS_TO_WORLD, 0.05);
      const color =
        item.metadata?.color || furnitureColorMap[item.assetType] || "#64748b";

      console.log(
        `📦 Furniture ${idx}: ${item.assetType} | Position: (${item.x}m, ${item.y}m) → (${(item.x * METERS_TO_WORLD).toFixed(2)}, ${(h / 2).toFixed(2)}, ${(item.y * METERS_TO_WORLD).toFixed(2)})`,
      );

      // Create furniture geometry
      const geom = createFurnitureGeometry(item);
      let mesh: THREE.Object3D;

      if (geom instanceof THREE.Group) {
        mesh = geom;
      } else {
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.75,
          metalness: 0.05,
        });
        mesh = new THREE.Mesh(geom, material);
      }

      mesh.position.set(item.x * METERS_TO_WORLD, 0, item.y * METERS_TO_WORLD);
      mesh.rotation.y = (item.z || 0) * (Math.PI / 180);
      mesh.userData = {
        kind: "furniture",
        id: item.id,
      };
      snapObjectToGround(mesh);
      scene.add(mesh);
      interactiveObjects.push(mesh);

      console.log(`✅ Added ${item.assetType} (${item.family}) to scene`);
    });

    // Load imported GLTF/GLB models
    if (importedModels.length > 0) {
      console.log(
        `🎯 Starting to load ${importedModels.length} imported models...`,
      );
      const gltfLoader = new GLTFLoader();
      const fbxLoader = new FBXLoader();
      const objLoader = new OBJLoader();

      const getModelUrl = (model: { id: string }) =>
        `${backendUrl}/api/projects/${projectId}/models/${model.id}/download`;

      importedModels.forEach((model) => {
        const modelUrl = getModelUrl(model);
        const ext = model.file_path.split(".").pop()?.toLowerCase();

        const placeImportedModel = (obj: THREE.Object3D, index: number) => {
          console.log(
            `📦 Placing imported model ${index + 1}: ${model.name} (${ext})`,
          );
          normalizeImportedModel(
            obj,
            new THREE.Vector3(
              12 + (index % 3) * 8,
              0,
              12 + Math.floor(index / 3) * 8,
            ),
          );
          obj.userData = {
            kind: "imported_model",
            id: model.id,
          };
          scene.add(obj);
          interactiveObjects.push(obj);
        };

        if (ext === "fbx") {
          fbxLoader.load(
            modelUrl,
            (fbx: any) => {
              placeImportedModel(fbx, importedModels.indexOf(model));
              console.log(`✅ Loaded imported FBX: ${model.name}`);
            },
            undefined,
            (error: any) => {
              console.error(`❌ Failed to load FBX ${model.name}:`, error);
            },
          );
          return;
        }

        if (ext === "obj") {
          const mtlUrl = modelUrl.replace(/\.obj$/i, ".mtl");
          const mtlLoader = new MTLLoader();

          // Try to load MTL file if it exists
          mtlLoader.load(
            mtlUrl,
            (materials: any) => {
              materials.preload();
              objLoader.setMaterials(materials);
              objLoader.load(
                modelUrl,
                (obj: any) => {
                  placeImportedModel(obj, importedModels.indexOf(model));
                  console.log(
                    `✅ Loaded imported OBJ with materials: ${model.name}`,
                  );
                },
                undefined,
                (error: any) => {
                  console.error(`❌ Failed to load OBJ ${model.name}:`, error);
                  // Fallback: load OBJ without materials
                  console.log(`⚠️ Retrying OBJ without MTL for ${model.name}`);
                  objLoader.load(
                    modelUrl,
                    (obj: any) => {
                      // Apply default material if no MTL was loaded
                      obj.traverse((child: any) => {
                        if (child instanceof THREE.Mesh && !child.material) {
                          child.material = new THREE.MeshStandardMaterial({
                            color: "#888888",
                            roughness: 0.5,
                            metalness: 0.1,
                          });
                        }
                      });
                      placeImportedModel(obj, importedModels.indexOf(model));
                      console.log(
                        `✅ Loaded imported OBJ without materials: ${model.name}`,
                      );
                    },
                    undefined,
                    (error2: any) => {
                      console.error(
                        `❌ Failed to load OBJ without MTL ${model.name}:`,
                        error2,
                      );
                    },
                  );
                },
              );
            },
            undefined,
            () => {
              // MTL file not found, load OBJ without materials
              console.log(
                `⚠️ MTL file not found for ${model.name}, loading OBJ without materials`,
              );
              objLoader.load(
                modelUrl,
                (obj: any) => {
                  // Apply default material to all meshes
                  obj.traverse((child: any) => {
                    if (child instanceof THREE.Mesh) {
                      child.material = new THREE.MeshStandardMaterial({
                        color: "#888888",
                        roughness: 0.5,
                        metalness: 0.1,
                      });
                    }
                  });
                  placeImportedModel(obj, importedModels.indexOf(model));
                  console.log(
                    `✅ Loaded imported OBJ (no MTL found): ${model.name}`,
                  );
                },
                undefined,
                (error: any) => {
                  console.error(`❌ Failed to load OBJ ${model.name}:`, error);
                },
              );
            },
          );
          return;
        }

        if (ext === "stl") {
          const stlLoader = new STLLoader();
          stlLoader.load(
            modelUrl,
            (geometry: any) => {
              const mat = new THREE.MeshStandardMaterial({ color: "#888888" });
              const mesh = new THREE.Mesh(geometry, mat);
              placeImportedModel(mesh, importedModels.indexOf(model));
              console.log(`✅ Loaded imported STL: ${model.name}`);
            },
            undefined,
            (err: any) => {
              console.error(`❌ Failed to load STL ${model.name}:`, err);
            },
          );
          return;
        }

        gltfLoader.load(
          modelUrl,
          (gltf: any) => {
            const modelMesh = gltf.scene;
            placeImportedModel(modelMesh, importedModels.indexOf(model));
            console.log(`✅ Loaded imported model: ${model.name}`);
          },
          undefined,
          (error: any) => {
            console.error(`❌ Failed to load model ${model.name}:`, error);
          },
        );
      });
    }

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: "#0f172a", side: 2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    const onResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let rafId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      if (transformControls) {
        transformControls.detach();
        transformControls.dispose();
      }
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [elements, projectId, furnitureItems, importedModels, showDebugGuides]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        type="button"
        onClick={() => setShowDebugGuides((prev) => !prev)}
        className="absolute left-3 top-3 z-10 rounded border border-slate-500 bg-slate-900/80 px-3 py-1 text-xs text-slate-100"
      >
        {showDebugGuides ? "Hide" : "Show"} Alignment Debug
      </button>
    </div>
  );
}
