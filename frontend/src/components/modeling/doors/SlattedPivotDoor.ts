import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderSlattedPivotDoor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  doorW: number,
  doorH: number,
  hostWall?: Wall,
  isSelected?: boolean,
  color?: string,
) => {
  const doorT = 0.06 * 2;
  const doorGroup = new THREE.Group();

  // 1. MAIN DOOR LEAF
  const doorGeom = new THREE.BoxGeometry(doorW, doorH, doorT);
  const doorMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#8B5A2B"), // Warm Teak/Walnut
    roughness: 0.35,
    metalness: 0.05,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });
  const doorMesh = new THREE.Mesh(doorGeom, doorMat);
  doorMesh.position.y = doorH / 2;
  doorGroup.add(doorMesh);

  // 2. VERTICAL SLATS
  const slatW = 0.015 * 2;
  const slatGap = 0.015 * 2;
  const slatRegionW = 0.35 * 2;
  const slatMat = new THREE.MeshStandardMaterial({
    color: "#4E342E", // Slightly darker wood for slats
    roughness: 0.6,
    metalness: 0.02,
  });

  // User starts x from: door_w - slat_region_w + 0.01
  // My doorMesh is centered, so left edge is -doorW/2
  const startX = doorW / 2 - slatRegionW + 0.01 * 2;
  const endX = doorW / 2 - 0.02 * 2;

  let currentX = startX;
  while (currentX < endX) {
    const slatGeom = new THREE.BoxGeometry(slatW, doorH, 0.02 * 2);
    const slatMesh = new THREE.Mesh(slatGeom, slatMat);
    slatMesh.position.set(currentX - doorW / 2 + slatW / 2, doorH / 2, doorT / 2 + 0.005);
    doorGroup.add(slatMesh);
    currentX += slatW + slatGap;
  }

  // 3. OUTER FRAME
  const frameT = 0.04 * 2;
  const frameD = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.08 * 2;
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#3E2723", // Dark espresso frame
    roughness: 0.45,
    metalness: 0.05,
  });

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  leftFrame.position.set(-doorW / 2 - frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(leftFrame);

  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  rightFrame.position.set(doorW / 2 + frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(rightFrame);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameD), frameMat);
  topFrame.position.set(0, doorH + frameT / 2, 0);
  doorGroup.add(topFrame);

  // 4. HANDLE
  const handleBodyGeom = new THREE.BoxGeometry(0.028 * 2, 0.28 * 2, 0.022 * 2);
  const handleBodyMat = new THREE.MeshStandardMaterial({
    color: "#1F1F1F",
    metalness: 0.85,
    roughness: 0.28,
  });
  const handleBody = new THREE.Mesh(handleBodyGeom, handleBodyMat);
  // User translate: [0.12, -0.03, 1.02]
  // In my system: x relative to center, y relative to bottom, z relative to face
  handleBody.position.set(-doorW / 2 + 0.12 * 2, 1.02 * 2 + 0.14 * 2, doorT / 2 + 0.011 * 2);
  doorGroup.add(handleBody);

  const handleInnerGeom = new THREE.BoxGeometry(0.01 * 2, 0.18 * 2, 0.024 * 2);
  const handleInnerMat = new THREE.MeshStandardMaterial({
    color: "#3A3A3A",
    metalness: 1.0,
    roughness: 0.16,
  });
  const handleInner = new THREE.Mesh(handleInnerGeom, handleInnerMat);
  handleInner.position.set(-doorW / 2 + 0.128 * 2, 1.07 * 2 + 0.09 * 2, doorT / 2 + 0.012 * 2);
  doorGroup.add(handleInner);

  // FINAL POSITIONING
  doorGroup.position.set(px, 0, pz);
  if (vectors) {
    doorGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(doorGroup);
};
