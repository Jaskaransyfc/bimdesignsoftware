import * as THREE from "three";
import { Window, Wall } from "@/types/modeling";

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
  const fw = 0.06;
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05;

  const materials = {
    frame: new THREE.MeshStandardMaterial({ color: 0x2C3E50, metalness: 0.4, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xA9CCE3, transparent: true, opacity: 0.35, metalness: 0.6, roughness: 0.1 }),
    sill: new THREE.MeshStandardMaterial({ color: 0xBDC3C7, roughness: 0.9, metalness: 0.1 }),
    selected: new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 }),
  };

  const frameMat = isSelected ? materials.selected : materials.frame;
  const glassMat = isSelected ? materials.selected : materials.glass;

  const winFrame = new THREE.Group();

  // 1. RECTANGULAR FRAME
  const addFramePart = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    mesh.position.set(px, py, pz);
    winFrame.add(mesh);
  };

  addFramePart(winW, fw, D, 0, -winH/2 + fw/2, 0);
  addFramePart(winW, fw, D, 0, winH/2 - fw/2, 0);
  addFramePart(fw, winH - 2*fw, D, -winW/2 + fw/2, 0, 0);
  addFramePart(fw, winH - 2*fw, D, winW/2 - fw/2, 0, 0);

  // 2. STONE SILL
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.1, 0.04, wallThickness * 0.6), materials.sill);
  sill.position.set(0, -winH/2 - 0.02, wallThickness/2 + 0.02);
  winFrame.add(sill);

  // 3. GLASS
  const glass = new THREE.Mesh(new THREE.BoxGeometry(winW - 2*fw, winH - 2*fw, 0.01), glassMat);
  winFrame.add(glass);

  winFrame.position.set(px, sillHeight + winH / 2, pz);
  if (vectors)
    winFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  scene.add(winFrame);
};
