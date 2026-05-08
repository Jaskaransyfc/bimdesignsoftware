import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderLuxuryDoor = (
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
  const doorT = 0.055 * 2; // ~0.11 units
  const doorGroup = new THREE.Group();

  // Main Door Leaf
  const doorGeom = new THREE.BoxGeometry(doorW, doorH, doorT);
  const doorMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#9A7149"),
    roughness: 0.58,
    metalness: 0.02,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });
  const doorMesh = new THREE.Mesh(doorGeom, doorMat);
  doorMesh.position.y = doorH / 2;
  doorGroup.add(doorMesh);

  // Left Dark Decor Panel
  const stripW = 0.215 * 2;
  const decorGeom = new THREE.BoxGeometry(stripW, doorH, doorT * 1.05);
  const decorMat = new THREE.MeshStandardMaterial({
    color: "#433028",
    roughness: 0.42,
    metalness: 0.06,
  });
  const decorMesh = new THREE.Mesh(decorGeom, decorMat);
  // Offset slightly to the left from center
  decorMesh.position.set(-doorW / 2 + stripW / 2 + 0.1, 0, 0.005);
  doorMesh.add(decorMesh);

  // Chevron Pattern
  const chevW = 0.075 * 2;
  const chevH = 0.115 * 2;
  const chevD = 0.010 * 2;
  const chevStep = 0.105 * 2;
  const nRows = Math.floor(doorH / chevStep) - 2;

  const chevMat = new THREE.MeshStandardMaterial({
    color: "#1A120E",
    roughness: 0.28,
    metalness: 0.12,
  });

  for (let i = 0; i < nRows; i++) {
    const yPos = -doorH / 2 + 0.3 + i * chevStep;

    // Left Chevron
    const chevL = new THREE.Mesh(
      new THREE.BoxGeometry(chevW, chevH, chevD),
      chevMat,
    );
    chevL.rotation.z = -0.72;
    chevL.position.set(-doorW / 2 + stripW / 2 + 0.05, yPos, doorT / 2 + 0.01);
    doorMesh.add(chevL);

    // Right Chevron
    const chevR = new THREE.Mesh(
      new THREE.BoxGeometry(chevW, chevH, chevD),
      chevMat,
    );
    chevR.rotation.z = 0.72;
    chevR.position.set(-doorW / 2 + stripW / 2 + 0.15, yPos, doorT / 2 + 0.01);
    doorMesh.add(chevR);
  }

  // Digital Lock
  const lockW = 0.042 * 2;
  const lockH = 0.33 * 2;
  const lockT = 0.028 * 2;
  const lockGeom = new THREE.BoxGeometry(lockW, lockH, lockT);
  const lockMat = new THREE.MeshStandardMaterial({
    color: "#111111",
    roughness: 0.18,
    metalness: 0.95,
  });
  const lockMesh = new THREE.Mesh(lockGeom, lockMat);
  // Position at ~1m height. Door center is doorH/2.
  const handleYOffset = 1.0 - doorH / 2;
  lockMesh.position.set(doorW / 2 - 0.25, handleYOffset, doorT / 2 + lockT / 2);
  doorMesh.add(lockMesh);

  // Designer Handle
  const handleGeom = new THREE.BoxGeometry(0.02, 0.25, 0.1);
  const handleMat = new THREE.MeshStandardMaterial({
    color: "#C08B52",
    roughness: 0.12,
    metalness: 1.0,
  });
  const handleMesh = new THREE.Mesh(handleGeom, handleMat);
  handleMesh.position.set(doorW / 2 - 0.22, handleYOffset + 0.1, doorT / 2 + 0.08);
  doorMesh.add(handleMesh);

  // Frame
  const frameT = 0.085 * 2;
  const frameD = hostWall ? hostWall.thickness / MM_SCALE + 0.05 : 0.46;
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#8B623D",
    roughness: 0.55,
    metalness: 0.02,
  });

  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameT, doorH + frameT, frameD),
    frameMat,
  );
  leftFrame.position.set(-doorW / 2 - frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(leftFrame);

  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameT, doorH + frameT, frameD),
    frameMat,
  );
  rightFrame.position.set(doorW / 2 + frameT / 2, (doorH + frameT) / 2, 0);
  doorGroup.add(rightFrame);

  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameD),
    frameMat,
  );
  topFrame.position.set(0, doorH + frameT / 2, 0);
  doorGroup.add(topFrame);

  // Threshold
  const thresholdGeom = new THREE.BoxGeometry(doorW + 0.34, 0.036, frameD);
  const thresholdMat = new THREE.MeshStandardMaterial({
    color: "#2A2A2A",
    roughness: 0.62,
    metalness: 0.25,
  });
  const thresholdMesh = new THREE.Mesh(thresholdGeom, thresholdMat);
  thresholdMesh.position.set(0, -0.018, 0);
  doorGroup.add(thresholdMesh);

  // Final Positioning
  doorGroup.position.set(px, 0, pz);
  if (vectors) {
    doorGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(doorGroup);
};
