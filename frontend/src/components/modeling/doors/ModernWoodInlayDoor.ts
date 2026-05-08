import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderModernWoodInlayDoor = (
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
  const doorT = 0.05 * 2; // 0.1 world units
  const doorGroup = new THREE.Group();

  // 1. MAIN DOOR LEAF
  const leafGroup = new THREE.Group();
  
  const doorGeom = new THREE.BoxGeometry(doorW, doorH, doorT);
  const doorMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#4A3222"), // Richer walnut
    roughness: 0.45,
    metalness: 0.05,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });
  const doorMesh = new THREE.Mesh(doorGeom, doorMat);
  doorMesh.position.y = doorH / 2;
  leafGroup.add(doorMesh);

  // 2. LEFT BEIGE DESIGN STRIP (Inlay - very thin)
  const stripW = 0.18 * 2;
  const stripH = doorH * 0.75;
  const stripGeom = new THREE.BoxGeometry(stripW, stripH, 0.005);
  const stripMat = new THREE.MeshStandardMaterial({
    color: "#E5D3B3", // Elegant beige
    roughness: 0.6,
    metalness: 0.1,
  });
  const stripMesh = new THREE.Mesh(stripGeom, stripMat);
  // Offset from left edge
  const stripX = -doorW / 2 + 0.15 * 2 + stripW / 2;
  const stripY = doorH / 2 + 0.1 * 2; // Positioned vertically
  stripMesh.position.set(stripX, stripY, doorT / 2 + 0.001);
  leafGroup.add(stripMesh);

  // 3. ORNAMENT SQUARES (Flat Inlays)
  const ornSize = 0.045 * 2;
  const ornStep = 0.22 * 2;
  const nOrn = 6;
  const ornMat = new THREE.MeshStandardMaterial({
    color: "#72563E",
    roughness: 0.3,
    metalness: 0.2,
  });

  for (let i = 0; i < nOrn; i++) {
    const ornMesh = new THREE.Mesh(
      new THREE.BoxGeometry(ornSize, ornSize, 0.008),
      ornMat,
    );
    const ornX = stripX; // Centered on the beige strip
    const ornY = (doorH * 0.25) + (i * ornStep);
    ornMesh.position.set(ornX, ornY, doorT / 2 + 0.004);
    leafGroup.add(ornMesh);
  }

  // 4. VERTICAL METAL STRIPS (Right side)
  const steelW = 0.008 * 2;
  const steelMat = new THREE.MeshStandardMaterial({
    color: "#C0C0C0",
    roughness: 0.1,
    metalness: 1.0,
  });

  const steelStartX = doorW / 2 - 0.25 * 2;
  for (let i = 0; i < 3; i++) {
    const steelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(steelW, doorH - 0.1, 0.006),
      steelMat,
    );
    const steelX = steelStartX + i * 0.05 * 2;
    steelMesh.position.set(steelX, doorH / 2, doorT / 2 + 0.002);
    leafGroup.add(steelMesh);
  }

  // 5. HANDLE SYSTEM (Sleek Horizontal Lever + Plate)
  const handleGroup = new THREE.Group();
  
  // Backplate
  const plateGeom = new THREE.BoxGeometry(0.05 * 2, 0.25 * 2, 0.01 * 2);
  const metalMat = new THREE.MeshStandardMaterial({
    color: "#333333",
    roughness: 0.2,
    metalness: 0.8,
  });
  const plate = new THREE.Mesh(plateGeom, metalMat);
  handleGroup.add(plate);

  // Lever
  const leverGeom = new THREE.BoxGeometry(0.14 * 2, 0.02 * 2, 0.02 * 2);
  const lever = new THREE.Mesh(leverGeom, metalMat);
  lever.position.set(0.04 * 2, 0.05 * 2, 0.03 * 2);
  handleGroup.add(lever);

  // Position handle at ~1m height on the left side
  handleGroup.position.set(-doorW / 2 + 0.12 * 2, 1.05 * 2, doorT / 2 + 0.01 * 2);
  leafGroup.add(handleGroup);

  // 6. VIEWER (Peephole)
  const viewerGeom = new THREE.CylinderGeometry(0.015 * 2, 0.015 * 2, 0.02 * 2, 32);
  viewerGeom.rotateX(Math.PI / 2);
  const viewerMat = new THREE.MeshStandardMaterial({ color: "#DAA520", metalness: 1, roughness: 0.1 });
  const viewer = new THREE.Mesh(viewerGeom, viewerMat);
  viewer.position.set(0, 1.55 * 2, doorT / 2 + 0.01 * 2);
  leafGroup.add(viewer);

  // 7. FRAME (Clean and Robust)
  const frameT = 0.08 * 2;
  const frameD = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.45;
  const frameMat = new THREE.MeshStandardMaterial({ color: "#1A1A1A", roughness: 0.5 });

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  leftFrame.position.set(-doorW / 2 - frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(leftFrame);

  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  rightFrame.position.set(doorW / 2 + frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(rightFrame);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameD), frameMat);
  topFrame.position.set(0, doorH + frameT / 2, 0);
  doorGroup.add(topFrame);

  // 8. THRESHOLD
  const thresholdGeom = new THREE.BoxGeometry(doorW + frameT * 2, 0.04, frameD);
  const threshold = new THREE.Mesh(thresholdGeom, new THREE.MeshStandardMaterial({ color: "#222222" }));
  threshold.position.set(0, 0.02, 0);
  doorGroup.add(threshold);

  // FINAL ASSEMBLY
  doorGroup.add(leafGroup);
  doorGroup.position.set(px, 0, pz);
  if (vectors) {
    doorGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  
  scene.add(doorGroup);
};
