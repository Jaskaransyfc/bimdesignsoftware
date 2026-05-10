import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderWoodenPanelCeiling = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const room_width = Number(m.room_width ?? 3.6);
  const room_depth = Number(m.room_depth ?? 4.2);
  const drop_depth = Number(m.drop_depth ?? 0.15);
  const panel_width = Number(m.panel_width ?? 0.6);
  const panel_gap = Number(m.panel_gap ?? 0.1);

  const materials = {
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xFAFAFA, // Pure white
      metalness: 0.0,
      roughness: 0.95
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x664422, // Wood
      metalness: 0.05,
      roughness: 0.8
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Base Ceiling
  const baseGeom = new THREE.BoxGeometry(room_width, room_depth, 0.05);
  addPart(baseGeom, "ceiling", 0, 0, 0);

  // Dropped frame
  const frame_w = 0.2;
  const topBox = new THREE.BoxGeometry(room_width, frame_w, drop_depth);
  const bottomBox = new THREE.BoxGeometry(room_width, frame_w, drop_depth);
  const inner_d = room_depth - frame_w * 2;
  const leftBox = new THREE.BoxGeometry(frame_w, inner_d, drop_depth);
  const rightBox = new THREE.BoxGeometry(frame_w, inner_d, drop_depth);

  addPart(topBox, "ceiling", 0, room_depth / 2 - frame_w / 2, -drop_depth / 2);
  addPart(bottomBox, "ceiling", 0, -room_depth / 2 + frame_w / 2, -drop_depth / 2);
  addPart(leftBox, "ceiling", -room_width / 2 + frame_w / 2, 0, -drop_depth / 2);
  addPart(rightBox, "ceiling", room_width / 2 - frame_w / 2, 0, -drop_depth / 2);

  // Wooden Panels inside
  const inner_w = room_width - frame_w * 2;
  const num_panels = Math.floor(inner_w / (panel_width + panel_gap));
  const start_x = -((num_panels * (panel_width + panel_gap)) - panel_gap) / 2 + panel_width / 2;

  const woodGeom = new THREE.BoxGeometry(panel_width, inner_d, drop_depth - 0.02);

  for (let i = 0; i < num_panels; i++) {
    const x = start_x + i * (panel_width + panel_gap);
    addPart(woodGeom, "wood", x, 0, -drop_depth / 2);
  }

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
