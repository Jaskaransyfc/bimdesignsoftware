import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderWaterTank = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const panel_columns = Number(m.panel_columns ?? 4);
  const panel_rows = Number(m.panel_rows ?? 3);
  const panel_size = Number(m.panel_size ?? 0.72);
  const tank_depth = Number(m.tank_depth ?? 1.45);
  const panel_bulge = Number(m.panel_bulge ?? 0.075);
  const frame_thickness = Number(m.frame_thickness ?? 0.055);
  const bolt_radius = Number(m.bolt_radius ?? 0.030);
  const support_count = Number(m.support_count ?? 4);
  const support_height = Number(m.support_height ?? 0.28);
  const show_floor = m.show_floor !== false;
  const floor_thickness = Number(m.floor_thickness ?? 0.06);
  const floor_margin = Number(m.floor_margin ?? 0.45);
  const pipe_radius = Number(m.pipe_radius ?? 0.055);
  const show_inlet = m.show_inlet !== false;
  const show_outlet = m.show_outlet !== false;
  const show_vent = m.show_vent !== false;
  const show_ladder = m.show_ladder !== false;

  const origin_x = Number(m.origin_x ?? -1.45);
  const origin_y = Number(m.origin_y ?? 0.00); // Mapped to z
  const origin_z = Number(m.origin_z ?? 0.35); // Mapped to y

  const tank_width = panel_columns * panel_size;
  const tank_height = panel_rows * panel_size;

  const tank_style = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#eee8d8",
    roughness: 0.48,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const frame_style = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#c8c9c4",
    roughness: 0.28,
    metalness: 0.55,
  });

  const dark_pipe_style = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#50565a",
    roughness: 0.25,
    metalness: 0.72,
  });

  const support_style = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#9f9b91",
    roughness: 0.70,
  });

  const floor_style = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#b8b3aa",
    roughness: 0.85,
  });

  const drawBox = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(px, py, pz);
    group.add(mesh);
  };

  const drawCyl = (r: number, h: number, px: number, py: number, pz: number, rx: number, rz: number, mat: THREE.Material) => {
    const geom = new THREE.CylinderGeometry(r, r, h, 16);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(px, py, pz);
    mesh.rotation.x = rx;
    mesh.rotation.z = rz;
    group.add(mesh);
  };

  const cylinderBetween = (p0: THREE.Vector3, p1: THREE.Vector3, radius: number, mat: THREE.Material) => {
    const distance = p0.distanceTo(p1);
    const geom = new THREE.CylinderGeometry(radius, radius, distance, 16);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(p0).add(p1).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    group.add(mesh);
  };

  const front_y = origin_y;
  const back_y = origin_y + tank_depth;
  const bottom_z = origin_z;
  const top_z = origin_z + tank_height;
  const wall_t = 0.035;

  if (show_floor) {
    drawBox(
      tank_width + floor_margin * 2.0, floor_thickness, tank_depth + floor_margin * 2.0,
      origin_x + tank_width / 2, origin_z - support_height - floor_thickness / 2, front_y + tank_depth / 2,
      floor_style
    );
  }

  for (let i = 0; i < support_count; i++) {
    const t = i / Math.max(support_count - 1, 1);
    const sx = origin_x + 0.18 + t * (tank_width - 0.36);
    drawBox(
      0.24, support_height, 0.42,
      sx, origin_z - support_height / 2, front_y + tank_depth * 0.28 + 0.21,
      support_style
    );
  }

  drawBox(tank_width, tank_height, wall_t, origin_x + tank_width / 2, bottom_z + tank_height / 2, back_y - wall_t / 2, tank_style);
  drawBox(wall_t, tank_height, tank_depth, origin_x + wall_t / 2, bottom_z + tank_height / 2, front_y + tank_depth / 2, tank_style);
  drawBox(wall_t, tank_height, tank_depth, origin_x + tank_width - wall_t / 2, bottom_z + tank_height / 2, front_y + tank_depth / 2, tank_style);
  drawBox(tank_width, wall_t, tank_depth, origin_x + tank_width / 2, top_z - wall_t / 2, front_y + tank_depth / 2, tank_style);
  drawBox(tank_width, wall_t, tank_depth, origin_x + tank_width / 2, bottom_z + wall_t / 2, front_y + tank_depth / 2, tank_style);

  // Simplified bulged panels as boxes
  for (let r = 0; r < panel_rows; r++) {
    for (let c = 0; c < panel_columns; c++) {
      const x0 = origin_x + c * panel_size;
      const z0 = origin_z + r * panel_size;
      drawBox(
        panel_size * 0.95, panel_size * 0.95, panel_bulge,
        x0 + panel_size / 2, z0 + panel_size / 2, front_y - panel_bulge / 2,
        tank_style
      );
    }
  }

  for (let c = 0; c <= panel_columns; c++) {
    const x = origin_x + c * panel_size;
    drawBox(frame_thickness, tank_height, 0.070, x, origin_z + tank_height / 2, front_y - 0.025, frame_style);
    drawBox(frame_thickness, tank_height, 0.070, x, origin_z + tank_height / 2, back_y + 0.025, frame_style);
  }
  for (let r = 0; r <= panel_rows; r++) {
    const z = origin_z + r * panel_size;
    drawBox(tank_width, frame_thickness, 0.075, origin_x + tank_width / 2, z, front_y - 0.0275, frame_style);
    drawBox(tank_width, frame_thickness, 0.070, origin_x + tank_width / 2, z, back_y + 0.025, frame_style);
  }

  if (show_inlet) {
    const inlet_z = origin_z + tank_height * 0.58;
    const inlet_y = front_y + tank_depth * 0.25;
    cylinderBetween(new THREE.Vector3(origin_x - 0.55, origin_z + 0.18, inlet_y), new THREE.Vector3(origin_x - 0.55, inlet_z, inlet_y), pipe_radius, dark_pipe_style);
    cylinderBetween(new THREE.Vector3(origin_x - 0.55, inlet_z, inlet_y), new THREE.Vector3(origin_x, inlet_z, inlet_y), pipe_radius, dark_pipe_style);
    cylinderBetween(new THREE.Vector3(origin_x - 0.03, inlet_z, inlet_y), new THREE.Vector3(origin_x + 0.08, inlet_z, inlet_y), pipe_radius * 1.55, dark_pipe_style);
  }

  if (show_outlet) {
    const outlet_z = origin_z + tank_height * 0.35;
    const outlet_y = front_y + tank_depth * 0.65;
    cylinderBetween(new THREE.Vector3(origin_x + tank_width - 0.08, outlet_z, outlet_y), new THREE.Vector3(origin_x + tank_width + 0.08, outlet_z, outlet_y), pipe_radius * 1.6, dark_pipe_style);
    cylinderBetween(new THREE.Vector3(origin_x + tank_width, outlet_z, outlet_y), new THREE.Vector3(origin_x + tank_width + 0.70, outlet_z, outlet_y), pipe_radius, dark_pipe_style);
  }

  if (show_vent) {
    const vent_x = origin_x + tank_width * 0.55;
    const vent_y = front_y + tank_depth * 0.50;
    cylinderBetween(new THREE.Vector3(vent_x, top_z, vent_y), new THREE.Vector3(vent_x, top_z + 0.42, vent_y), pipe_radius * 0.65, dark_pipe_style);
    drawCyl(pipe_radius * 0.55, 0.26, vent_x, top_z + 0.42, vent_y, 0, Math.PI / 2, dark_pipe_style);
  }

  if (show_ladder) {
    const ladder_x = origin_x + panel_size * 1.10;
    const ladder_y = front_y - 0.16;
    const rail_gap = 0.22;
    const ladder_bottom = origin_z + 0.20;
    const ladder_top = top_z + 0.05;

    cylinderBetween(new THREE.Vector3(ladder_x - rail_gap * 0.5, ladder_bottom, ladder_y), new THREE.Vector3(ladder_x - rail_gap * 0.5, ladder_top, ladder_y), 0.018, frame_style);
    cylinderBetween(new THREE.Vector3(ladder_x + rail_gap * 0.5, ladder_bottom, ladder_y), new THREE.Vector3(ladder_x + rail_gap * 0.5, ladder_top, ladder_y), 0.018, frame_style);

    for (let i = 0; i < 8; i++) {
      const z = ladder_bottom + (i / 7) * (ladder_top - ladder_bottom);
      cylinderBetween(new THREE.Vector3(ladder_x - rail_gap * 0.5, z, ladder_y), new THREE.Vector3(ladder_x + rail_gap * 0.5, z, ladder_y), 0.015, frame_style);
    }
  }

  const METERS_TO_WORLD = 0.5; // From MM_SCALE = 500, so 1m = 2 world units? No, 1000/500 = 2. Wait, the code says:
  // We'll let the caller handle positioning and scaling, or we just apply scale here
  
  return group;
};
