import * as THREE from "three";

export const renderAshWoodPartition = (
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
  const D = 0.115;
  const frame_w = 0.052;
  const frame_d = 0.086;
  const slat_w = 0.038;
  const slat_d = 0.03;
  const base_h = 0.042;
  const top_h = 0.042;
  const n_slats = Math.floor(W / 0.1); 

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#202020",
    metalness: 0.82,
    roughness: 0.24,
  });

  const ashMat = new THREE.MeshStandardMaterial({
    color: "#D8C4A8",
    metalness: 0.03,
    roughness: 0.82,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: "#2C2C2C",
    metalness: 0.68,
    roughness: 0.3,
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
    const slat = new THREE.Mesh(new THREE.BoxGeometry(slat_w, slatH, slat_d), ashMat);
    slat.position.set(x, H / 2, 0);
    group.add(slat);
    
    // Simple grain lines
    for (let g = 0; g < 3; g++) {
      const gx = x - slat_w / 2 + 0.008 + g * 0.01;
      const grain = new THREE.Mesh(new THREE.BoxGeometry(0.002, slatH - 0.04, 0.001), new THREE.MeshBasicMaterial({ color: "#B99674", opacity: 0.4, transparent: true }));
      grain.position.set(gx, H / 2, slat_d / 2 + 0.0005);
      group.add(grain);
    }
  }

  // RAILS
  for (const ry of [H * 0.3, H * 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - frame_w * 2, 0.016, 0.022), railMat);
    rail.position.set(W / 2, ry, 0);
    group.add(rail);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
