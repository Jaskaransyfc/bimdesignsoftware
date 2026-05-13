import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

type WallVectors = {
  dir: {
    x: number;
    z: number;
  };
};

type DoorRenderElement = Partial<Door> & {
  metadata?: Record<string, unknown>;
};

export const renderProceduralDoor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: WallVectors | null | undefined,
  doorW: number,
  doorH: number,
  door: Door,
  element: DoorRenderElement | null | undefined,
  hostWall?: Wall,
  selectedElementId?: string | null,
  color?: string,
) => {
  const doorStyle = String(element?.metadata?.door_style || "").toLowerCase();
  const isDouble =
    door.swingDirection === "double" || doorStyle === "double";
  const isMulti = doorStyle === "multi";
  const isGlass =
    String(door.material || "").toLowerCase() === "glass" ||
    doorStyle === "glass";

  const explicitDoorDepth =
    typeof door.thickness === "number"
      ? Math.max(0.03, door.thickness / MM_SCALE)
      : null;

  // Prefer the BIM door type thickness, then fall back to a host-wall-derived depth.
  const doorLeafDepth =
    explicitDoorDepth ??
    (hostWall ? Math.max(0.06, (hostWall.thickness / MM_SCALE) * 0.25) : 0.09);

  const isSelected = selectedElementId === door.id;
  
  // 1. LEAF MATERIAL (Glass or Wood)
  // Better wood colors that are lighter and more visible
  const defaultWoodColors = ["#A0522D", "#8B4513", "#CD853F", "#D2691E", "#BC8F8F"];
  const woodColor = color || defaultWoodColors[Math.floor(Math.random() * defaultWoodColors.length)];
  
  const leafMaterial = isGlass 
    // @ts-expect-error - MeshPhysicalMaterial exists in the runtime three build.
    ? new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9,  // Realistic glass transmission
        thickness: 0.02,
        transparent: true,
        opacity: 1,
        // @ts-expect-error - Some installed three typings omit DoubleSide.
        side: THREE.DoubleSide,
        envMapIntensity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      })
    : new THREE.MeshStandardMaterial({
        color: isSelected ? "#3b82f6" : woodColor,
        roughness: 0.6,
        metalness: 0.05,
        emissive: isSelected ? "#1d4ed8" : "#000000",
        emissiveIntensity: isSelected ? 0.5 : 0,
      });

  const addLeaf = (
    centerX: number,
    centerY: number,
    centerZ: number,
    leafW: number,
  ) => {
    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(leafW - 0.02, 0.08), // Tighter fit
        doorH - 0.02,
        isGlass ? 0.015 : doorLeafDepth, // Glass is thinner
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
    new THREE.SphereGeometry(0.04),
    new THREE.MeshStandardMaterial({ color: isGlass ? "#111111" : "#fbbf24", metalness: 0.9, roughness: 0.1 }),
  );
  handle.position.set(
    px + (vectors?.dir.x || 0) * (doorW * 0.4),
    doorH / 2,
    pz + (vectors?.dir.z || 0) * (doorW * 0.4),
  );
  scene.add(handle);

  // 2. FRAME MATERIAL (Uses custom color)
  // Lighter wood colors for better visibility
  const frameColors = ["#8B4513", "#A0522D", "#654321", "#5C4033"];
  const frameColor = color || frameColors[Math.floor(Math.random() * frameColors.length)];
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : frameColor,
    roughness: 0.6,
    metalness: 0.1,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });
  const frameThickness = hostWall
    ? hostWall.thickness / MM_SCALE + 0.03
    : 0.3;

  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.05, 0.05, frameThickness),
    frameMaterial,
  );
  topFrame.position.set(px, doorH + 0.025, pz);
  if (vectors)
    topFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  scene.add(topFrame);

  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, doorH, frameThickness),
    frameMaterial,
  );
  const lx = px - (vectors?.dir.x || 0) * (doorW / 2 + 0.025);
  const lz = pz - (vectors?.dir.z || 0) * (doorW / 2 + 0.025);
  leftFrame.position.set(lx, doorH / 2, lz);
  if (vectors)
    leftFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  scene.add(leftFrame);

  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, doorH, frameThickness),
    frameMaterial,
  );
  const rx = px + (vectors?.dir.x || 0) * (doorW / 2 + 0.025);
  const rz = pz + (vectors?.dir.z || 0) * (doorW / 2 + 0.025);
  rightFrame.position.set(rx, doorH / 2, rz);
  if (vectors)
    rightFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  scene.add(rightFrame);
};
