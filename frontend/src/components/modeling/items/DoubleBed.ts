import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderDoubleBed = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const bed_width = Number(m.bed_width ?? 3.2);
  const bed_depth = Number(m.bed_depth ?? 2.3);
  const base_height = Number(m.base_height ?? 0.28);
  const mattress_height = Number(m.mattress_height ?? 0.24);
  const headboard_height = Number(m.headboard_height ?? 1.2);

  const materials = {
    base: new THREE.MeshStandardMaterial({
      color: 0xB78D67,
      metalness: 0.03,
      roughness: 0.82
    }),
    mattress: new THREE.MeshStandardMaterial({
      color: 0xEFE8DE,
      metalness: 0.0,
      roughness: 0.98
    }),
    headboard: new THREE.MeshStandardMaterial({
      color: 0xD4C3AE,
      metalness: 0.02,
      roughness: 0.92
    }),
    panel: new THREE.MeshStandardMaterial({
      color: 0xEADFCC,
      metalness: 0.0,
      roughness: 0.95
    }),
    pillow: new THREE.MeshStandardMaterial({
      color: 0xF5F1EB,
      metalness: 0.0,
      roughness: 1.0
    }),
    blanket: new THREE.MeshStandardMaterial({
      color: 0xC6B19A,
      metalness: 0.0,
      roughness: 0.94
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

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, x: number, y: number, z: number) => {
    const mat = matName === "selected" ? materials.selected : materials[matName];
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Base
  const baseGeom = new THREE.BoxGeometry(bed_width, bed_depth, base_height);
  addPart(baseGeom, "base", 0, 0, 0.12 + base_height / 2);

  // Mattress
  const mattressGeom = new THREE.BoxGeometry(bed_width - 0.12, bed_depth - 0.12, mattress_height);
  addPart(mattressGeom, "mattress", 0, 0, 0.40 + mattress_height / 2);

  // Headboard
  const headboardGeom = new THREE.BoxGeometry(bed_width, 0.12, headboard_height);
  addPart(headboardGeom, "headboard", 0, bed_depth / 2 - 0.06, 0.12 + headboard_height / 2);

  // Panels
  const panel_width = 0.42;
  const panel_gap = 0.05;
  const panelGeom = new THREE.BoxGeometry(panel_width, 0.02, 0.88);
  let start_x = -1.42;
  
  for (let i = 0; i < 6; i++) {
    addPart(panelGeom, "panel", start_x + panel_width / 2, bed_depth / 2 + 0.01 + 0.01, 0.28 + 0.88 / 2);
    start_x += panel_width + panel_gap;
  }

  // Pillows
  const pillowGeom = new THREE.BoxGeometry(1.0, 0.48, 0.12);
  const pillow_positions = [
    [-0.65, bed_depth / 2 - 0.3], // Adjusted slightly for realism
    [0.65, bed_depth / 2 - 0.3]
  ];

  for (const pos of pillow_positions) {
    addPart(pillowGeom, "pillow", pos[0], pos[1], 0.65 + 0.12 / 2);
  }

  // Blanket
  const blanket_length = bed_depth * 0.2;
  const blanket_width = bed_width;
  const blanketGeom = new THREE.BoxGeometry(blanket_width, blanket_length, 0.04);
  const blanket_y = -bed_depth / 2 + blanket_length / 2;
  addPart(blanketGeom, "blanket", 0, blanket_y, 0.40 + mattress_height / 2 + 0.02);

  // Legs
  const legGeom = new THREE.BoxGeometry(0.10, 0.10, 0.12);
  const leg_positions = [
    [-bed_width / 2 + 0.15, -bed_depth / 2 + 0.15],
    [bed_width / 2 - 0.15, -bed_depth / 2 + 0.15],
    [-bed_width / 2 + 0.15, bed_depth / 2 - 0.3],
    [bed_width / 2 - 0.15, bed_depth / 2 - 0.3]
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
