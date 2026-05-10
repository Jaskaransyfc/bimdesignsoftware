import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderGeometricCeiling = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const room_width = Number(m.room_width ?? 4.5);
  const room_depth = Number(m.room_depth ?? 5.5);
  const panel_size = Number(m.panel_size ?? 1.0);
  const gap = Number(m.gap ?? 0.15);
  const drop_depth = Number(m.drop_depth ?? 0.2);

  const materials = {
    panel: new THREE.MeshStandardMaterial({
      color: 0xFDFDFD, // White panels
      metalness: 0.1,
      roughness: 0.8
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x8C6A4B, // Wood accents
      metalness: 0.05,
      roughness: 0.8
    }),
    light: new THREE.MeshBasicMaterial({
      color: 0xFFF5E6, // Warm light emission
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
  addPart(baseGeom, "panel", 0, 0, 0);

  // Geometric Panels grid
  const cols = Math.floor(room_width / (panel_size + gap));
  const rows = Math.floor(room_depth / (panel_size + gap));

  const startX = -((cols * (panel_size + gap)) - gap) / 2 + panel_size / 2;
  const startY = -((rows * (panel_size + gap)) - gap) / 2 + panel_size / 2;

  const panelGeom = new THREE.BoxGeometry(panel_size, panel_size, drop_depth);
  const woodGeom = new THREE.BoxGeometry(panel_size - 0.1, panel_size - 0.1, 0.02);
  const lightGeom = new THREE.BoxGeometry(panel_size + 0.02, panel_size + 0.02, 0.01);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (panel_size + gap);
      const y = startY + r * (panel_size + gap);

      // Main dropping panel
      addPart(panelGeom, "panel", x, y, -drop_depth / 2);

      // Inner wood accent
      addPart(woodGeom, "wood", x, y, -drop_depth - 0.01);

      // Light glow behind panel
      addPart(lightGeom, "light", x, y, -drop_depth * 0.2);
    }
  }

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
