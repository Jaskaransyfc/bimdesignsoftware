import * as THREE from "three";

export const renderRoofGlassRailing = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number = 6.0,
  rotation: number = 0
) => {
  const group = new THREE.Group();

  const rail_height = 1.10;
  const glass_thk = 0.012;
  const rail_r = 0.022;
  const post_r = 0.025;
  const post_spacing = 1.20;
  const clamp_h = 0.10;
  const clamp_w = 0.06;

  const metalMat = new THREE.MeshStandardMaterial({
    color: "#C0C0C0",
    metalness: 0.9,
    roughness: 0.25,
  });

  // @ts-ignore
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#88C8E0",
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.9,
    transparent: true,
    opacity: 0.35,
    thickness: 0.012,
  });

  // 1. Glass Panel
  const glassGeom = new THREE.BoxGeometry(length, rail_height - 0.05, glass_thk);
  const glassMesh = new THREE.Mesh(glassGeom, glassMat);
  glassMesh.position.set(length / 2, (rail_height - 0.05) / 2 + 0.05, 0);
  group.add(glassMesh);

  // 2. Top Handrail (Cylinder)
  const handrailGeom = new THREE.CylinderGeometry(rail_r, rail_r, length, 12);
  handrailGeom.rotateZ(Math.PI / 2);
  const handrail = new THREE.Mesh(handrailGeom, metalMat);
  handrail.position.set(length / 2, rail_height, 0);
  group.add(handrail);

  // End caps (Spheres)
  const capGeom = new THREE.SphereGeometry(rail_r, 12, 8);
  const cap1 = new THREE.Mesh(capGeom, metalMat);
  cap1.position.set(0, rail_height, 0);
  group.add(cap1);

  const cap2 = new THREE.Mesh(capGeom, metalMat);
  cap2.position.set(length, rail_height, 0);
  group.add(cap2);

  // 3. Posts + Clamps
  const n_posts = Math.max(2, Math.round(length / post_spacing) + 1);
  for (let i = 0; i < n_posts; i++) {
    const t = i / (n_posts - 1);
    const x = length * t;

    // Vertical Post
    const postGeom = new THREE.CylinderGeometry(post_r, post_r, rail_height, 12);
    const post = new THREE.Mesh(postGeom, metalMat);
    post.position.set(x, rail_height / 2, 0);
    group.add(post);

    // Base Clamp
    const clampGeom = new THREE.BoxGeometry(clamp_w, clamp_h, clamp_w * 2.2);
    const clamp = new THREE.Mesh(clampGeom, metalMat);
    clamp.position.set(x, clamp_h / 2, 0);
    group.add(clamp);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
