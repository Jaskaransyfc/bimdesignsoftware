import * as THREE from "three";

export const renderOakSlatPartition = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number,
  height: number,
  rotation: number,
  selected = false
) => {
  const group = new THREE.Group();
  
  const W = length;
  const H = height;
  const D = 0.12;
  const frame_w = 0.055;
  const frame_d = 0.09;
  const slat_w = 0.042;
  const slat_d = 0.032;
  const base_h = 0.045;
  const top_h = 0.045;
  const n_slats = Math.floor(W / 0.08); // dynamic number of slats based on length

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#1C1C1C",
    metalness: 0.85,
    roughness: 0.24,
  });

  const oakMat = new THREE.MeshStandardMaterial({
    color: "#C89258",
    metalness: 0.08,
    roughness: 0.72,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: "#2C2C2C",
    metalness: 0.65,
    roughness: 0.32,
  });

  // FRAME
  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(frame_w, H, frame_d), frameMat);
  leftPost.position.set(frame_w / 2, H / 2, 0);
  group.add(leftPost);

  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(frame_w, H, frame_d), frameMat);
  rightPost.position.set(W - frame_w / 2, H / 2, 0);
  group.add(rightPost);

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(W, top_h, frame_d), frameMat);
  topBeam.position.set(W / 2, H - top_h / 2, 0);
  group.add(topBeam);

  const botBeam = new THREE.Mesh(new THREE.BoxGeometry(W, base_h, frame_d), frameMat);
  botBeam.position.set(W / 2, base_h / 2, 0);
  group.add(botBeam);

  const inner_w = W - 2 * frame_w;
  const spacing = inner_w / (n_slats - 1);

  for (let i = 0; i < n_slats; i++) {
    const x = frame_w + i * spacing;
    const slatH = H - base_h - top_h - 0.05; // small gap
    const slat = new THREE.Mesh(new THREE.BoxGeometry(slat_w, slatH, slat_d), oakMat);
    slat.position.set(x, H / 2, 0);
    group.add(slat);
  }

  // RAILS
  for (const ry of [H * 0.3, H * 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - frame_w * 2, 0.018, 0.026), railMat);
    rail.position.set(W / 2, ry, 0);
    group.add(rail);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
