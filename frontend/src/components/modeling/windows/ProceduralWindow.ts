import * as THREE from "three";
import { Window, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderProceduralWindow = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  winW: number,
  winH: number,
  sillHeight: number,
  window_: Window,
  hostWall?: Wall,
  selectedElementId?: string | null,
) => {
  const isSelected = selectedElementId === window_.id;
  // Window frame (simplified as a hollow border using 4 boxes)
  const fT = 0.1; // frame thickness
  const frameThickness = hostWall
    ? hostWall.thickness / MM_SCALE + 0.02
    : 0.48;
  const winFrame = new THREE.Group();

  const highlightFrameMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (window_.color || "#475569"),
    roughness: 0.8,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(winW + fT, fT, frameThickness),
    highlightFrameMaterial,
  );
  top.position.y = winH / 2 + fT / 2;

  const bottom = new THREE.Mesh(
    new THREE.BoxGeometry(winW + fT, fT, frameThickness),
    highlightFrameMaterial,
  );
  bottom.position.y = -winH / 2 - fT / 2;

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(fT, winH, frameThickness),
    highlightFrameMaterial,
  );
  left.position.x = -winW / 2 - fT / 2;

  const right = new THREE.Mesh(
    new THREE.BoxGeometry(fT, winH, frameThickness),
    highlightFrameMaterial,
  );
  right.position.x = winW / 2 + fT / 2;

  winFrame.add(top, bottom, left, right);

  winFrame.position.set(px, sillHeight + winH / 2, pz);
  if (vectors)
    winFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  scene.add(winFrame);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(winW - 0.05, winH - 0.05, 0.1),
    new THREE.MeshStandardMaterial({
      color: isSelected ? "#3b82f6" : "#7dd3fc",
      transparent: true,
      opacity: 0.5,
      roughness: 0.2,
      metalness: 0.15,
      emissive: isSelected ? "#1d4ed8" : "#000000",
      emissiveIntensity: isSelected ? 0.3 : 0,
    }),
  );
  glass.position.set(px, sillHeight + winH / 2, pz);
  if (vectors) {
    glass.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(glass);
};
