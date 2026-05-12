import * as THREE from "three";

export const renderTreeBranchStairRailing = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  n_steps: number = 8,
  step_rise: number = 0.18,
  step_run: number = 0.28,
  rotation: number = 0
) => {
  const group = new THREE.Group();

  const rail_height = 1.0;
  const rail_radius = 0.025;
  const post_radius = 0.03;
  const branch_radius = 0.012;
  const total_length = n_steps * step_run;
  const total_rise = n_steps * step_rise;
  const y_side = 0.55;

  const stairMat = new THREE.MeshStandardMaterial({ color: "#A0826D", roughness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({
    color: "#2A2A2A",
    metalness: 0.9,
    roughness: 0.3,
  });
  const branchMat = new THREE.MeshStandardMaterial({
    color: "#3A2A1A",
    metalness: 0.7,
    roughness: 0.5,
  });

  // 1. STAIRS
  for (let i = 0; i < n_steps; i++) {
    const stepGeom = new THREE.BoxGeometry(step_run, step_rise, 1.2);
    const step = new THREE.Mesh(stepGeom, stairMat);
    step.position.set(i * step_run + step_run / 2, i * step_rise + step_rise / 2, 0);
    group.add(step);
  }

  // 2. RAILS (Top and Bottom along incline)
  const angle = Math.atan2(total_rise, total_length);
  const slope_len = Math.sqrt(total_length ** 2 + total_rise ** 2);

  const createInclineRail = (z_offset: number, y_pos: number) => {
    const railGeom = new THREE.CylinderGeometry(rail_radius, rail_radius, slope_len, 12);
    railGeom.rotateZ(Math.PI / 2);
    const rail = new THREE.Mesh(railGeom, railMat);
    
    // Position at midpoint and rotate
    rail.position.set(total_length / 2, total_rise / 2 + z_offset, y_pos);
    rail.rotation.z = angle;
    group.add(rail);
  };

  createInclineRail(rail_height, y_side);
  createInclineRail(0.05, y_side);
  createInclineRail(rail_height, -y_side);
  createInclineRail(0.05, -y_side);

  // 3. POSTS
  const createPost = (x: number, z: number, y: number) => {
    const postGeom = new THREE.CylinderGeometry(post_radius, post_radius, rail_height + 0.1, 12);
    const post = new THREE.Mesh(postGeom, railMat);
    post.position.set(x, z + (rail_height + 0.1) / 2, y);
    group.add(post);
  };

  createPost(0, step_rise, y_side);
  createPost(total_length, total_rise + step_rise, y_side);
  createPost(0, step_rise, -y_side);
  createPost(total_length, total_rise + step_rise, -y_side);

  // 4. BRANCHES (Organic grill)
  // We'll generate a few branches per step
  const createBranch = (startX: number, startZ: number, startY: number) => {
    const branchGroup = new THREE.Group();
    const depth = 3;
    
    const grow = (x: number, z: number, y: number, dirX: number, dirZ: number, len: number, d: number) => {
      if (d === 0 || len < 0.05) return;
      
      const geom = new THREE.CylinderGeometry(branch_radius * (d/depth), branch_radius * ((d-1)/depth || 0.1), len, 8);
      geom.translate(0, len / 2, 0);
      const mesh = new THREE.Mesh(geom, branchMat);
      
      mesh.position.set(x, z, y);
      const branchAngle = Math.atan2(dirX, dirZ);
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.z = -branchAngle;
      
      branchGroup.add(mesh);
      
      // Children
      const nextX = x + dirX * len;
      const nextZ = z + dirZ * len;
      grow(nextX, nextZ, y, dirX + (Math.random() - 0.5) * 0.5, dirZ + (Math.random() - 0.5) * 0.5, len * 0.7, d - 1);
      grow(nextX, nextZ, y, dirX + (Math.random() - 0.5) * 0.5, dirZ + (Math.random() - 0.5) * 0.5, len * 0.7, d - 1);
    };

    grow(startX, startZ, startY, 0, 1, rail_height * 0.4, depth);
    group.add(branchGroup);
  };

  for (let i = 0; i < n_steps; i++) {
    const bx = (i + 0.5) * step_run;
    const bz = (i + 0.5) * step_rise + 0.05;
    createBranch(bx, bz, y_side);
    createBranch(bx, bz, -y_side);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
