import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderCoveCeiling = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const room_width = Number(m.room_width ?? 4.0);
  const room_depth = Number(m.room_depth ?? 5.0);
  const cove_width = Number(m.cove_width ?? 0.6);
  const drop_depth = Number(m.drop_depth ?? 0.15);
  const light_gap = Number(m.light_gap ?? 0.05);

  const materials = {
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xFAFAFA, // Pure white
      metalness: 0.0,
      roughness: 0.95
    }),
    cove_light: new THREE.MeshBasicMaterial({
      color: 0xFFEDD6, // Warm light emission
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

  // Main False Ceiling (The lowered part around the perimeter)
  const outerGeom = new THREE.BoxGeometry(room_width, room_depth, drop_depth);
  // Central Cutout
  const inner_w = room_width - cove_width * 2;
  const inner_d = room_depth - cove_width * 2;

  // We build the perimeter with 4 boxes to leave the center hollow
  // Top/Bottom (along X)
  const topBox = new THREE.BoxGeometry(room_width, cove_width, drop_depth);
  const bottomBox = new THREE.BoxGeometry(room_width, cove_width, drop_depth);
  // Left/Right (along Y)
  const leftBox = new THREE.BoxGeometry(cove_width, inner_d, drop_depth);
  const rightBox = new THREE.BoxGeometry(cove_width, inner_d, drop_depth);

  addPart(topBox, "ceiling", 0, room_depth / 2 - cove_width / 2, -drop_depth / 2);
  addPart(bottomBox, "ceiling", 0, -room_depth / 2 + cove_width / 2, -drop_depth / 2);
  addPart(leftBox, "ceiling", -room_width / 2 + cove_width / 2, 0, -drop_depth / 2);
  addPart(rightBox, "ceiling", room_width / 2 - cove_width / 2, 0, -drop_depth / 2);

  // Hidden Cove Light Strip (Just above the inner edge)
  const light_w = inner_w + light_gap * 2;
  const light_d = inner_d + light_gap * 2;

  const lightTop = new THREE.BoxGeometry(light_w, light_gap, 0.02);
  const lightBottom = new THREE.BoxGeometry(light_w, light_gap, 0.02);
  const lightLeft = new THREE.BoxGeometry(light_gap, inner_d, 0.02);
  const lightRight = new THREE.BoxGeometry(light_gap, inner_d, 0.02);

  addPart(lightTop, "cove_light", 0, light_d / 2 - light_gap / 2, -drop_depth + 0.02);
  addPart(lightBottom, "cove_light", 0, -light_d / 2 + light_gap / 2, -drop_depth + 0.02);
  addPart(lightLeft, "cove_light", -light_w / 2 + light_gap / 2, 0, -drop_depth + 0.02);
  addPart(lightRight, "cove_light", light_w / 2 - light_gap / 2, 0, -drop_depth + 0.02);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  // Move to ceiling height, assuming placement Y is room height
  // Or just leave it at 0, user places it at the desired height
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
