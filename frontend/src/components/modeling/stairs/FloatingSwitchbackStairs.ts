import * as THREE from "three";
import { Stair } from "@/types/modeling";

export const renderFloatingSwitchbackStairs = (
  scene: THREE.Scene,
  stair: Stair,
  isSelected: boolean
) => {
  const stairGroup = new THREE.Group();

  // Parse parameters from metadata or use defaults
  const m = stair.metadata || {};
  const lower_steps = Math.max(1, Number(m.lower_steps ?? 9));
  const upper_steps = Math.max(0, Number(m.upper_steps ?? 7));
  const run = Number(m.run ?? 0.62);
  const rise = Number(m.rise ?? 0.23);
  const tread_len = Number(m.tread_len ?? 0.58);
  const tread_width = Number(m.tread_width ?? 2.05);
  const tread_thick = Number(m.tread_thick ?? 0.12);
  const landing_len_x = Number(m.landing_len_x ?? 1.12);
  const landing_overlap = Number(m.landing_overlap ?? 0.08);
  const lower_y = Number(m.lower_y ?? 0.00); // mapped to Z in three.js
  const upper_y = Number(m.upper_y ?? 2.35); // mapped to Z in three.js
  const show_stringers = m.show_stringers !== false;

  const woodMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#b56a2a",
    roughness: 0.55,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#8a4a1d",
    roughness: 0.45,
  });

  // Helper to draw a box
  const addBox = (w: number, h: number, d: number, px: number, py: number, pz: number, mat: THREE.Material) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(px, py, pz);
    stairGroup.add(mesh);
  };

  // Helper to draw a beam
  const addBeam = (p0: THREE.Vector3, p1: THREE.Vector3, w: number, d: number, mat: THREE.Material) => {
    const distance = p0.distanceTo(p1);
    const geom = new THREE.BoxGeometry(w, d, distance);
    const mesh = new THREE.Mesh(geom, mat);
    
    mesh.position.copy(p0).add(p1).multiplyScalar(0.5);
    mesh.lookAt(p1);
    stairGroup.add(mesh);
  };

  // Lower flight
  for (let i = 0; i < lower_steps; i++) {
    const x = i * run;
    const top_z = (i + 1) * rise;
    const bottom_z = top_z - tread_thick;
    
    // In Three.js: y is up
    addBox(
      tread_len, tread_thick, tread_width,
      x + tread_len/2, bottom_z + tread_thick/2, lower_y,
      woodMat
    );
  }

  // Landing
  const landing_x = lower_steps * run;
  const landing_top_z = lower_steps * rise;
  const landing_bottom_z = landing_top_z - tread_thick;

  const landing_y0 = Math.min(lower_y, upper_y) - tread_width / 2.0;
  const landing_y1 = Math.max(lower_y, upper_y) + tread_width / 2.0;
  const landing_width_y = landing_y1 - landing_y0;
  const landing_center_y = (landing_y0 + landing_y1) / 2;

  addBox(
    landing_len_x, tread_thick, landing_width_y,
    landing_x - landing_overlap + landing_len_x/2, landing_bottom_z + tread_thick/2, landing_center_y,
    woodMat
  );

  // Upper flight
  for (let j = 0; j < upper_steps; j++) {
    const x = landing_x - (j + 1) * run;
    const top_z = landing_top_z + (j + 1) * rise;
    const bottom_z = top_z - tread_thick;

    addBox(
      tread_len, tread_thick, tread_width,
      x - tread_len/2, bottom_z + tread_thick/2, upper_y,
      woodMat
    );
  }

  // Stringers
  if (show_stringers) {
    // Lower
    addBeam(
      new THREE.Vector3(0.05, 0.02, lower_y - 0.82),
      new THREE.Vector3(landing_x + 0.35, landing_bottom_z + 0.04, lower_y - 0.82),
      0.13, 0.13, darkWoodMat
    );
    addBeam(
      new THREE.Vector3(0.05, 0.02, lower_y + 0.82),
      new THREE.Vector3(landing_x + 0.35, landing_bottom_z + 0.04, lower_y + 0.82),
      0.13, 0.13, darkWoodMat
    );

    // Upper
    if (upper_steps > 0) {
      addBeam(
        new THREE.Vector3(landing_x + 0.25, landing_bottom_z + 0.04, upper_y - 0.82),
        new THREE.Vector3(landing_x - upper_steps * run - 0.10, landing_top_z + upper_steps * rise - tread_thick + 0.04, upper_y - 0.82),
        0.13, 0.13, darkWoodMat
      );
      addBeam(
        new THREE.Vector3(landing_x + 0.25, landing_bottom_z + 0.04, upper_y + 0.82),
        new THREE.Vector3(landing_x - upper_steps * run - 0.10, landing_top_z + upper_steps * rise - tread_thick + 0.04, upper_y + 0.82),
        0.13, 0.13, darkWoodMat
      );
    }
  }

  const px = stair.position?.x ?? (stair as any).x ?? 0;
  const py = stair.position?.y ?? (stair as any).y ?? 0;
  stairGroup.position.set(px / 10, 0, py / 10);
  stairGroup.rotation.y = (stair.rotation || 0) * Math.PI / 180;
  
  scene.add(stairGroup);
};
