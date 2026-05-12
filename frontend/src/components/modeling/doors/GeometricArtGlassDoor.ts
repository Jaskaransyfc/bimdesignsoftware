import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderGeometricArtGlassDoor = (
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

  const wood_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#A0522D"),
    roughness: 0.4,
    metalness: 0.1,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  // @ts-ignore - MeshPhysicalMaterial exists in three
  const glass_mat = new THREE.MeshPhysicalMaterial({
    color: "#e2f5ff",
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.02,
    transparent: true,
    opacity: 1,
    // @ts-ignore
    side: THREE.DoubleSide,
    envMapIntensity: 1,
    clearcoat: 1,
  });

  const metal_mat = new THREE.MeshStandardMaterial({
    color: "#1E1E1E",
    metalness: 0.95,
    roughness: 0.14,
  });

  const single_w = doorW / 2;
  const glass_margin_x = 0.16;
  const glass_margin_y = 0.18;
  const glass_w = single_w - glass_margin_x * 2;
  const glass_h = doorH - glass_margin_y * 2;

  // 1. Doors (Left & Right)
  const createDoorLeaf = (offsetX: number) => {
    const leafGroup = new THREE.Group();
    const frameGeom = new THREE.BoxGeometry(single_w, doorH, 0.055);
    const frame = new THREE.Mesh(frameGeom, wood_mat);
    frame.position.set(0, doorH / 2, 0);
    leafGroup.add(frame);

    const glassGeom = new THREE.BoxGeometry(glass_w, glass_h, 0.012);
    const glass = new THREE.Mesh(glassGeom, glass_mat);
    glass.position.set(0, doorH / 2, 0.001);
    leafGroup.add(glass);

    // Geometric Lines (Sample)
    const lineGeom = new THREE.BoxGeometry(0.42, 0.01, 0.012);
    const line1 = new THREE.Mesh(lineGeom, metal_mat);
    line1.rotation.z = Math.PI / 4 * (offsetX > 0 ? 1 : -1);
    line1.position.set(0, doorH * 0.7, 0.01);
    leafGroup.add(line1);

    leafGroup.position.x = offsetX;
    return leafGroup;
  };

  group.add(createDoorLeaf(-single_w / 2));
  group.add(createDoorLeaf(single_w / 2));

  // 2. Outer Frame
  const frameThickness = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.1;
  const outerFrameGeom = new THREE.BoxGeometry(doorW + 0.1, doorH + 0.05, frameThickness);
  const outerFrame = new THREE.Mesh(outerFrameGeom, wood_mat);
  outerFrame.position.set(0, doorH / 2 + 0.025, -0.01);
  // Using a slightly larger box as frame for simplicity
  group.add(outerFrame);

  // Final Positioning
  group.position.set(px, 0, pz);
  if (vectors) {
    group.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }

  scene.add(group);
};
