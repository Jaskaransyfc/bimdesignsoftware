import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderTVPanel = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const panel_width = Number(m.panel_width ?? 3.6);
  const panel_height = Number(m.panel_height ?? 2.4);
  const panel_depth = Number(m.panel_depth ?? 0.05);
  const tv_width = Number(m.tv_width ?? 1.45);
  const tv_height = Number(m.tv_height ?? 0.85);
  const tv_depth = Number(m.tv_depth ?? 0.04);
  const console_height = Number(m.console_height ?? 0.35);
  const console_depth = Number(m.console_depth ?? 0.40);

  const materials = {
    panel: new THREE.MeshStandardMaterial({
      color: 0x3A2E28, // Dark wood
      metalness: 0.1,
      roughness: 0.8
    }),
    slats: new THREE.MeshStandardMaterial({
      color: 0x8B653D, // Lighter wood
      metalness: 0.05,
      roughness: 0.9
    }),
    tv: new THREE.MeshStandardMaterial({
      color: 0x050505, // Black screen
      metalness: 0.8,
      roughness: 0.1
    }),
    console: new THREE.MeshStandardMaterial({
      color: 0x222222, // Dark console
      metalness: 0.2,
      roughness: 0.6
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

  // Back Panel
  const panelGeom = new THREE.BoxGeometry(panel_width, panel_depth, panel_height);
  addPart(panelGeom, "panel", 0, panel_depth / 2, panel_height / 2);

  // Decorative Slats
  const slat_width = 0.05;
  const slat_gap = 0.03;
  const slatGeom = new THREE.BoxGeometry(slat_width, panel_depth + 0.02, panel_height);
  let start_x = -panel_width / 2 + 0.1;
  for (let i = 0; i < 15; i++) {
    addPart(slatGeom, "slats", start_x, (panel_depth + 0.02) / 2, panel_height / 2);
    start_x += slat_width + slat_gap;
  }

  // TV Screen
  const tv_z = 0.9 + tv_height / 2;
  const tvGeom = new THREE.BoxGeometry(tv_width, tv_depth, tv_height);
  addPart(tvGeom, "tv", 0, panel_depth + tv_depth / 2, tv_z);

  // Floating Console
  const console_z = 0.4;
  const consoleGeom = new THREE.BoxGeometry(panel_width * 0.8, console_depth, console_height);
  addPart(consoleGeom, "console", 0, console_depth / 2, console_z + console_height / 2);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
