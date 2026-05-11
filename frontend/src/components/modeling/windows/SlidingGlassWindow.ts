import * as THREE from "three";
import { Window, Wall } from "@/types/modeling";

export const renderSlidingGlassWindow = (
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
  const windowGroup = new THREE.Group();

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

  // 1. OUTER FRAME
  const addFramePart = (w: number, h: number, d: number, pxOffset: number, pyOffset: number, pzOffset: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    mesh.position.set(pxOffset, pyOffset, pzOffset);
    windowGroup.add(mesh);
  };

  addFramePart(winW, fw, D, 0, fw/2, 0);
  addFramePart(winW, fw, D, 0, winH - fw/2, 0);
  addFramePart(fw, winH, D, -winW/2 + fw/2, winH/2, 0);
  addFramePart(fw, winH, D, winW/2 - fw/2, winH/2, 0);

  // 2. STONE SILL
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.1, 0.04, wallThickness * 0.6), materials.sill);
  sill.position.set(0, -0.02, wallThickness/2 + 0.02);
  windowGroup.add(sill);

  // 3. SLIDING PANES
  const paneW = (winW - 2*fw) / 2;
  const paneH = winH - 2*fw;
  
  const createPane = (xOff: number, zOff: number) => {
    const pGroup = new THREE.Group();
    // Pane Frame
    const pf = 0.035;
    const pd = D * 0.4;
    
    const pBot = new THREE.Mesh(new THREE.BoxGeometry(paneW, pf, pd), frameMat);
    pBot.position.set(0, pf/2, 0);
    pGroup.add(pBot);
    
    const pTop = new THREE.Mesh(new THREE.BoxGeometry(paneW, pf, pd), frameMat);
    pTop.position.set(0, paneH - pf/2, 0);
    pGroup.add(pTop);
    
    const pSide = new THREE.Mesh(new THREE.BoxGeometry(pf, paneH, pd), frameMat);
    pSide.position.set(-paneW/2 + pf/2, paneH/2, 0);
    pGroup.add(pSide);
    
    const pSide2 = new THREE.Mesh(new THREE.BoxGeometry(pf, paneH, pd), frameMat);
    pSide2.position.set(paneW/2 - pf/2, paneH/2, 0);
    pGroup.add(pSide2);
    
    const glass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 2*pf, paneH - 2*pf, 0.01), glassMat);
    glass.position.set(0, paneH/2, 0);
    pGroup.add(glass);
    
    pGroup.position.set(xOff, fw, zOff);
    return pGroup;
  };

  windowGroup.add(createPane(-paneW/2, -D/5));
  windowGroup.add(createPane(paneW/2, D/5));

  // Final Positioning
  windowGroup.position.set(px, sillHeight, pz);
  if (vectors) {
    windowGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(windowGroup);
};
