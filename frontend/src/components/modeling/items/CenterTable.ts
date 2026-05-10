import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderCenterTable = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const table_width = Number(m.table_width ?? 1.8);
  const table_depth = Number(m.table_depth ?? 0.9);
  const table_height = Number(m.table_height ?? 0.42);
  const top_thickness = Number(m.top_thickness ?? 0.05);
  const leg_width = Number(m.leg_width ?? 0.08);

  const materials = {
    top: new THREE.MeshStandardMaterial({
      color: 0xEFE7DB,
      metalness: 0.04,
      roughness: 0.88
    }),
    shelf: new THREE.MeshStandardMaterial({
      color: 0xD8C4AE,
      metalness: 0.02,
      roughness: 0.92
    }),
    leg: new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.25,
      roughness: 0.42
    }),
    panel: new THREE.MeshStandardMaterial({
      color: 0xB88A58,
      metalness: 0.15,
      roughness: 0.62
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: "top" | "shelf" | "leg" | "panel", x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Table Top
  const topGeom = new THREE.BoxGeometry(table_width, table_depth, top_thickness);
  addPart(topGeom, "top", 0, 0, table_height + top_thickness / 2);

  // Lower Shelf
  const shelfGeom = new THREE.BoxGeometry(table_width * 0.78, table_depth * 0.55, 0.035);
  addPart(shelfGeom, "shelf", 0, 0, 0.14 + 0.035 / 2);

  // Legs
  const legGeom = new THREE.BoxGeometry(leg_width, leg_width, table_height);
  const leg_positions = [
    [-table_width / 2 + 0.08, -table_depth / 2 + 0.08],
    [table_width / 2 - 0.08, -table_depth / 2 + 0.08],
    [-table_width / 2 + 0.08, table_depth / 2 - 0.08],
    [table_width / 2 - 0.08, table_depth / 2 - 0.08]
  ];

  for (const pos of leg_positions) {
    addPart(legGeom, "leg", pos[0], pos[1], table_height / 2);
  }

  // Decor Panel
  const panelGeom = new THREE.BoxGeometry(0.75, 0.03, 0.18);
  addPart(panelGeom, "panel", 0, 0, 0.18 + 0.18 / 2);

  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
