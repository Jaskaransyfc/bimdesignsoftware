import * as THREE from "three";
import { Wall } from "@/types/modeling";

const MM_SCALE = 500;

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

  // DSL Parameters (translated to world units where 1m = 2 units)
  const fw = 0.05 * 2; // Outer frame thickness
  const mw = 0.04 * 2; // Central mullion
  const sw = 0.035 * 2; // Sash frame
  const sd = 0.05 * 2; // Sash depth
  const gt = 0.006 * 2; // Glass
  const th = 0.38 * 2; // Transom height
  const gap = 0.003 * 2;

  // Match wall thickness exactly
  const wallThicknessWorld = hostWall ? hostWall.thickness / MM_SCALE : 0.3;
  const FD = wallThicknessWorld + 0.005;

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#F0ECE4"),
    roughness: 0.65,
    metalness: 0.1,
  });

  const sashMaterial = new THREE.MeshStandardMaterial({
    color: "#E8E4DC",
    roughness: 0.6,
    metalness: 0.12,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#DAEEF5",
    opacity: 0.22,
    transparent: true,
    roughness: 0.02,
    metalness: 0.05,
  });

  const hardwareMaterial = new THREE.MeshStandardMaterial({
    color: "#A8B0B8",
    roughness: 0.15,
    metalness: 0.92,
  });

  // 1. OUTER FRAME
  // Bottom
  const fb = new THREE.Mesh(new THREE.BoxGeometry(winW, fw, FD), frameMaterial);
  fb.position.set(0, fw / 2, 0);
  windowGroup.add(fb);

  // Top
  const ft = new THREE.Mesh(new THREE.BoxGeometry(winW, fw, FD), frameMaterial);
  ft.position.set(0, winH - fw / 2, 0);
  windowGroup.add(ft);

  // Left
  const fl = new THREE.Mesh(new THREE.BoxGeometry(fw, winH - 2 * fw, FD), frameMaterial);
  fl.position.set(-winW / 2 + fw / 2, winH / 2, 0);
  windowGroup.add(fl);

  // Right
  const fr = new THREE.Mesh(new THREE.BoxGeometry(fw, winH - 2 * fw, FD), frameMaterial);
  fr.position.set(winW / 2 - fw / 2, winH / 2, 0);
  windowGroup.add(fr);

  // 2. CENTRAL MULLION
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(mw, winH - 2 * fw, FD), frameMaterial);
  mullion.position.set(0, winH / 2, 0);
  windowGroup.add(mullion);

  // 3. TRANSOM RAIL
  const transomRail = new THREE.Mesh(new THREE.BoxGeometry(winW - 2 * fw, sw, FD), frameMaterial);
  const transomY = winH - fw - th;
  transomRail.position.set(0, transomY, 0);
  windowGroup.add(transomRail);

  // 4. SASHES
  const colW = (winW - 2 * fw - mw) / 2;
  const sashDepthPos = 0; // Centered in FD

  const createSash = (sx: number, sy: number, sW: number, sH: number, isFixed: boolean) => {
    const sashGroup = new THREE.Group();
    
    // Frames
    const sb = new THREE.Mesh(new THREE.BoxGeometry(sW, sw, sd), sashMaterial);
    sb.position.set(sW / 2, sw / 2, 0);
    sashGroup.add(sb);

    const st = new THREE.Mesh(new THREE.BoxGeometry(sW, sw, sd), sashMaterial);
    st.position.set(sW / 2, sH - sw / 2, 0);
    sashGroup.add(st);

    const sl = new THREE.Mesh(new THREE.BoxGeometry(sw, sH - 2 * sw, sd), sashMaterial);
    sl.position.set(sw / 2, sH / 2, 0);
    sashGroup.add(sl);

    const sr = new THREE.Mesh(new THREE.BoxGeometry(sw, sH - 2 * sw, sd), sashMaterial);
    sr.position.set(sW - sw / 2, sH / 2, 0);
    sashGroup.add(sr);

    // Glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(sW - 2 * sw, sH - 2 * sw, gt), glassMaterial);
    glass.position.set(sW / 2, sH / 2, 0);
    sashGroup.add(glass);

    sashGroup.position.set(sx, sy, 0);
    return sashGroup;
  };

  // Left column
  const lcX = -winW / 2 + fw + gap;
  const lcW = colW - gap * 2;
  // Left Transom (fixed)
  const ltY = transomY + sw / 2 + gap;
  const ltH = winH - fw - gap - ltY;
  windowGroup.add(createSash(lcX, ltY, lcW, ltH, true));
  // Left Casement (hinged)
  const lcsY = fw + gap;
  const lcsH = transomY - sw / 2 - gap - lcsY;
  const leftCasement = createSash(lcX, lcsY, lcW, lcsH, false);
  windowGroup.add(leftCasement);

  // Right column
  const rcX = mw / 2 + gap;
  const rcW = colW - gap * 2;
  // Right Transom (fixed)
  windowGroup.add(createSash(rcX, ltY, rcW, ltH, true));
  // Right Casement (hinged)
  const rightCasement = createSash(rcX, lcsY, rcW, lcsH, false);
  windowGroup.add(rightCasement);

  // 5. HARDWARE
  // Left Handle
  const handleX_L = -mw / 2 - gap - 0.05 * 2;
  const handleY = lcsY + lcsH / 2;
  const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.018 * 2, 0.018 * 2, 0.02 * 2), hardwareMaterial);
  handleL.position.set(handleX_L, handleY, sd / 2 + 0.01 * 2);
  windowGroup.add(handleL);

  const leverL = new THREE.Mesh(new THREE.BoxGeometry(0.014 * 2, 0.09 * 2, 0.012 * 2), hardwareMaterial);
  leverL.position.set(handleX_L, handleY, sd / 2 + 0.02 * 2);
  windowGroup.add(leverL);

  // Right Handle
  const handleX_R = mw / 2 + gap + 0.05 * 2;
  const handleR = new THREE.Mesh(new THREE.BoxGeometry(0.018 * 2, 0.018 * 2, 0.02 * 2), hardwareMaterial);
  handleR.position.set(handleX_R, handleY, sd / 2 + 0.01 * 2);
  windowGroup.add(handleR);

  const leverR = new THREE.Mesh(new THREE.BoxGeometry(0.014 * 2, 0.09 * 2, 0.012 * 2), hardwareMaterial);
  leverR.position.set(handleX_R, handleY, sd / 2 + 0.02 * 2);
  windowGroup.add(leverR);

  // FINAL POSITIONING
  windowGroup.position.set(px, sillHeight, pz);
  if (vectors) {
    windowGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(windowGroup);
};
