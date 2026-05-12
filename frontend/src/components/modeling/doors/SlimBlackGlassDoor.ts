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

  const frame_w = 0.04;
  const frame_d = hostWall ? hostWall.thickness / MM_SCALE + 0.02 : 0.08;
  const glass_margin = 0.04;
  const glass_t = 0.015;

  const wood_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#5D4037"), // Rich Brown Wood
    metalness: 0.1,
    roughness: 0.4,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  // @ts-ignore
  const glass_mat = new THREE.MeshPhysicalMaterial({
    color: "#E1F5FE", // Light blue tint for glass
    metalness: 0.1,
    roughness: 0.02,
    transmission: 0.95, // Higher transmission for clear glass
    thickness: 0.02,
    transparent: true,
    opacity: 0.3,
    // @ts-ignore
    side: THREE.DoubleSide,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });

  // 1. Outer Frame
  const frameGeomLeft = new THREE.BoxGeometry(frame_w, doorH, frame_d);
  const frameLeft = new THREE.Mesh(frameGeomLeft, wood_mat);
  frameLeft.position.set(-doorW / 2 + frame_w / 2, doorH / 2, 0);
  group.add(frameLeft);

  const frameGeomRight = new THREE.BoxGeometry(frame_w, doorH, frame_d);
  const frameRight = new THREE.Mesh(frameGeomRight, wood_mat);
  frameRight.position.set(doorW / 2 - frame_w / 2, doorH / 2, 0);
  group.add(frameRight);

  const frameGeomTop = new THREE.BoxGeometry(doorW, frame_w, frame_d);
  const frameTop = new THREE.Mesh(frameGeomTop, wood_mat);
  frameTop.position.set(0, doorH - frame_w / 2, 0);
  group.add(frameTop);

  const frameGeomBottom = new THREE.BoxGeometry(doorW, frame_w, frame_d);
  const frameBottom = new THREE.Mesh(frameGeomBottom, wood_mat);
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
  const handle = new THREE.Mesh(handleGeom, wood_mat);
  handle.position.set(doorW / 2 - 0.15, 1.02, 0.04);
  group.add(handle);

  // Final Positioning
  group.position.set(px, 0, pz);
  if (vectors) {
    group.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }

  scene.add(group);
};
