import * as THREE from "three";

export const renderMatteBlackWoodPartition = (
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
  const frame_d = 0.092;
  const slat_w = 0.042;
  const slat_d = 0.034;
  const base_h = 0.045;
  const top_h = 0.045;
  const n_slats = Math.floor(W / 0.1); 

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#121212",
    metalness: 0.88,
    roughness: 0.22,
  });

  const matteBlackMat = new THREE.MeshStandardMaterial({
    color: "#1B1B1B",
    metalness: 0.02,
    roughness: 0.96,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: "#262626",
    metalness: 0.04,
    roughness: 0.82,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: "#222222",
    metalness: 0.72,
    roughness: 0.28,
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
    const slatH = H - base_h - top_h - 0.04;
    const isAccent = i % 5 === 0;
    
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(isAccent ? slat_w + 0.004 : slat_w, slatH, isAccent ? slat_d + 0.006 : slat_d), 
      isAccent ? accentMat : matteBlackMat
    );
    slat.position.set(x, H / 2, 0);
    group.add(slat);
  }

  // RAILS
  for (const ry of [H * 0.31, H * 0.67]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - frame_w * 2, 0.018, 0.024), railMat);
    rail.position.set(W / 2, ry, 0);
    group.add(rail);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
