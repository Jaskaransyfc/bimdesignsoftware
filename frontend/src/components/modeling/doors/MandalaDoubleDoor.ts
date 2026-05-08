import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderMandalaDoubleDoor = (
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
  const doorT = 0.055 * 2;
  const doorGroup = new THREE.Group();
  const singleW = doorW / 2;

  // Materials
  const doorMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#4B2B22"),
    roughness: 0.52,
    metalness: 0.04,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#111111",
    roughness: 0.38,
    metalness: 0.18,
  });

  const mandalaMat = new THREE.MeshStandardMaterial({
    color: "#C08A58", // Bronze/Gold
    roughness: 0.22,
    metalness: 0.65,
  });

  // 1. MAIN DOORS
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(singleW, doorH, doorT), doorMat);
  leftLeaf.position.set(-singleW / 2, doorH / 2, 0);
  doorGroup.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(singleW, doorH, doorT), doorMat);
  rightLeaf.position.set(singleW / 2, doorH / 2, 0);
  doorGroup.add(rightLeaf);

  // 2. CENTER RIBBED STRIPS
  const ribMat = new THREE.MeshStandardMaterial({ color: "#2B2B2B", metalness: 0.35, roughness: 0.48 });
  let ribX = -0.04 * 2;
  while (ribX < 0.04 * 2) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.008 * 2, doorH, 0.01 * 2), ribMat);
    rib.position.set(ribX, doorH / 2, doorT / 2 + 0.005);
    doorGroup.add(rib);
    ribX += 0.015 * 2;
  }

  // 3. MANDALA PATTERN
  const mandalaGroup = new THREE.Group();
  
  // Rings
  const outerRingGeom = new THREE.TorusGeometry(0.42 * 2, 0.009 * 2, 16, 100);
  const outerRing = new THREE.Mesh(outerRingGeom, mandalaMat);
  mandalaGroup.add(outerRing);

  const innerRingGeom = new THREE.TorusGeometry(0.28 * 2, 0.012 * 2, 16, 100);
  const innerRing = new THREE.Mesh(innerRingGeom, mandalaMat);
  mandalaGroup.add(innerRing);

  // Petals
  const petalCount = 32;
  const petalRadius = 0.36 * 2;
  const petalGeom = new THREE.CylinderGeometry(0.04 * 2, 0.04 * 2, 0.022 * 2, 24);
  petalGeom.rotateX(Math.PI / 2);
  
  for (let i = 0; i < petalCount; i++) {
    const angle = (Math.PI * 2 / petalCount) * i;
    const p = new THREE.Mesh(petalGeom, mandalaMat);
    p.position.set(Math.cos(angle) * petalRadius, Math.sin(angle) * petalRadius, 0);
    mandalaGroup.add(p);
  }

  // Inner Petals
  const innerPetalCount = 18;
  const innerPetalRadius = 0.20 * 2;
  const innerPetalGeom = new THREE.CylinderGeometry(0.022 * 2, 0.022 * 2, 0.022 * 2, 18);
  innerPetalGeom.rotateX(Math.PI / 2);

  for (let i = 0; i < innerPetalCount; i++) {
    const angle = (Math.PI * 2 / innerPetalCount) * i;
    const p = new THREE.Mesh(innerPetalGeom, mandalaMat);
    p.position.set(Math.cos(angle) * innerPetalRadius, Math.sin(angle) * innerPetalRadius, 0);
    mandalaGroup.add(p);
  }

  mandalaGroup.position.set(0, 1.2 * 2, doorT / 2 + 0.01 * 2);
  doorGroup.add(mandalaGroup);

  // 4. HANDLES
  const handleGeom = new THREE.BoxGeometry(0.025 * 2, 0.34 * 2, 0.03 * 2);
  const handleMat = new THREE.MeshStandardMaterial({ color: "#2A2A2A", metalness: 0.92, roughness: 0.14 });
  
  const leftH = new THREE.Mesh(handleGeom, handleMat);
  leftH.position.set(-0.08 * 2, 1.02 * 2 + 0.17 * 2, doorT / 2 + 0.015 * 2);
  doorGroup.add(leftH);

  const rightH = new THREE.Mesh(handleGeom, handleMat);
  rightH.position.set(0.055 * 2, 1.02 * 2 + 0.17 * 2, doorT / 2 + 0.015 * 2);
  doorGroup.add(rightH);

  // 5. FRAME
  const frameT = 0.085 * 2;
  const frameD = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.11 * 2;
  const frameMeshL = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  frameMeshL.position.set(-doorW / 2 - frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(frameMeshL);

  const frameMeshR = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  frameMeshR.position.set(doorW / 2 + frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(frameMeshR);

  const frameMeshT = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameD), frameMat);
  frameMeshT.position.set(0, doorH + frameT / 2, 0);
  doorGroup.add(frameMeshT);

  // FINAL POSITIONING
  doorGroup.position.set(px, 0, pz);
  if (vectors) {
    doorGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(doorGroup);
};
