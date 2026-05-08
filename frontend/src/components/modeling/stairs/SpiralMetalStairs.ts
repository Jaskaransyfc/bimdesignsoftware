import * as THREE from "three";
import { Stair } from "@/types/modeling";

const MM_SCALE = 500;

export const renderSpiralMetalStairs = (
  scene: THREE.Scene,
  stair: Stair,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const center_xy = [stair.position.x / 10, stair.position.y / 10]; // PLAN_SCALE = 10
  const step_count = 15;
  const rise = 0.23;
  const angle_per_step = (26.0 * Math.PI) / 180;
  const tread_sweep = (22.0 * Math.PI) / 180;
  const tread_thick = 0.06;
  const pole_radius = 0.11;
  const inner_tread_radius = 0.18;
  const outer_tread_radius = 1.0;
  const rail_radius = 1.03;
  const handrail_radius = 1.05;
  const rail_height = 0.96;
  const baluster_size = 0.028;
  const handrail_size = 0.05;
  const start_angle = (-72.0 * Math.PI) / 180;
  const z_start = 0.18;

  const steel_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#b8c4cf",
    roughness: 0.38,
    metalness: 0.85,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });

  const dark_metal_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#2d2f33",
    roughness: 0.3,
    metalness: 0.8,
  });

  const mid_metal_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#93a3b2",
    roughness: 0.42,
    metalness: 0.82,
  });

  // 1. Central Column
  const columnGeom = new THREE.CylinderGeometry(pole_radius, pole_radius, 5, 20);
  const column = new THREE.Mesh(columnGeom, steel_mat);
  column.position.set(center_xy[0], 2.5, center_xy[1]);
  group.add(column);

  // 2. Base Plate
  const baseGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20);
  const base = new THREE.Mesh(baseGeom, dark_metal_mat);
  base.position.set(center_xy[0], 0.02, center_xy[1]);
  group.add(base);

  // 3. Treads and Rails
  for (let i = 0; i < step_count; i++) {
    const a0 = start_angle + i * angle_per_step;
    const a1 = a0 + tread_sweep;
    const z = z_start + i * rise;

    // Tread Geometry (Ring Sector)
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer_tread_radius, a0, a1, false);
    shape.absarc(0, 0, inner_tread_radius, a1, a0, true);
    
    const treadGeom = new THREE.ExtrudeGeometry(shape, {
      depth: tread_thick,
      bevelEnabled: false,
    });
    treadGeom.rotateX(Math.PI / 2); // Lay flat
    const tread = new THREE.Mesh(treadGeom, steel_mat);
    tread.position.set(center_xy[0], z, center_xy[1]);
    group.add(tread);

    // Collar
    const collarGeom = new THREE.CylinderGeometry(pole_radius + 0.03, pole_radius + 0.03, 0.025, 18);
    const collar = new THREE.Mesh(collarGeom, mid_metal_mat);
    collar.position.set(center_xy[0], z - 0.01, center_xy[1]);
    group.add(collar);

    // Baluster
    const mid_a = (a0 + a1) / 2;
    const bx = center_xy[0] + rail_radius * Math.cos(mid_a);
    const bz = center_xy[1] + rail_radius * Math.sin(mid_a);
    const balusterGeom = new THREE.BoxGeometry(baluster_size, rail_height, baluster_size);
    const baluster = new THREE.Mesh(balusterGeom, steel_mat);
    baluster.position.set(bx, z + tread_thick + rail_height / 2, bz);
    group.add(baluster);
  }

  // 4. Handrail (Spiral Curve)
  const handrailPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = start_angle + t * (step_count * angle_per_step);
    const z = z_start + (t * step_count) * rise + tread_thick + rail_height;
    handrailPoints.push(new THREE.Vector3(
      center_xy[0] + handrail_radius * Math.cos(a),
      z,
      center_xy[1] + handrail_radius * Math.sin(a)
    ));
  }
  const handrailCurve = new THREE.CatmullRomCurve3(handrailPoints);
  const handrailGeom = new THREE.TubeGeometry(handrailCurve, 64, handrail_size / 2, 8, false);
  const handrail = new THREE.Mesh(handrailGeom, dark_metal_mat);
  group.add(handrail);

  scene.add(group);
};
