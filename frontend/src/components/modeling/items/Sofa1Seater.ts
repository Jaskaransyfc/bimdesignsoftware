import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderSofa1Seater = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const sofa_width = Number(m.sofa_width ?? 1.3);
  const sofa_depth = Number(m.sofa_depth ?? 1.05);
  const seat_height = Number(m.seat_height ?? 0.42);
  const back_height = Number(m.back_height ?? 0.85);
  const arm_width = Number(m.arm_width ?? 0.28);

  const materials = {
    sofa: new THREE.MeshStandardMaterial({
      color: 0x3A3C3E, // Dark modern color
      metalness: 0.1,
      roughness: 0.85
    }),
    cushion: new THREE.MeshStandardMaterial({
      color: 0x484B4E,
      metalness: 0.05,
      roughness: 0.9
    }),
    leg: new THREE.MeshStandardMaterial({
      color: 0x997755, // Wood leg
      metalness: 0.1,
      roughness: 0.7
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
  addPart(baseGeom, "sofa", 0, 0, 0.10 + seat_height / 2);

  // Backrest
  const backrestThickness = 0.20;
  const backrestGeom = new THREE.BoxGeometry(sofa_width, backrestThickness, back_height);
  addPart(backrestGeom, "sofa", 0, sofa_depth / 2 - backrestThickness / 2, 0.45 + back_height / 2);

  // Armrests
  const armHeight = 0.72;
  const armGeom = new THREE.BoxGeometry(arm_width, sofa_depth, armHeight);
  // Left arm
  addPart(armGeom, "sofa", -sofa_width / 2 + arm_width / 2, 0, 0.10 + armHeight / 2);
  // Right arm
  addPart(armGeom, "sofa", sofa_width / 2 - arm_width / 2, 0, 0.10 + armHeight / 2);

  // Cushions
  const cushion_width = sofa_width - (arm_width * 2) - 0.04; // small gap
  const seatCushionGeom = new THREE.BoxGeometry(cushion_width, 0.80, 0.16);
  const backCushionGeom = new THREE.BoxGeometry(cushion_width, 0.16, 0.45);

  // Seat Cushion
  addPart(seatCushionGeom, "cushion", 0, -0.10, 0.45 + 0.16 / 2);
  // Back Cushion
  addPart(backCushionGeom, "cushion", 0, 0.35, 0.58 + 0.45 / 2);

  // Legs
  const legGeom = new THREE.BoxGeometry(0.06, 0.06, 0.10);
  const leg_positions = [
    [-sofa_width / 2 + 0.15, -sofa_depth / 2 + 0.15],
    [sofa_width / 2 - 0.15, -sofa_depth / 2 + 0.15],
    [-sofa_width / 2 + 0.15, sofa_depth / 2 - 0.15],
    [sofa_width / 2 - 0.15, sofa_depth / 2 - 0.15]
  ];

  for (const pos of leg_positions) {
    addPart(legGeom, "leg", pos[0], pos[1], 0.05);
  }

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
