import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderSlimBlackGlassDoor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  doorW: number,
  doorH: number,
  hostWall?: Wall,
  isSelected?: boolean,
  color?: string
) => {
  const group = new THREE.Group();

  const frame_w = 0.035;
  const frame_d = hostWall ? hostWall.thickness / MM_SCALE + 0.02 : 0.07;
  const glass_margin = 0.035;
  const glass_t = 0.012;

  const black_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#111111"),
    metalness: 0.38,
    roughness: 0.34,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const glass_mat = new THREE.MeshStandardMaterial({
    color: "#fff5e6",
    opacity: 0.2,
    metalness: 0.8,
    roughness: 0.05,
    transparent: true,
    depthWrite: false,
  });

  // 1. Outer Frame
  const frameGeomLeft = new THREE.BoxGeometry(frame_w, doorH, frame_d);
  const frameLeft = new THREE.Mesh(frameGeomLeft, black_mat);
  frameLeft.position.set(-doorW / 2 + frame_w / 2, doorH / 2, 0);
  group.add(frameLeft);

  const frameGeomRight = new THREE.BoxGeometry(frame_w, doorH, frame_d);
  const frameRight = new THREE.Mesh(frameGeomRight, black_mat);
  frameRight.position.set(doorW / 2 - frame_w / 2, doorH / 2, 0);
  group.add(frameRight);

  const frameGeomTop = new THREE.BoxGeometry(doorW, frame_w, frame_d);
  const frameTop = new THREE.Mesh(frameGeomTop, black_mat);
  frameTop.position.set(0, doorH - frame_w / 2, 0);
  group.add(frameTop);

  const frameGeomBottom = new THREE.BoxGeometry(doorW, frame_w, frame_d);
  const frameBottom = new THREE.Mesh(frameGeomBottom, black_mat);
  frameBottom.position.set(0, frame_w / 2, 0);
  group.add(frameBottom);

  // 2. Glass Panel
  const glassGeom = new THREE.BoxGeometry(
    doorW - glass_margin * 2,
    doorH - glass_margin * 2,
    glass_t
  );
  const glass = new THREE.Mesh(glassGeom, glass_mat);
  glass.position.set(0, doorH / 2, 0);
  group.add(glass);

  // 3. Handle
  const handleGeom = new THREE.BoxGeometry(0.12, 0.016, 0.018);
  const handle = new THREE.Mesh(handleGeom, black_mat);
  handle.position.set(doorW / 2 - 0.15, 1.02, 0.04);
  group.add(handle);

  // Final Positioning
  group.position.set(px, 0, pz);
  if (vectors) {
    group.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }

  scene.add(group);
};
