import * as THREE from "three";
import { Stair } from "@/types/modeling";

export const renderSpiralMetalStairs = (
  scene: THREE.Scene,
  stair: Stair,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = stair.metadata || {};
  const step_count = Math.max(1, Number(m.step_count ?? 15));
  const rise = Number(m.rise ?? 0.23);
  const angle_per_step = (Number(m.angle_per_step_deg ?? 26.0) * Math.PI) / 180;
  const tread_sweep = (Number(m.tread_sweep_deg ?? 22.0) * Math.PI) / 180;
  const tread_thick = Number(m.tread_thick ?? 0.06);
  const pole_radius = Number(m.pole_radius ?? 0.11);
  const inner_tread_radius = Number(m.inner_tread_radius ?? 0.18);
  const outer_tread_radius = Number(m.outer_tread_radius ?? 1.0);
  const rail_side_offset = Number(m.rail_side_offset ?? 0.025);
  const rail_radius = outer_tread_radius + rail_side_offset;
  const rail_height = Number(m.rail_height ?? 0.82);
  const baluster_size = Number(m.baluster_size ?? 0.028);
  const handrail_size = Number(m.handrail_size ?? 0.05);
  const start_angle = (Number(m.start_angle_deg ?? -72.0) * Math.PI) / 180;
  const z_start = Number(m.z_start ?? 0.18);
  const pole_top_extension = Number(m.pole_top_extension ?? 0.35);
  const show_radial_supports = m.show_radial_supports !== false;
  const show_step_collars = m.show_step_collars !== false;

  const top_step_z = z_start + (step_count - 1) * rise;
  const top_handrail_z = top_step_z + tread_thick + rail_height;
  const total_height = top_handrail_z + pole_top_extension;

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
  const columnGeom = new THREE.CylinderGeometry(pole_radius, pole_radius, total_height, 22);
  const column = new THREE.Mesh(columnGeom, steel_mat);
  column.position.set(0, total_height / 2, 0);
  group.add(column);

  // 2. Base Plate
  const baseGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 22);
  const base = new THREE.Mesh(baseGeom, dark_metal_mat);
  base.position.set(0, 0.02, 0);
  group.add(base);

  // 3. Treads and Rails
  const railing_top_points: THREE.Vector3[] = [];
  
  for (let i = 0; i < step_count; i++) {
    const a0 = start_angle + i * angle_per_step;
    const a1 = a0 + tread_sweep;
    const mid_a = (a0 + a1) / 2;
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
    tread.position.set(0, z + tread_thick, 0);
    group.add(tread);

    // Collar
    if (show_step_collars) {
      const collarGeom = new THREE.CylinderGeometry(pole_radius + 0.03, pole_radius + 0.03, 0.025, 18);
      const collar = new THREE.Mesh(collarGeom, mid_metal_mat);
      collar.position.set(0, z - 0.01 + 0.0125, 0);
      group.add(collar);
    }

    // Radial support
    if (show_radial_supports) {
      const distance = (inner_tread_radius + 0.05) - (pole_radius + 0.015);
      const radGeom = new THREE.BoxGeometry(distance, 0.028, 0.035);
      const radMesh = new THREE.Mesh(radGeom, mid_metal_mat);
      radMesh.position.set(
        ((pole_radius + 0.015) + distance / 2) * Math.cos(mid_a),
        z + 0.015,
        ((pole_radius + 0.015) + distance / 2) * Math.sin(mid_a)
      );
      radMesh.rotation.y = -mid_a;
      group.add(radMesh);
    }

    // Baluster
    const a_side = a1 - (2.0 * Math.PI) / 180;
    const bx = rail_radius * Math.cos(a_side);
    const bz = rail_radius * Math.sin(a_side);
    
    const balusterGeom = new THREE.BoxGeometry(baluster_size, rail_height, baluster_size);
    const baluster = new THREE.Mesh(balusterGeom, steel_mat);
    baluster.position.set(bx, z + tread_thick + rail_height / 2, bz);
    group.add(baluster);

    railing_top_points.push(new THREE.Vector3(bx, z + tread_thick + rail_height, bz));
  }

  // Continuous handrail
  for (let i = 0; i < step_count - 1; i++) {
    const p0 = railing_top_points[i];
    const p1 = railing_top_points[i + 1];
    const distance = p0.distanceTo(p1);
    
    const handrailGeom = new THREE.BoxGeometry(handrail_size, handrail_size, distance);
    const handrail = new THREE.Mesh(handrailGeom, dark_metal_mat);
    
    handrail.position.copy(p0).add(p1).multiplyScalar(0.5);
    handrail.lookAt(p1);
    group.add(handrail);
  }

  // Entry-side post
  if (step_count > 0) {
    const first_a = start_angle + tread_sweep - (2.0 * Math.PI) / 180;
    const bx = rail_radius * Math.cos(first_a);
    const bz = rail_radius * Math.sin(first_a);
    
    const postGeom = new THREE.BoxGeometry(baluster_size, rail_height, baluster_size);
    const post = new THREE.Mesh(postGeom, steel_mat);
    post.position.set(bx, z_start + tread_thick + rail_height / 2, bz);
    group.add(post);
  }

  // Top collar
  const topCollarGeom = new THREE.CylinderGeometry(pole_radius + 0.04, pole_radius + 0.04, 0.06, 18);
  const topCollar = new THREE.Mesh(topCollarGeom, mid_metal_mat);
  topCollar.position.set(0, total_height - 0.14, 0);
  group.add(topCollar);

  const px = stair.position?.x ?? (stair as any).x ?? 0;
  const py = stair.position?.y ?? (stair as any).y ?? 0;
  group.position.set(px / 10, 0, py / 10);
  group.rotation.y = (stair.rotation || 0) * Math.PI / 180;
  
  scene.add(group);
};
