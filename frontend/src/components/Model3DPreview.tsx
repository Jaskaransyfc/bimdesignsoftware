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
import {
  renderClassicDoubleDoor,
  renderMandalaDoubleDoor,
  renderSlimBlackGlassDoor,
  renderGeometricArtGlassDoor,
  renderLuxuryGoldGlassDoor,
  renderModernSlidingGlassDoor,
  renderLuxuryDoor,
  renderProceduralDoor,
  renderModernWoodInlayDoor,
  renderSlattedPivotDoor,
} from "./modeling/doors";
import {
  renderFloatingSwitchbackStairs,
  renderSpiralMetalStairs,
  renderConcreteParametricStairs,
} from "./modeling/stairs";
import {
  renderWaterTank,
  renderSofa3Seater,
  renderCenterTable,
  renderDoubleBed,
  renderWallPainting,
  renderSofa1Seater,
  renderSingleBed,
  renderDiningTable,
  renderTVPanel,
  renderCeilingFan,
  renderModularKitchenL,
  renderKitchenSingleWall,
  renderCoveCeiling,
  renderGeometricCeiling,
  renderCarpet,
  renderIndianCoveCeiling,
  renderFloatingCoveCeiling,
  renderWoodenPanelCeiling,
} from "./modeling/items";
import {
  renderSlidingGlassWindow,
  renderProceduralWindow,
  renderDoubleCasementTransomWindow,
  renderTripleCasementWindow,
  renderCircularWindow,
  renderTriangleWindow,
  renderPatternWindow,
  renderOvalWindow,
  renderCurvedWindow,
  renderSemiCurvedWindow,
} from "./modeling/windows";
import {
  renderModernMetalRailing,
  renderHorizontalMetalRailing,
  renderRoofGlassRailing,
  renderTreeBranchStairRailing,
} from "./modeling/railings";
import {
  renderMarbleVitrifiedFloor,
  renderConcreteTileFloor,
  renderDecorativeMedallionFloor,
  renderLuxuryStoneFloor,
  renderCheckerCeramicFloor,
} from "./modeling/floors";
import { renderRailing } from "./modeling/railings/RailingRenderer";
import { convert2DTo3D } from "@/lib/geometry3d";
import { renderWoodenSlatWall, renderStandardBIMWall } from "./modeling/walls";
import { renderPartitionWall } from "./modeling/partitions/PartitionWallRenderer";
import {
  renderClearGlassPartition,
  renderFrostedGlassPartition,
  renderRibbedGlassPartition,
  renderSmokedGlassPartition,
  renderGradientGlassPartition,
  renderColoredLaminatedPartition,
  renderOakSlatPartition,
  renderAshWoodPartition,
  renderMatteBlackWoodPartition,
} from "./modeling/walls/partitionWalls";
import {
  renderExposedConcreteCompoundWall,
  renderNaturalStoneCompoundWall,
  renderWoodenSlatCompoundWall,
  renderBrickTextureCompoundWall,
} from "./modeling/walls/compoundWalls";
import {
  renderSoftRoundedFlatRoof,
  renderModernFlatRoof,
  renderSlopedTileRoof,
  renderSymmetricGableRoof,
  renderThatchedRoof,
} from "./modeling/roofs";
import {
  Door,
  Element,
  ElectricalFixture,
  FurnitureItem,
  Level,
  Polyline,
  Window,
  Wall,
  Railing,
  Roof,
} from "@/types/modeling";
import { mmToWorldY } from "@/lib/calculations";

interface Model3DPreviewProps {
  elements: Element[];
  projectId: string;
  selectedElementId?: string | null;
  levels?: Level[];
  activeLevelId?: string | null;
}

const PLAN_SCALE = 10;
const MM_SCALE = 500; // 1000mm = 2 units (consistent with 1px = 50mm and PLAN_SCALE = 10)
const MM_TO_CANVAS = 50; // 1 pixel = 50mm
const METERS_TO_WORLD = 2; // 1 meter = 2 units (since 1m = 20px and 10px = 1 unit)

