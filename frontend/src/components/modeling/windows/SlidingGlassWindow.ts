import * as THREE from "three";
import { Window, Wall } from "@/types/modeling";

const MM_SCALE = 500;

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

  // DSL Parameters (translated to world units where 1m = 2 units)
  const FT = 0.08 * 2;
  // Match wall thickness exactly to avoid odd overlaps, plus a tiny margin for visibility
  const wallThicknessWorld = hostWall ? hostWall.thickness / MM_SCALE : 0.3;
  const FD = wallThicknessWorld + 0.005; 
  
  const GT = 0.015 * 2; // Slightly thinner glass
  const slideOffset = 0.6 * 2;
  const PFT = 0.05 * 2;

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (window_.color || "#E8E8EC"),
    roughness: 0.4,
    metalness: 0.6,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const paneFrameMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? "#60a5fa" : "#BFBFC4",
    roughness: 0.35,
    metalness: 0.7,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#A8D8E8",
    opacity: 0.35,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
  });

  // --- Outer Frame ---
  // Center all geometries at Z=0 locally so they align with the wall axis
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(winW, FT, FD), frameMaterial);
  bottom.position.set(0, FT / 2, 0);
  windowGroup.add(bottom);

  const top = new THREE.Mesh(new THREE.BoxGeometry(winW, FT, FD), frameMaterial);
  top.position.set(0, winH - FT / 2, 0);
  windowGroup.add(top);

  const left = new THREE.Mesh(new THREE.BoxGeometry(FT, winH, FD), frameMaterial);
  left.position.set(-winW / 2 + FT / 2, winH / 2, 0);
  windowGroup.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(FT, winH, FD), frameMaterial);
  right.position.set(winW / 2 - FT / 2, winH / 2, 0);
  windowGroup.add(right);

  // Center vertical track - thin and centered
  const centerTrack = new THREE.Mesh(new THREE.BoxGeometry(FT * 0.5, winH - 2 * FT, FD * 0.1), frameMaterial);
  centerTrack.position.set(0, winH / 2, 0);
  windowGroup.add(centerTrack);

  // --- Sliding Panes ---
  const paneW = winW / 2;
  const paneH = winH - 2 * FT;

  const createPane = (x0: number, y0: number, z0: number) => {
    const paneGroup = new THREE.Group();
    const paneDepth = FD * 0.4;
    
    // Pane sub-frame
    const pb = new THREE.Mesh(new THREE.BoxGeometry(paneW, PFT, paneDepth), paneFrameMaterial);
    pb.position.set(paneW / 2, PFT / 2, 0);
    paneGroup.add(pb);

    const pt = new THREE.Mesh(new THREE.BoxGeometry(paneW, PFT, paneDepth), paneFrameMaterial);
    pt.position.set(paneW / 2, paneH - PFT / 2, 0);
    paneGroup.add(pt);

    const pl = new THREE.Mesh(new THREE.BoxGeometry(PFT, paneH, paneDepth), paneFrameMaterial);
    pl.position.set(PFT / 2, paneH / 2, 0);
    paneGroup.add(pl);

    const pr = new THREE.Mesh(new THREE.BoxGeometry(PFT, paneH, paneDepth), paneFrameMaterial);
    pr.position.set(paneW - PFT / 2, paneH / 2, 0);
    paneGroup.add(pr);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 2 * PFT, paneH - 2 * PFT, GT), glassMaterial);
    glass.position.set(paneW / 2, paneH / 2, 0);
    paneGroup.add(glass);

    paneGroup.position.set(x0, y0, z0);
    return paneGroup;
  };

  // Left pane: stationary, slightly offset in Z to stay within frame
  const leftPane = createPane(-winW / 2 + FT * 0.5, FT, -FD * 0.22);
  windowGroup.add(leftPane);

  // Right pane: slid to the left, offset in opposite Z
  const rightPane = createPane(0 - slideOffset + FT * 0.5, FT, FD * 0.22);
  windowGroup.add(rightPane);

  // Handle on right (sliding) pane
  const handleX = -slideOffset + paneW - PFT - 0.08;
  const handleY = winH / 2;
  const handleGeom = new THREE.CylinderGeometry(0.02 * 2, 0.02 * 2, 0.06 * 2, 24);
  handleGeom.rotateX(Math.PI / 2);
  const handle = new THREE.Mesh(handleGeom, new THREE.MeshStandardMaterial({ color: "#1A1A1A", roughness: 0.2, metalness: 0.9 }));
  handle.position.set(handleX, handleY, FD * 0.45);
  windowGroup.add(handle);

  // Final Positioning
  windowGroup.position.set(px, sillHeight, pz);
  if (vectors) {
    windowGroup.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }
  scene.add(windowGroup);
};
