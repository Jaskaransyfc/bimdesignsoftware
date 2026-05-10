import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderSofa3Seater = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const sofa_width = Number(m.sofa_width ?? 4.2);
  const sofa_depth = Number(m.sofa_depth ?? 1.15);
  const seat_height = Number(m.seat_height ?? 0.42);
  const back_height = Number(m.back_height ?? 0.82);
  const arm_width = Number(m.arm_width ?? 0.24);
  const gap = Number(m.gap ?? 0.05);

  const materials = {
    sofa: new THREE.MeshStandardMaterial({
      color: 0xD4C6B4,
      metalness: 0.02,
      roughness: 0.95
    }),
    cushion: new THREE.MeshStandardMaterial({
      color: 0xEEE5D8,
      metalness: 0.0,
      roughness: 0.98
    }),
    leg: new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.18,
      roughness: 0.45
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: "sofa" | "cushion" | "leg", x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Base
  const baseGeom = new THREE.BoxGeometry(sofa_width, sofa_depth, seat_height);
  addPart(baseGeom, "sofa", 0, 0, 0.12 + seat_height / 2);

  // Backrest
  const backrestThickness = 0.18;
  const backrestGeom = new THREE.BoxGeometry(sofa_width, backrestThickness, back_height);
  addPart(backrestGeom, "sofa", 0, sofa_depth / 2 - backrestThickness / 2, 0.54 + back_height / 2);

  // Armrests
  const armHeight = 0.68;
  const armGeom = new THREE.BoxGeometry(arm_width, sofa_depth, armHeight);
  // Left arm
  addPart(armGeom, "sofa", -sofa_width / 2 + arm_width / 2, 0, 0.12 + armHeight / 2);
  // Right arm
  addPart(armGeom, "sofa", sofa_width / 2 - arm_width / 2, 0, 0.12 + armHeight / 2);

  // Cushions
  const usable_width = sofa_width - (arm_width * 2);
  const cushion_width = (usable_width - (gap * 4)) / 3;
  
  const start_x = -usable_width / 2 + gap + cushion_width / 2;
  const seatCushionGeom = new THREE.BoxGeometry(cushion_width, 0.86, 0.14);
  const backCushionGeom = new THREE.BoxGeometry(cushion_width, 0.14, 0.42);

  for (let i = 0; i < 3; i++) {
    const x = start_x + i * (cushion_width + gap);
    // Seat Cushion
    addPart(seatCushionGeom, "cushion", x, -0.43 + 0.86 / 2, 0.50 + 0.14 / 2);
    // Back Cushion
    addPart(backCushionGeom, "cushion", x, 0.37 + 0.14 / 2, 0.62 + 0.42 / 2);
  }

  // Legs
  const legGeom = new THREE.BoxGeometry(0.08, 0.08, 0.12);
  const leg_positions = [
    [-sofa_width / 2 + 0.2, -sofa_depth / 2 + 0.075],
    [sofa_width / 2 - 0.2, -sofa_depth / 2 + 0.075],
    [-sofa_width / 2 + 0.2, sofa_depth / 2 - 0.175],
    [sofa_width / 2 - 0.2, sofa_depth / 2 - 0.175]
  ];

  for (const pos of leg_positions) {
    addPart(legGeom, "leg", pos[0], pos[1], 0.06);
  }

  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
