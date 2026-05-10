import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderSingleBed = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const bed_width = Number(m.bed_width ?? 1.2);
  const bed_depth = Number(m.bed_depth ?? 2.1);
  const base_height = Number(m.base_height ?? 0.32);
  const mattress_height = Number(m.mattress_height ?? 0.22);
  const headboard_height = Number(m.headboard_height ?? 1.05);

  const materials = {
    base: new THREE.MeshStandardMaterial({
      color: 0x8B7355, // Wood base
      metalness: 0.05,
      roughness: 0.8
    }),
    mattress: new THREE.MeshStandardMaterial({
      color: 0xFFFAFA, // White mattress
      metalness: 0.0,
      roughness: 0.95
    }),
    headboard: new THREE.MeshStandardMaterial({
      color: 0x696969, // Gray padded headboard
      metalness: 0.0,
      roughness: 0.9
    }),
    pillow: new THREE.MeshStandardMaterial({
      color: 0xE8F0F8, // Light blue pillow
      metalness: 0.0,
      roughness: 1.0
    }),
    blanket: new THREE.MeshStandardMaterial({
      color: 0x4682B4, // Steel blue blanket
      metalness: 0.0,
      roughness: 0.85
    }),
    leg: new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.2,
      roughness: 0.5
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
  addPart(baseGeom, "base", 0, 0, 0.10 + base_height / 2);

  // Mattress
  const mattressGeom = new THREE.BoxGeometry(bed_width - 0.06, bed_depth - 0.06, mattress_height);
  addPart(mattressGeom, "mattress", 0, 0, 0.40 + mattress_height / 2);

  // Headboard
  const headboardGeom = new THREE.BoxGeometry(bed_width + 0.1, 0.15, headboard_height);
  addPart(headboardGeom, "headboard", 0, bed_depth / 2 - 0.075, 0.10 + headboard_height / 2);

  // Pillow
  const pillowGeom = new THREE.BoxGeometry(0.7, 0.45, 0.12);
  addPart(pillowGeom, "pillow", 0, bed_depth / 2 - 0.35, 0.60 + 0.12 / 2);

  // Blanket
  const blanket_length = bed_depth * 0.55;
  const blanket_width = bed_width;
  const blanketGeom = new THREE.BoxGeometry(blanket_width, blanket_length, 0.04);
  const blanket_y = -bed_depth / 2 + blanket_length / 2;
  addPart(blanketGeom, "blanket", 0, blanket_y, 0.40 + mattress_height / 2 + 0.02);

  // Legs
  const legGeom = new THREE.BoxGeometry(0.08, 0.08, 0.10);
  const leg_positions = [
    [-bed_width / 2 + 0.1, -bed_depth / 2 + 0.1],
    [bed_width / 2 - 0.1, -bed_depth / 2 + 0.1],
    [-bed_width / 2 + 0.1, bed_depth / 2 - 0.25],
    [bed_width / 2 - 0.1, bed_depth / 2 - 0.25]
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
