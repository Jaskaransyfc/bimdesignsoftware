import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderFloatingCoveCeiling = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const room_width = Number(m.room_width ?? 4.2);
  const room_depth = Number(m.room_depth ?? 5.2);
  const panel_width = Number(m.panel_width ?? 3.2);
  const panel_depth = Number(m.panel_depth ?? 4.2);
  const drop_depth = Number(m.drop_depth ?? 0.25);
  const light_gap = Number(m.light_gap ?? 0.08);

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

  // Base Ceiling plane
  const baseGeom = new THREE.BoxGeometry(room_width, room_depth, 0.05);
  addPart(baseGeom, "ceiling", 0, 0, 0);

  // Floating Panel
  const panelGeom = new THREE.BoxGeometry(panel_width, panel_depth, drop_depth);
  addPart(panelGeom, "ceiling", 0, 0, -drop_depth / 2);

  // Floating Light Strip (glow around the panel)
  const light_w = panel_width - light_gap * 2;
  const light_d = panel_depth - light_gap * 2;

  const lightTop = new THREE.BoxGeometry(light_w, light_gap, 0.02);
  const lightBottom = new THREE.BoxGeometry(light_w, light_gap, 0.02);
  const lightLeft = new THREE.BoxGeometry(light_gap, light_d, 0.02);
  const lightRight = new THREE.BoxGeometry(light_gap, light_d, 0.02);

  addPart(lightTop, "cove_light", 0, light_d / 2 + light_gap / 2, -drop_depth + 0.02);
  addPart(lightBottom, "cove_light", 0, -light_d / 2 - light_gap / 2, -drop_depth + 0.02);
  addPart(lightLeft, "cove_light", -light_w / 2 - light_gap / 2, 0, -drop_depth + 0.02);
  addPart(lightRight, "cove_light", light_w / 2 + light_gap / 2, 0, -drop_depth + 0.02);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
