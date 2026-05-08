import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderLuxuryGoldGlassDoor = (
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

  const glass_mat = new THREE.MeshStandardMaterial({
    color: "#fffcf0",
    opacity: 0.15,
    metalness: 0.9,
    roughness: 0.05,
    transparent: true,
    depthWrite: false,
  });

  const gold_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#B88648"), // Gold
    metalness: 0.92,
    roughness: 0.14,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const single_w = doorW / 2;

  // 1. Glass Panels
  const createLeaf = (offsetX: number) => {
    const leafGroup = new THREE.Group();
    const glassGeom = new THREE.BoxGeometry(single_w - 0.02, doorH - 0.02, 0.01);
    const glass = new THREE.Mesh(glassGeom, glass_mat);
    glass.position.y = doorH / 2;
    leafGroup.add(glass);

    // Gold Border
    const borderGeom = new THREE.BoxGeometry(single_w, doorH, 0.05);
    // Wireframe-like border using thin boxes
    const t = 0.02;
    const top = new THREE.Mesh(new THREE.BoxGeometry(single_w, t, t), gold_mat);
    top.position.y = doorH;
    leafGroup.add(top);
    
    const bot = new THREE.Mesh(new THREE.BoxGeometry(single_w, t, t), gold_mat);
    bot.position.y = 0;
    leafGroup.add(bot);

    const left = new THREE.Mesh(new THREE.BoxGeometry(t, doorH, t), gold_mat);
    left.position.x = -single_w / 2;
    left.position.y = doorH / 2;
    leafGroup.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(t, doorH, t), gold_mat);
    right.position.x = single_w / 2;
    right.position.y = doorH / 2;
    leafGroup.add(right);

    // Decorative Circle in center
    const circleGeom = new THREE.TorusGeometry(0.12, 0.01, 16, 32);
    const circle = new THREE.Mesh(circleGeom, gold_mat);
    circle.position.set(offsetX > 0 ? -single_w/2 : single_w/2, 1.15, 0.02);
    circle.rotation.y = Math.PI / 2;
    leafGroup.add(circle);

    leafGroup.position.x = offsetX;
    return leafGroup;
  };

  group.add(createLeaf(-single_w / 2));
  group.add(createLeaf(single_w / 2));

  // Final Positioning
  group.position.set(px, 0, pz);
  if (vectors) {
    group.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }

  scene.add(group);
};
