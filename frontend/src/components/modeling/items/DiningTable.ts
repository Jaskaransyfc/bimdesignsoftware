import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderDiningTable = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const table_width = Number(m.table_width ?? 2.4);
  const table_depth = Number(m.table_depth ?? 1.2);
  const table_height = Number(m.table_height ?? 0.78);
  const top_thickness = Number(m.top_thickness ?? 0.08);

  const materials = {
    top: new THREE.MeshStandardMaterial({
      color: 0xEEEEEE, // Marble white
      metalness: 0.1,
      roughness: 0.2
    }),
    base: new THREE.MeshStandardMaterial({
      color: 0xD4AF37, // Gold metal
      metalness: 0.8,
      roughness: 0.2
    }),
    chair_seat: new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark grey velvet
      metalness: 0.0,
      roughness: 0.8
    }),
    chair_leg: new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.2
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

  // Table Top
  const topGeom = new THREE.BoxGeometry(table_width, table_depth, top_thickness);
  addPart(topGeom, "top", 0, 0, table_height - top_thickness / 2);

  // Table Base (Pedestal style)
  const baseWidth = table_width * 0.5;
  const baseDepth = table_depth * 0.4;
  const baseGeom = new THREE.BoxGeometry(baseWidth, baseDepth, table_height - top_thickness);
  addPart(baseGeom, "base", 0, 0, (table_height - top_thickness) / 2);

  const basePlateGeom = new THREE.BoxGeometry(baseWidth + 0.2, baseDepth + 0.2, 0.04);
  addPart(basePlateGeom, "base", 0, 0, 0.02);

  // Chairs
  const chair_width = 0.5;
  const chair_depth = 0.5;
  const chair_seat_h = 0.45;
  const chair_back_h = 0.95;

  const drawChair = (cx: number, cy: number, rot: number) => {
    const chairGroup = new THREE.Group();

    const seat = new THREE.Mesh(new THREE.BoxGeometry(chair_width, chair_depth, 0.08), materials.chair_seat);
    seat.position.set(0, 0, chair_seat_h);
    chairGroup.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(chair_width, 0.08, chair_back_h - chair_seat_h), materials.chair_seat);
    back.position.set(0, chair_depth / 2 - 0.04, chair_seat_h + (chair_back_h - chair_seat_h) / 2);
    chairGroup.add(back);

    const legGeom = new THREE.CylinderGeometry(0.02, 0.015, chair_seat_h);
    const leg_pos = [
      [-chair_width / 2 + 0.05, -chair_depth / 2 + 0.05],
      [chair_width / 2 - 0.05, -chair_depth / 2 + 0.05],
      [-chair_width / 2 + 0.05, chair_depth / 2 - 0.05],
      [chair_width / 2 - 0.05, chair_depth / 2 - 0.05]
    ];

    for (const pos of leg_pos) {
      const leg = new THREE.Mesh(legGeom, materials.chair_leg);
      // In FreeCAD Z-up space, we build the chair with Y as depth, Z as height
      // But ThreeJS Cylinder is along Y. We need to rotate it so it aligns with Z.
      leg.rotation.x = Math.PI / 2;
      leg.position.set(pos[0], pos[1], chair_seat_h / 2);
      chairGroup.add(leg);
    }

    chairGroup.position.set(cx, cy, 0);
    chairGroup.rotation.z = rot;
    group.add(chairGroup);
  };

  // Place 6 chairs
  const spacing_x = table_width * 0.3;
  const offset_y = table_depth / 2 + 0.2;

  // 3 on one side
  drawChair(-spacing_x, -offset_y, 0);
  drawChair(0, -offset_y, 0);
  drawChair(spacing_x, -offset_y, 0);

  // 3 on other side
  drawChair(-spacing_x, offset_y, Math.PI);
  drawChair(0, offset_y, Math.PI);
  drawChair(spacing_x, offset_y, Math.PI);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
