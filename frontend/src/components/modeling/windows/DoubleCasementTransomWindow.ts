import * as THREE from "three";
import { Wall } from "@/types/modeling";

export const renderDoubleCasementTransomWindow = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  winW: number,
  winH: number,
  sillHeight: number,
  hostWall?: Wall,
  isSelected?: boolean,
  color?: string,
) => {
  const windowGroup = new THREE.Group();

  const fw = 0.06; // frame thickness
  const mw = 0.05; // mullion width
  const sw = 0.04; // sash bar thickness
  const sd = 0.05; // sash depth
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05;
  const th = 0.4; // Transom height

  const materials = {
    frame: new THREE.MeshStandardMaterial({ color: 0x2C3E50, metalness: 0.4, roughness: 0.3 }),
    sash: new THREE.MeshStandardMaterial({ color: 0x34495E, metalness: 0.3, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xA9CCE3, transparent: true, opacity: 0.35, metalness: 0.6, roughness: 0.1, side: THREE.DoubleSide }),
    sill: new THREE.MeshStandardMaterial({ color: 0xBDC3C7, roughness: 0.9, metalness: 0.1 }),
    selected: new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 }),
  };

  const frameMat = isSelected ? materials.selected : materials.frame;
  const sashMat = isSelected ? materials.selected : materials.sash;
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

  // 2. CENTRAL MULLION
  addFramePart(mw, winH - 2*fw, D, 0, winH/2, 0);

  // 3. TRANSOM RAIL
  const transomY = winH - fw - th;
  addFramePart(winW - 2*fw, sw, D, 0, transomY, 0);

  // 4. STONE SILL
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.15, 0.04, wallThickness * 0.6), materials.sill);
  sill.position.set(0, -0.02, wallThickness/2 + 0.02);
  windowGroup.add(sill);

  // 5. SASHES
  const colW = (winW - 2*fw - mw) / 2;
  const createSash = (sx: number, sy: number, sW: number, sH: number) => {
    const sGroup = new THREE.Group();
    // Sash frame
    const sb = new THREE.Mesh(new THREE.BoxGeometry(sW, sw, sd), sashMat);
    sb.position.set(sW/2, sw/2, 0);
    sGroup.add(sb);
    const st = new THREE.Mesh(new THREE.BoxGeometry(sW, sw, sd), sashMat);
    st.position.set(sW/2, sH - sw/2, 0);
    sGroup.add(st);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(sw, sH - 2*sw, sd), sashMat);
    sl.position.set(sw/2, sH/2, 0);
    sGroup.add(sl);
    const sr = new THREE.Mesh(new THREE.BoxGeometry(sw, sH - 2*sw, sd), sashMat);
    sr.position.set(sW - sw/2, sH/2, 0);
    sGroup.add(sr);
    // Glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(sW - 2*sw, sH - 2*sw, 0.01), glassMat);
    glass.position.set(sW/2, sH/2, 0);
    sGroup.add(glass);
    sGroup.position.set(sx, sy, 0);
    return sGroup;
  };

  const lcX = -winW/2 + fw;
  const ltY = transomY + sw/2;
  const ltH = winH - fw - ltY;
  windowGroup.add(createSash(lcX, ltY, colW, ltH)); // Left Transom
  windowGroup.add(createSash(lcX, fw, colW, transomY - sw/2 - fw)); // Left Casement

  const rcX = mw/2;
  windowGroup.add(createSash(rcX, ltY, colW, ltH)); // Right Transom
  windowGroup.add(createSash(rcX, fw, colW, transomY - sw/2 - fw)); // Right Casement

  // Final Positioning
  windowGroup.position.set(px, sillHeight, pz);
  if (vectors) {
    windowGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(windowGroup);
};
