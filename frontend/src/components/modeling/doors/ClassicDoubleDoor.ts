import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderClassicDoubleDoor = (
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
  const singleW = doorW / 2;

  // Materials
  const woodMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#4B2E1F"),
    roughness: 0.42,
    metalness: 0.03,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#3A2318",
    roughness: 0.54,
    metalness: 0.02,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: "#C89A45",
    roughness: 0.16,
    metalness: 1.0,
  });

  // 1. MAIN DOORS
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(singleW, doorH, doorT), woodMat);
  leftLeaf.position.set(-singleW / 2, doorH / 2, 0);
  doorGroup.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(singleW, doorH, doorT), woodMat);
  rightLeaf.position.set(singleW / 2, doorH / 2, 0);
  doorGroup.add(rightLeaf);

  // 2. PANELS
  const panelDepth = 0.012 * 2;
  const panelMat = new THREE.MeshStandardMaterial({ color: "#5A3824", roughness: 0.36, metalness: 0.03 });

  const addPanel = (parent: THREE.Mesh, x: number, y: number, w: number, h: number) => {
    // Relative to parent center
    const px_rel = x - singleW / 2;
    const py_rel = y - doorH / 2;
    
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w, h, panelDepth), panelMat);
    outer.position.set(px_rel, py_rel, doorT / 2 + 0.006 * 2);
    parent.add(outer);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h * 0.72, panelDepth * 1.5), panelMat);
    inner.position.set(px_rel, py_rel, doorT / 2 + 0.012 * 2);
    parent.add(inner);
  };

  // Left panels (x is relative to left edge of single door)
  addPanel(leftLeaf, 0.25 * singleW, 1.75 * 2, 0.28 * 2, 0.34 * 2);
  addPanel(leftLeaf, 0.25 * singleW, 1.1 * 2, 0.30 * 2, 0.58 * 2);
  addPanel(leftLeaf, 0.25 * singleW, 0.4 * 2, 0.30 * 2, 0.42 * 2);
  addPanel(leftLeaf, 0.35 * singleW, 0.3 * 2, 0.22 * 2, 0.18 * 2);

  // Right panels
  addPanel(rightLeaf, 0.75 * singleW, 1.75 * 2, 0.28 * 2, 0.34 * 2);
  addPanel(rightLeaf, 0.75 * singleW, 1.1 * 2, 0.30 * 2, 0.58 * 2);
  addPanel(rightLeaf, 0.75 * singleW, 0.4 * 2, 0.30 * 2, 0.42 * 2);
  addPanel(rightLeaf, 0.65 * singleW, 0.3 * 2, 0.22 * 2, 0.18 * 2);

  // 3. FRAME
  const frameT = 0.09 * 2;
  const frameD = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.12 * 2;
  
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  leftFrame.position.set(-doorW / 2 - frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(leftFrame);

  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, doorH + frameT, frameD), frameMat);
  rightFrame.position.set(doorW / 2 + frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(rightFrame);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameD), frameMat);
  topFrame.position.set(0, doorH + frameT / 2, 0);
  doorGroup.add(topFrame);

  // 4. HANDLES
  const handleGeom = new THREE.BoxGeometry(0.025 * 2, 0.62 * 2, 0.03 * 2);
  const leftH = new THREE.Mesh(handleGeom, goldMat);
  leftH.position.set(-0.12 * 2, 0.7 * 2 + 0.31 * 2, doorT / 2 + 0.015 * 2);
  doorGroup.add(leftH);

  const rightH = new THREE.Mesh(handleGeom, goldMat);
  rightH.position.set(0.095 * 2, 0.7 * 2 + 0.31 * 2, doorT / 2 + 0.015 * 2);
  doorGroup.add(rightH);

  // 5. LIGHTS
  const lightGeom = new THREE.CylinderGeometry(0.025 * 2, 0.025 * 2, 0.015 * 2, 24);
  lightGeom.rotateX(Math.PI / 2);
  const lightMat = new THREE.MeshStandardMaterial({
    color: "#FFD68A",
    emissive: "#FFCC66",
    emissiveIntensity: 2.0,
  });
  const lightL = new THREE.Mesh(lightGeom, lightMat);
  lightL.position.set(-doorW / 4, 2.30 * 2, doorT / 2 + 0.02 * 2);
  doorGroup.add(lightL);

  const lightR = new THREE.Mesh(lightGeom, lightMat);
  lightR.position.set(doorW / 4, 2.30 * 2, doorT / 2 + 0.02 * 2);
  doorGroup.add(lightR);

  // FINAL POSITIONING
  doorGroup.position.set(px, 0, pz);
  if (vectors) {
    doorGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(doorGroup);
};
