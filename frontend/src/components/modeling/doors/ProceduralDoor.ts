import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderProceduralDoor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  doorW: number,
  doorH: number,
  door: Door,
  element: any,
  hostWall?: Wall,
  selectedElementId?: string | null,
  color?: string,
) => {
  const doorStyle = String(
    (element as any)?.metadata?.door_style || "",
  ).toLowerCase();
  const isDouble =
    door.swingDirection === "double" || doorStyle === "double";
  const isMulti = doorStyle === "multi";
  const isGlass =
    String((door as any).material || "").toLowerCase() === "glass" ||
    doorStyle === "glass";

  // Door leaf thickness in world units — proportional to wall thickness
  const doorLeafDepth = hostWall
    ? Math.max(0.06, (hostWall.thickness / MM_SCALE) * 0.25)
    : 0.09;

  const isSelected = selectedElementId === door.id;
  
  // 1. LEAF MATERIAL (Glass or Wood)
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (isGlass ? "#e2f5ff" : (color || "#7c2d12")),
    roughness: isGlass ? 0.05 : 0.55,
    metalness: isGlass ? 0.9 : 0.1,
    transparent: isGlass,
    opacity: isGlass ? 0.2 : 1, // Ultra-clear glass
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
    depthWrite: isGlass ? false : true,
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
  const frameColor = color || "#522b11"; // Use custom color for frame
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.7,
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
