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
import { convert2DTo3D } from "@/lib/geometry3d";
import { Door, Element, FurnitureItem, Window } from "@/types/modeling";

interface Model3DPreviewProps {
  elements: Element[];
  projectId: string;
}

const PLAN_SCALE = 10;
const MM_SCALE = 500; // Consistent with MM_TO_CANVAS = 50 and PLAN_SCALE = 10
const MM_TO_CANVAS = 50; // From CADEditor - 1 meter = 50 canvas pixels
const METERS_TO_WORLD = MM_TO_CANVAS / PLAN_SCALE; // 50 / 10 = 5 (scale factor for furniture from meters to world units)

export default function Model3DPreview({
  elements,
  projectId,
}: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

    const transformControls = new TransformControls(
      camera,
      renderer.domElement,
    );
    transformControls.setMode("translate");
    transformControls.showY = false;
    scene.add(transformControls);

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
    ) => {
      // Normalize imported model size to a realistic furniture range and center
      // it so the object sits as a single grounded asset rather than drifting.
      const targetMaxSize = METERS_TO_WORLD * 2.2;

      const preBox = new THREE.Box3().setFromObject(obj);
      const preSize = new THREE.Vector3();
      preBox.getSize(preSize);
      const maxDim = Math.max(preSize.x, preSize.y, preSize.z);
      if (maxDim > 0.0001) {
        const factor = targetMaxSize / maxDim;
        obj.scale.multiplyScalar(factor);
      }

      const postBox = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      postBox.getCenter(center);

      obj.position.x += targetPosition.x - center.x;
      obj.position.z += targetPosition.z - center.z;
      obj.position.y += targetPosition.y - postBox.min.y;
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

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    scene.add(new THREE.AmbientLight("#ffffff", 0.7));

    const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
    keyLight.position.set(150, 180, 120);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.45);
    fillLight.position.set(-120, 100, -100);
    scene.add(fillLight);

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
      openings.forEach((op) => {
        const opW = op.width / MM_SCALE;
        const opH = op.height / MM_SCALE;

        // Calculate offset from wall start
        const dist =
          Math.hypot(
            op.position.x - wall.startPoint.x,
            op.position.y - wall.startPoint.y,
          ) / PLAN_SCALE;
        const sillH =
          (op.type === "window" ? (op as any).position.z || 1000 : 0) /
          MM_SCALE;

        const hole = new THREE.Path();
        const xStart = dist - opW / 2;
        hole.moveTo(xStart, sillH);
        hole.lineTo(xStart + opW, sillH);
        hole.lineTo(xStart + opW, sillH + opH);
        hole.lineTo(xStart, sillH + opH);
        hole.closePath();
        shape.holes.push(hole);
      });

      const geometry = new (THREE as any).ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      });
      const material = new THREE.MeshStandardMaterial({
        color: "#d4a574",
        roughness: 0.85,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Position: Start point, centered on thickness
      mesh.position.set(
        wall.startPoint.x / PLAN_SCALE,
        0,
        wall.startPoint.y / PLAN_SCALE,
      );
      mesh.rotation.y = -Math.atan2(dy, dx);

      // Offset by half thickness to center the wall on the line
      const angle = -Math.atan2(dy, dx);
      mesh.position.x += Math.sin(angle) * (thickness / 2);
      mesh.position.z += Math.cos(angle) * (thickness / 2);

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

    model3D.doors.forEach((door) => {
      const doorW = Math.max(door.width / MM_SCALE, 0.1);
      const doorH = Math.max(door.height / MM_SCALE, 0.1);
      const hostWall = door.wallId ? wallById.get(door.wallId) : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;

      const doorLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.05, doorH - 0.05, 0.2),
        new THREE.MeshStandardMaterial({
          color: "#7c2d12",
          roughness: 0.55,
          metalness: 0.1,
        }),
      );

      const px_base = door.position.x / PLAN_SCALE;
      const pz_base = door.position.y / PLAN_SCALE;

      // Apply the same offset as the wall to center it
      const angle = hostWall
        ? -Math.atan2(
            hostWall.endPoint.y - hostWall.startPoint.y,
            hostWall.endPoint.x - hostWall.startPoint.x,
          )
        : 0;
      const wallThickness = hostWall ? hostWall.thickness / MM_SCALE : 0.46;
      const px = px_base + Math.sin(angle) * (wallThickness / 2);
      const pz = pz_base + Math.cos(angle) * (wallThickness / 2);

      doorLeaf.position.set(px, doorH / 2, pz);
      if (vectors) {
        doorLeaf.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      }
      scene.add(doorLeaf);

      // Add a small handle for visibility
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

      // Create frame as a dark wooden border
      const frameColor = "#522b11";
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: 0.7,
      });
      const frameThickness = hostWall
        ? hostWall.thickness / MM_SCALE + 0.05
        : 0.5;

      // Top frame
      const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(doorW + 0.1, 0.1, frameThickness),
        frameMaterial,
      );
      topFrame.position.set(px, doorH + 0.05, pz);
      if (vectors)
        topFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(topFrame);

      // Left frame
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

      // Right frame
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

      const px_base = window_.position.x / PLAN_SCALE;
      const pz_base = window_.position.y / PLAN_SCALE;
      const angle = hostWall
        ? -Math.atan2(
            hostWall.endPoint.y - hostWall.startPoint.y,
            hostWall.endPoint.x - hostWall.startPoint.x,
          )
        : 0;
      const wallThickness = hostWall ? hostWall.thickness / MM_SCALE : 0.46;
      const px = px_base + Math.sin(angle) * (wallThickness / 2);
      const pz = pz_base + Math.cos(angle) * (wallThickness / 2);

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
      const gltfLoader = new GLTFLoader();
      const fbxLoader = new FBXLoader();
      const objLoader = new OBJLoader();

      const getModelUrl = (model: { id: string }) =>
        `${backendUrl}/api/projects/${projectId}/models/${model.id}/download`;

      importedModels.forEach((model) => {
        const modelUrl = getModelUrl(model);
        const ext = model.file_path.split(".").pop()?.toLowerCase();

        const placeImportedModel = (obj: THREE.Object3D, index: number) => {
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
          objLoader.load(
            modelUrl,
            (obj: any) => {
              placeImportedModel(obj, importedModels.indexOf(model));
              console.log(`✅ Loaded imported OBJ: ${model.name}`);
            },
            undefined,
            (error: any) => {
              console.error(`❌ Failed to load OBJ ${model.name}:`, error);
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
      transformControls.detach();
      transformControls.dispose();
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
  }, [elements, projectId, furnitureItems, importedModels]);

  return <div ref={containerRef} className="w-full h-full" />;
}