export default function Model3DPreview({
  elements,
  projectId,
  selectedElementId,
  levels = [],
  activeLevelId = null,
}: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showDebugGuides, setShowDebugGuides] = useState(false);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [visibleLevelIds, setVisibleLevelIds] = useState<Record<string, boolean>>({});
  const [importedModels, setImportedModels] = useState<
    Array<{
      id: string;
      name: string;
      file_path: string;
      model_type: string;
    }>
  >([]);
  const cameraStateRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!levels.length) return;
    setVisibleLevelIds((prev) => {
      const next: Record<string, boolean> = {};
      levels.forEach((level) => {
        next[level.id] = prev[level.id] ?? true;
      });
      return next;
    });
  }, [levels]);

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
    // camera.position.set(120, 120, 140); // Will be set by controls later if not in ref

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 10000;

    if (cameraStateRef.current) {
      camera.position.copy(cameraStateRef.current.position);
      controls.target.copy(cameraStateRef.current.target);
    } else {
      camera.position.set(120, 120, 140);
      controls.target.set(0, 10, 0);
    }
    controls.update();

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
      assetName?: string,
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

      const isSelected =
        selectedElementId !== undefined &&
        assetName?.includes(selectedElementId || "___NONE___");

      obj.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            color: isSelected ? "#3b82f6" : baseColor,
            roughness: isGlass ? 0.1 : 0.7,
            metalness: isGlass ? 0.2 : 0.1,
            transparent: isGlass,
            opacity: isGlass ? 0.6 : 1.0,
            side: THREE.DoubleSide,
            emissive: isSelected ? "#1d4ed8" : "#000000",
            emissiveIntensity: isSelected ? 0.5 : 0,
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

    const levelMap = new Map(levels.map((level) => [level.id, level]));
    const filteredElements = elements.filter((element) => {
      const levelId = (element as any).levelId;
      if (!levelId) return true;
      return visibleLevelIds[levelId] ?? true;
    });
    const getYOffset = (levelId?: string) => {
      if (!levelId) return 0;
      const level = levelMap.get(levelId);
      return level ? mmToWorldY(level.elevation_mm) : 0;
    };

    const levelGroups = new Map<string, THREE.Group>();
    const getLevelGroup = (levelId?: string) => {
      if (!levelId) return scene;
      let group = levelGroups.get(levelId);
      if (!group) {
        group = new THREE.Group();
        group.name = `levelGroup_${levelId}`;
        group.position.y = getYOffset(levelId);
        group.visible = visibleLevelIds[levelId] ?? true;
        scene.add(group);
        levelGroups.set(levelId, group);
      }
      return group;
    };

    const model3D = convert2DTo3D(filteredElements, projectId);
    const wallById = new Map(model3D.walls.map((wall) => [wall.id, wall]));
    const electricalFixtures = filteredElements.filter(
      (element): element is ElectricalFixture =>
        element.type === "electrical_fixture",
    );
    const circuitLines = filteredElements.filter(
      (element): element is Polyline => element.type === "polyline",
    );
    const selectedElement =
      selectedElementId != null
        ? (filteredElements.find((element) => element.id === selectedElementId) ?? null)
        : null;
    const selectedCircuitId =
      selectedElement?.type === "electrical_fixture"
        ? selectedElement.circuitId ||
          selectedElement.metadata?.circuitId ||
          null
        : selectedElement?.type === "polyline"
          ? selectedElement.metadata?.circuitId || null
          : null;
    const selectedBranchIds =
      selectedElement?.type === "electrical_fixture"
        ? new Set(
            circuitLines
              .filter(
                (circuit) => circuit.metadata?.branchId === selectedElement.id,
              )
              .map((circuit) => circuit.id),
          )
        : new Set<string>();
    const doorById = new Map(
      filteredElements
        .filter((element): element is Door => element.type === "door")
        .map((door) => [door.id, door]),
    );
    const windowById = new Map(
      filteredElements
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
      return { dir, normal, wallUnitX: dir.x, wallUnitY: dir.z };
    };

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const projectFixtureToWall = (
      fixture: ElectricalFixture,
      wall: {
        startPoint: { x: number; y: number };
        endPoint: { x: number; y: number };
        thickness?: number;
      },
    ) => {
      const { dir, normal } = getWallVectors(wall);
      const fixtureWorldX = fixture.position.x / PLAN_SCALE;
      const fixtureWorldZ = fixture.position.y / PLAN_SCALE;
      const wallStartWorld = {
        x: wall.startPoint.x / PLAN_SCALE,
        z: wall.startPoint.y / PLAN_SCALE,
      };
      const wallEndWorld = {
        x: wall.endPoint.x / PLAN_SCALE,
        z: wall.endPoint.y / PLAN_SCALE,
      };
      const wallLength = Math.hypot(
        wallEndWorld.x - wallStartWorld.x,
        wallEndWorld.z - wallStartWorld.z,
      );
      const relX = fixtureWorldX - wallStartWorld.x;
      const relZ = fixtureWorldZ - wallStartWorld.z;
      const distAlongWall = clamp(
        relX * dir.x + relZ * dir.z,
        0,
        wallLength || 0,
      );
      const centerX = wallStartWorld.x + dir.x * distAlongWall;
      const centerZ = wallStartWorld.z + dir.z * distAlongWall;
      const thicknessOffset = (wall.thickness || 0) / MM_SCALE / 2;
      const fixtureOffset = Math.max(0.12, thicknessOffset + 0.08);
      const wallSide = (fixture as any).metadata?.wallSide ?? fixture.wallSide;
      const sideSign = wallSide === "outside" ? -1 : 1;

      return {
        x: centerX + normal.x * fixtureOffset * sideSign,
        z: centerZ + normal.z * fixtureOffset * sideSign,
      };
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
    filteredElements.forEach((el) => {
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

      const wallDirLen = Math.hypot(dx, dy);
      const wallUnitX = dx / (wallDirLen || 1);
      const wallUnitY = dy / (wallDirLen || 1);

      const processedOpenings = openings
        .filter((op) => {
          // Robust validation to prevent NaN issues in Three.js
          return (
            op &&
            typeof op.width === "number" &&
            !isNaN(op.width) &&
            typeof op.height === "number" &&
            !isNaN(op.height) &&
            op.position &&
            !isNaN(op.position.x) &&
            !isNaN(op.position.y)
          );
        })
        .map((op) => {
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

          const sillH =
            (op.type === "window"
              ? ((op as any).position?.z ?? (op as any).sillHeight ?? 900)
              : 0) / MM_SCALE;

          const xStart = distAlongWall - opW / 2;
          const style = (op as any).metadata?.windowStyle || "";

          // CLAMP TO WALL HEIGHT
          const wallH = height;
          const clampedSillH = Math.max(0, Math.min(wallH - 0.1, sillH));
          const clampedOpH = Math.min(opH, wallH - clampedSillH);

          return {
            minX: xStart,
            maxX: xStart + opW,
            height: clampedOpH,
            sillHeight: clampedSillH,
            style: style.toLowerCase(),
          };
        });

      const isSelected = selectedElementId === wall.id;
      const px = wall.startPoint.x / PLAN_SCALE;
      const pz = wall.startPoint.y / PLAN_SCALE;
      const rotation = -Math.atan2(dy, dx);
      const materialName = wall.material?.toLowerCase() || "";

      if (materialName.includes("clear_glass_partition")) {
        renderClearGlassPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("frosted_glass_partition")) {
        renderFrostedGlassPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("ribbed_glass_partition")) {
        renderRibbedGlassPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("smoked_glass_partition")) {
        renderSmokedGlassPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("gradient_glass_partition")) {
        renderGradientGlassPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("colored_laminated_partition")) {
        renderColoredLaminatedPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("oak_slat_partition")) {
        renderOakSlatPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("ash_wood_partition")) {
        renderAshWoodPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("matte_black_wood_partition")) {
        renderMatteBlackWoodPartition(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }

      // Compound Walls
      if (materialName.includes("exposed_concrete_compound")) {
        renderExposedConcreteCompoundWall(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("natural_stone_compound")) {
        renderNaturalStoneCompoundWall(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("wooden_slat_compound")) {
        renderWoodenSlatCompoundWall(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }
      if (materialName.includes("brick_texture_compound")) {
        renderBrickTextureCompoundWall(
          scene,
          px,
          pz,
          length,
          height,
          rotation,
          isSelected,
        );
        return;
      }

      let material;

      if (wall.material === "Wooden Slat") {
        material = renderWoodenSlatWall(
          scene,
          wall,
          dx,
          dy,
          length,
          thickness,
          height,
          processedOpenings,
          isSelected,
          wall.color,
        );
      } else if (
        [
          "Clear Glass Partition",
          "Frosted Glass Partition",
          "Etched Pattern Glass",
          "Gradient Frosted Glass",
          "Cracked Ice Glass",
          "Digital Printed Glass",
          "Natural Oak Slats",
          "Walnut Wood Slats",
          "Charred Wood",
        ].includes(wall.material)
      ) {
        material = renderPartitionWall(
          scene,
          wall,
          dx,
          dy,
          length,
          thickness,
          height,
          processedOpenings,
          isSelected,
        );
      } else {
        material = renderStandardBIMWall(
          scene,
          wall,
          dx,
          dy,
          length,
          thickness,
          height,
          processedOpenings,
          isSelected,
          wall.color,
        );
      }

      // Add corner fillers (cylinders) to hide gaps between walls at angles
      const fillerGeom = new THREE.CylinderGeometry(
        thickness / 2,
        thickness / 2,
        height,
        16,
      );
      const fillerMat =
        material || new THREE.MeshStandardMaterial({ color: "#ffffff" });

      const startFiller = new THREE.Mesh(fillerGeom, fillerMat);
      startFiller.position.set(
        wall.startPoint.x / PLAN_SCALE,
        height / 2,
        wall.startPoint.y / PLAN_SCALE,
      );
      getLevelGroup((wall as any).levelId).add(startFiller);

      const endFiller = new THREE.Mesh(fillerGeom, fillerMat);
      endFiller.position.set(
        wall.endPoint.x / PLAN_SCALE,
        height / 2,
        wall.endPoint.y / PLAN_SCALE,
      );
      getLevelGroup((wall as any).levelId).add(endFiller);
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

    elements
      .filter((el): el is Railing => el.type === "railing")
      .forEach((railing) => {
        const railL = (railing.length || 8000) / MM_SCALE;
        const railH = (railing.height || 1100) / MM_SCALE;
        const px = railing.position.x / PLAN_SCALE;
        const pz = railing.position.y / PLAN_SCALE;
        const rotation = (railing.rotation || 0) * (Math.PI / 180);
        const style = String(
          railing.metadata?.railing_style || "",
        ).toLowerCase();

        if (style === "horizontal") {
          renderHorizontalMetalRailing(scene, px, pz, railL, railH, -rotation);
        } else if (style === "glass") {
          renderRoofGlassRailing(scene, px, pz, railL, -rotation);
        } else if (style === "tree_branch") {
          renderTreeBranchStairRailing(scene, px, pz, 8, 0.18, 0.28, -rotation);
        } else {
          renderModernMetalRailing(scene, px, pz, railL, railH, -rotation);
        }
      });

    elements
      .filter((el): el is Roof => el.type === "roof")
      .forEach((roof) => {
        const roofW = (roof.width || 8000) / MM_SCALE;
        const roofD = (roof.depth || 6000) / MM_SCALE;
        const px = roof.position.x / PLAN_SCALE;
        const pz = roof.position.y / PLAN_SCALE;
        const rotation = (roof.rotation || 0) * (Math.PI / 180);
        const style = String(roof.metadata?.roof_style || "").toLowerCase();
        const isSelected = selectedElementId === roof.id;

        if (style === "soft_rounded") {
          renderSoftRoundedFlatRoof(
            scene,
            px,
            pz,
            roofW,
            roofD,
            0.26,
            -rotation,
            isSelected,
          );
        } else if (style === "sloped_tile") {
          renderSlopedTileRoof(
            scene,
            px,
            pz,
            roofW,
            roofD,
            -rotation,
            isSelected,
          );
        } else if (style === "symmetric_gable") {
          renderSymmetricGableRoof(
            scene,
            px,
            pz,
            roofW,
            roofD,
            -rotation,
            isSelected,
          );
        } else if (style === "thatched") {
          renderThatchedRoof(
            scene,
            px,
            pz,
            roofW,
            roofD,
            -rotation,
            isSelected,
          );
        } else {
          renderModernFlatRoof(
            scene,
            px,
            pz,
            roofW,
            roofD,
            -rotation,
            isSelected,
          );
        }
      });

    model3D.doors.forEach((door) => {
      const doorW = Math.max(door.width / MM_SCALE, 0.1);
      const rawDoorH = Math.max(door.height / MM_SCALE, 0.1);
      const hostWall = door.wallId ? wallById.get(door.wallId) : undefined;
      const wallHeight = hostWall ? hostWall.height / MM_SCALE : 3.0;
      const doorH = Math.min(rawDoorH, wallHeight);
      const vectors = hostWall ? getWallVectors(hostWall) : null;

      const element = doorById.get(door.id);

      const projectedDoor = projectOpeningCenterToWall(door, hostWall, doorW);
      const px = projectedDoor.x;
      const pz = projectedDoor.z;

      const drawDoor = () => {
        const doorStyle = String(
          (element as any)?.metadata?.door_style || "",
        ).toLowerCase();
        const isLuxury = doorStyle === "luxury_modern";
        const isWoodInlay = doorStyle === "wood_inlay";
        const isSlatted = doorStyle === "slatted_pivot";
        const isClassic = doorStyle === "classic_double";
        const isMandala = doorStyle === "mandala_double";
        const isDouble =
          door.swingDirection === "double" || doorStyle === "double";
        const isMulti = doorStyle === "multi";
        const isGlass =
          String((door as any).material || "").toLowerCase() === "glass" ||
          doorStyle === "glass";

        if (isClassic) {
          renderClassicDoubleDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (isMandala) {
          renderMandalaDoubleDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (isSlatted) {
          renderSlattedPivotDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (isWoodInlay) {
          renderModernWoodInlayDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (isLuxury) {
          renderLuxuryDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (doorStyle === "slim_black" || doorStyle === "slim_black_glass") {
          renderSlimBlackGlassDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (
          doorStyle === "geometric_double" ||
          doorStyle === "geometric_double_glass"
        ) {
          renderGeometricArtGlassDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (
          doorStyle === "luxury_white_gold" ||
          doorStyle === "luxury_gold_glass"
        ) {
          renderLuxuryGoldGlassDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        if (
          doorStyle === "modern_sliding" ||
          doorStyle === "modern_sliding_glass"
        ) {
          renderModernSlidingGlassDoor(
            scene,
            px,
            pz,
            vectors,
            doorW,
            doorH,
            hostWall,
            selectedElementId === door.id,
            door.color,
          );
          return;
        }

        renderProceduralDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          door,
          element,
          hostWall,
          selectedElementId,
          door.color,
        );
      };

      const modelUrl =
        (element as any)?.metadata?.door_model_url ||
        (element as any)?.metadata?.doorModelUrl;

      if (modelUrl === "LUXURY_MODERN_V1") {
        renderLuxuryDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          hostWall,
          selectedElementId === door.id,
        );
      } else if (modelUrl === "MODERN_WOOD_INLAY_V1") {
        renderModernWoodInlayDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          hostWall,
          selectedElementId === door.id,
        );
      } else if (modelUrl === "SLATTED_PIVOT_V1") {
        renderSlattedPivotDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          hostWall,
          selectedElementId === door.id,
        );
      } else if (modelUrl === "CLASSIC_DOUBLE_V1") {
        renderClassicDoubleDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          hostWall,
          selectedElementId === door.id,
        );
      } else if (modelUrl === "MANDALA_DOUBLE_V1") {
        renderMandalaDoubleDoor(
          scene,
          px,
          pz,
          vectors,
          doorW,
          doorH,
          hostWall,
          selectedElementId === door.id,
        );
      } else if (modelUrl) {
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
            normalizedUrl,
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
          drawDoor();
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
      drawDoor();
    });

    model3D.windows.forEach((window_) => {
      const winW = Math.max(window_.width / MM_SCALE, 0.1);
      const hostWall = window_.wallId
        ? wallById.get(window_.wallId)
        : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;
      const wallHeight = hostWall ? hostWall.height / MM_SCALE : 3.0;

      const rawSillHeight =
        ((window_ as any).position?.z ?? (window_ as any).sillHeight ?? 900) /
        MM_SCALE;

      // CLAMP WINDOW TO WALL HEIGHT
      const sillHeight = Math.max(0, Math.min(wallHeight - 0.1, rawSillHeight));
      const winH = Math.min(
        Math.max(window_.height / MM_SCALE, 0.1),
        wallHeight - sillHeight,
      );

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.8,
      });

      const element = windowById.get(window_.id);
      const projectedWindow = projectOpeningCenterToWall(
        window_,
        hostWall,
        winW,
      );
      const px = projectedWindow.x;
      const pz = projectedWindow.z;

      const drawWindow = () => {
        const windowStyle = String(
          (element as any)?.metadata?.windowStyle || "",
        ).toLowerCase();
        const isSliding = windowStyle === "sliding";
        const isDoubleCasement = windowStyle === "double_casement_transom";

        if (windowStyle === "double_casement_transom") {
          renderDoubleCasementTransomWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "triple_casement") {
          renderTripleCasementWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "circular_fixed") {
          renderCircularWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "triangle_casement") {
          renderTriangleWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "pattern_arch") {
          renderPatternWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "oval_grille") {
          renderOvalWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "curved_arch") {
          renderCurvedWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (windowStyle === "semi_curved_grille") {
          renderSemiCurvedWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
          );
          return;
        }

        if (isSliding) {
          renderSlidingGlassWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            window_,
            hostWall,
            selectedElementId,
          );
          return;
        }

        renderProceduralWindow(
          scene,
          px,
          pz,
          vectors,
          winW,
          winH,
          sillHeight,
          window_,
          hostWall,
          selectedElementId,
        );
      };

      const modelUrl =
        (element as any)?.metadata?.window_model_url ||
        (element as any)?.metadata?.windowModelUrl;
      if (modelUrl) {
        const normalizedUrl = String(modelUrl).trim();
        const lowerUrl = normalizedUrl.split("?")[0].toLowerCase();
        const placeholder = new THREE.Group();
        placeholder.position.set(px, sillHeight + winH / 2, pz);
        scene.add(placeholder);

        const placeWindowObject = (obj: THREE.Object3D) => {
          normalizeImportedModel(
            obj,
            new THREE.Vector3(0, 0, 0),
            winW,
            winH,
            hostWall ? hostWall.thickness / MM_SCALE : 0.46,
            normalizedUrl,
          );

          obj.rotation.y = vectors
            ? -Math.atan2(vectors.dir.z, vectors.dir.x)
            : 0;

          placeholder.add(obj);
          interactiveObjects.push(obj);
        };

        const failToProcedural = (reason: any) => {
          console.warn(
            "Window model load failed, using procedural fallback:",
            reason,
          );
          scene.remove(placeholder);
          drawWindow();
        };

        if (modelUrl === "MODERN_SLIDING_V1") {
          renderSlidingGlassWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            window_,
            hostWall,
            selectedElementId,
          );
          return;
        }

        if (modelUrl === "DOUBLE_CASEMENT_TRANSOM_V1") {
          renderDoubleCasementTransomWindow(
            scene,
            px,
            pz,
            vectors,
            winW,
            winH,
            sillHeight,
            hostWall,
            selectedElementId === window_.id,
            window_.color,
          );
          return;
        }

        if (lowerUrl.endsWith(".stl")) {
          const stlLoader = new STLLoader();
          stlLoader.load(
            normalizedUrl,
            (geometry: any) => {
              const mesh = new THREE.Mesh(geometry);
              placeWindowObject(mesh);
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
            placeWindowObject,
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
            placeWindowObject(obj);
          },
          undefined,
          failToProcedural,
        );
        return;
      }

      drawWindow();
    });

    // --- RENDER RAILINGS ---
    elements
      .filter((el) => el.type === "railing")
      .forEach((railing: any) => {
        renderRailing(scene, railing, selectedElementId === railing.id);
      });

    // --- RENDER FLOORS ---
    elements
      .filter((el) => el.type === "floor")
      .forEach((floor: any) => {
        const px = floor.position.x / PLAN_SCALE;
        const pz = floor.position.y / PLAN_SCALE;
        const floorStyle = (floor.metadata?.floor_style || "").toLowerCase();
        const modelUrl = floor.metadata?.floor_model_url;

        const isMarble =
          floorStyle === "marble_vitrified" ||
          modelUrl === "MARBLE_VITRIFIED_V1";
        const isConcrete =
          floorStyle === "concrete_tile" || modelUrl === "CONCRETE_TILE_V1";
        const isDecorative =
          floorStyle === "decorative_medallion" ||
          modelUrl === "DECORATIVE_MEDALLION_V1";
        const isLuxury =
          floorStyle === "luxury_stone" || modelUrl === "LUXURY_STONE_V1";
        const isChecker =
          floorStyle === "checker_ceramic" || modelUrl === "CHECKER_CERAMIC_V1";

        if (isMarble) {
          renderMarbleVitrifiedFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        } else if (isConcrete) {
          renderConcreteTileFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        } else if (isDecorative) {
          renderDecorativeMedallionFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        } else if (isLuxury) {
          renderLuxuryStoneFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        } else if (isChecker) {
          renderCheckerCeramicFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        } else {
          // Fallback to marble
          renderMarbleVitrifiedFloor(
            scene,
            px,
            pz,
            floor.width,
            floor.depth,
            selectedElementId === floor.id,
            floor.color,
          );
        }
      });

    // --- RENDER STAIRS ---
    elements
      .filter((el) => el.type === "stairs")
      .forEach((stair: any) => {
        const px = stair.position.x / PLAN_SCALE;
        const pz = stair.position.y / PLAN_SCALE;
        const stairStyle = (stair.metadata?.stair_style || "").toLowerCase();
        const modelUrl = stair.metadata?.stair_model_url;

        const isFloatingSwitchback =
          stairStyle === "floating_switchback" ||
          modelUrl === "FLOATING_SWITCHBACK_V1";

        if (isFloatingSwitchback) {
          renderFloatingSwitchbackStairs(
            scene,
            stair,
            selectedElementId === stair.id,
          );
        } else if (stairStyle === "spiral_metal") {
          renderSpiralMetalStairs(scene, stair, selectedElementId === stair.id);
        } else if (stairStyle === "concrete_parametric") {
          renderConcreteParametricStairs(
            scene,
            stair,
            selectedElementId === stair.id,
          );
        }
      });

    // Function to create item-specific geometry
    const createItemGeometry = (item: FurnitureItem) => {
      const w = Math.max((item.width || 1) * METERS_TO_WORLD, 0.05);
      const d = Math.max((item.depth || 1) * METERS_TO_WORLD, 0.05);
      const h = Math.max((item.height || 0.8) * METERS_TO_WORLD, 0.05);
      const isSelected = selectedElementId === item.id;

      if (item.assetType === "water_tank" || item.assetType === "WaterTank") {
        return renderWaterTank(scene, item, isSelected);
      } else if (item.assetType === "SOFA_3_SEATER_V1") {
        return renderSofa3Seater(scene, item, isSelected);
      } else if (item.assetType === "CENTER_TABLE_V1") {
        return renderCenterTable(scene, item, isSelected);
      } else if (item.assetType === "DOUBLE_BED_V1") {
        return renderDoubleBed(scene, item, isSelected);
      } else if (item.assetType === "WALL_PAINTING_V1") {
        return renderWallPainting(scene, item, isSelected);
      } else if (item.assetType === "SOFA_1_SEATER_V1") {
        return renderSofa1Seater(scene, item, isSelected);
      } else if (item.assetType === "SINGLE_BED_V1") {
        return renderSingleBed(scene, item, isSelected);
      } else if (item.assetType === "DINING_TABLE_V1") {
        return renderDiningTable(scene, item, isSelected);
      } else if (item.assetType === "TV_PANEL_V1") {
        return renderTVPanel(scene, item, isSelected);
      } else if (item.assetType === "CEILING_FAN_V1") {
        return renderCeilingFan(scene, item, isSelected);
      } else if (item.assetType === "MODULAR_KITCHEN_L_V1") {
        return renderModularKitchenL(scene, item, isSelected);
      } else if (item.assetType === "KITCHEN_SINGLE_WALL_V1") {
        return renderKitchenSingleWall(scene, item, isSelected);
      } else if (item.assetType === "COVE_CEILING_V1") {
        return renderCoveCeiling(scene, item, isSelected);
      } else if (item.assetType === "GEOMETRIC_CEILING_V1") {
        return renderGeometricCeiling(scene, item, isSelected);
      } else if (item.assetType === "CARPET_V1") {
        return renderCarpet(scene, item, isSelected);
      } else if (item.assetType === "INDIAN_COVE_CEILING_V1") {
        return renderIndianCoveCeiling(scene, item, isSelected);
      } else if (item.assetType === "FLOATING_COVE_CEILING_V1") {
        return renderFloatingCoveCeiling(scene, item, isSelected);
      } else if (item.assetType === "WOODEN_PANEL_CEILING_V1") {
        return renderWoodenPanelCeiling(scene, item, isSelected);
      }

      return new THREE.BoxGeometry(w, h, d);
    };

    console.log("📦 Items to render:", furnitureItems.length);

    furnitureItems.forEach((item, idx) => {
      const h = Math.max((item.height || 0.8) * METERS_TO_WORLD, 0.05);
      const color = item.metadata?.color || "#64748b";

      console.log(
        `📦 Item ${idx}: ${item.assetType} | Position: (${item.x}m, ${item.y}m) → (${(item.x * METERS_TO_WORLD).toFixed(2)}, ${(h / 2).toFixed(2)}, ${(item.y * METERS_TO_WORLD).toFixed(2)})`,
      );

      // Create item geometry
      const geom = createItemGeometry(item);
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

      const isCeilingItem =
        item.assetType.includes("CEILING") || item.assetType.includes("FAN");
      if (isCeilingItem) {
        let maxWallHeight = 3.0; // Default 3000mm
        if (model3D.walls && model3D.walls.length > 0) {
          maxWallHeight = Math.max(
            ...model3D.walls.map((w) => w.height / MM_SCALE),
          );
        }

        // Ensure object bounds are calculated
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        if (!box.isEmpty()) {
          // Snap the TOP of the object to the ceiling height
          mesh.position.y += maxWallHeight - box.max.y;
        }
      } else {
        snapObjectToGround(mesh);
      }

      scene.add(mesh);
      interactiveObjects.push(mesh);

      console.log(`✅ Added ${item.assetType} (${item.family}) to scene`);
    });

    electricalFixtures.forEach((fixture) => {
      const kind = fixture.fixtureType;
      const colorByKind: Record<ElectricalFixture["fixtureType"], string> = {
        light: "#facc15",
        socket: "#60a5fa",
        switch: "#34d399",
        emergency_light: "#fb7185",
        stage_light: "#f97316",
      };
      const elevationMm =
        fixture.elevationMm ??
        (kind === "socket"
          ? 1200
          : kind === "switch"
            ? 1350
            : kind === "emergency_light"
              ? 2200
              : kind === "stage_light"
                ? 1800
                : 2800);
      const elevation = elevationMm / MM_TO_CANVAS;
      const size =
        kind === "light" ? 0.45 : kind === "stage_light" ? 0.4 : 0.28;
      const geom = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshStandardMaterial({
        color: colorByKind[kind] || fixture.color || "#60a5fa",
        roughness: 0.35,
        metalness: 0.08,
        emissive:
          kind === "light" || kind === "emergency_light"
            ? new THREE.Color(colorByKind[kind] || "#ffffff")
            : new THREE.Color("#000000"),
        emissiveIntensity:
          kind === "light" || kind === "emergency_light" ? 0.45 : 0,
      });
      const mesh = new THREE.Mesh(geom, material);
      const hostWallId =
        (fixture as any).wallId ?? fixture.metadata?.wall_assigned;
      const hostWall = hostWallId ? wallById.get(hostWallId) : undefined;
      const worldPosition = hostWall
        ? projectFixtureToWall(fixture, hostWall)
        : {
            x: fixture.position.x / PLAN_SCALE,
            z: fixture.position.y / PLAN_SCALE,
          };

      mesh.position.set(worldPosition.x, elevation + size / 2, worldPosition.z);
      mesh.scale.set(
        kind === "switch" || kind === "socket" ? 1.25 : 1,
        kind === "switch" || kind === "socket" ? 1.25 : 1,
        kind === "switch" || kind === "socket" ? 1.25 : 1,
      );
      mesh.renderOrder = 1000;
      mesh.userData = {
        kind: "electrical_fixture",
        id: fixture.id,
      };
      scene.add(mesh);
      interactiveObjects.push(mesh);
    });

    circuitLines.forEach((circuit) => {
      const circuitId = circuit.metadata?.circuitId || circuit.id;
      const isSelected =
        selectedElementId === circuit.id ||
        selectedCircuitId === circuitId ||
        selectedBranchIds.has(circuit.id);
      const points = circuit.points || [];
      const vertices: THREE.Vector3[] = [];
      for (let i = 0; i < points.length; i += 2) {
        vertices.push(
          new THREE.Vector3(
            points[i] / PLAN_SCALE,
            0.08,
            points[i + 1] / PLAN_SCALE,
          ),
        );
      }
      if (vertices.length < 2) return;

      const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const material = new THREE.LineBasicMaterial({
        color: isSelected ? "#f59e0b" : "#94a3b8",
        transparent: true,
        opacity: isSelected ? 1 : 0.78,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = {
        kind: "electrical_circuit",
        id: circuit.id,
        circuitId,
      };
      scene.add(line);
      interactiveObjects.push(line);
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

    const sortedLevels = [...levels].sort((a, b) => a.order - b.order);
    sortedLevels.slice(0, -1).forEach((level) => {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(500, 330 / MM_SCALE, 500),
        new THREE.MeshStandardMaterial({ color: "#94a3b8", transparent: true, opacity: 0.35 }),
      );
      slab.position.set(0, mmToWorldY(level.elevation_mm) + (330 / MM_SCALE) / 2, 0);
      scene.add(slab);
    });

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
      // Persist camera state before disposing
      cameraStateRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };

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
  }, [
    elements,
    projectId,
    furnitureItems,
    importedModels,
    showDebugGuides,
    selectedElementId,
    levels,
    visibleLevelIds,
    activeLevelId,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowDebugGuides((prev) => !prev)}
          className="rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-100 hover:bg-slate-800 transition-colors uppercase shadow-xl"
        >
          {showDebugGuides ? "Hide" : "Show"} Debug
        </button>
        <button
          type="button"
          onClick={() => {
            cameraStateRef.current = null;
            setShowDebugGuides((prev) => !prev);
          }}
          className="rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-100 hover:bg-slate-800 transition-colors uppercase shadow-xl"
        >
          Reset View
        </button>
      </div>
      <div className="absolute left-3 top-28 z-10 rounded border border-slate-700 bg-slate-900/90 p-2 text-xs text-slate-100">
        <div className="mb-1 font-semibold">Levels</div>
        {levels.map((level) => (
          <label key={level.id} className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              checked={visibleLevelIds[level.id] ?? true}
              onChange={(event) =>
                setVisibleLevelIds((prev) => ({ ...prev, [level.id]: event.target.checked }))
              }
            />
            <span>{level.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}