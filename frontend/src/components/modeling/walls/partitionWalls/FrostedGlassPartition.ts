import * as THREE from "three";

export const renderFrostedGlassPartition = (
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
  const D = 0.08;
  const channel_h = 0.05;
  const channel_d = 0.075;
  const outer_w = 0.04;
  const mullion_w = 0.02;
  const mullion_d = 0.07;
  const gt = 0.012;
  const panel_gap = 0.003;
  
  const n_panels = 5;
  const inner_w = W - 2 * outer_w;
  const panel_w = (inner_w - (n_panels - 1) * mullion_w) / n_panels;
  const glass_h = H - 2 * channel_h - panel_gap * 2;

  const channelMat = new THREE.MeshStandardMaterial({
    color: "#A8AEB2",
    metalness: 0.82,
    roughness: 0.22,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#9EA4A8",
    metalness: 0.78,
    roughness: 0.25,
  });

  const mullionMat = new THREE.MeshStandardMaterial({
    color: "#B0B6BA",
    metalness: 0.8,
    roughness: 0.2,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#DDE4E8",
    opacity: 0.82,
    transparent: true,
    metalness: 0.02,
    roughness: 0.88,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: "#C0C6CA",
    metalness: 0.75,
    roughness: 0.28,
  });

  // FLOOR/CEILING CHANNELS
  const floorCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), channelMat);
  floorCh.position.set(W / 2, channel_h / 2, 0);
  group.add(floorCh);

  const ceilCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), channelMat);
  ceilCh.position.set(W / 2, H - channel_h / 2, 0);
  group.add(ceilCh);

  // POSTS
  const postL = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, mullion_d), frameMat);
  postL.position.set(outer_w / 2, H / 2, 0);
  group.add(postL);

  const postR = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, mullion_d), frameMat);
  postR.position.set(W - outer_w / 2, H / 2, 0);
  group.add(postR);

  // MULLIONS & GLASS
  for (let i = 0; i < n_panels - 1; i++) {
    const mx = outer_w + (i + 1) * panel_w + i * mullion_w + mullion_w / 2;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(mullion_w, H - 2 * channel_h, mullion_d), mullionMat);
    mullion.position.set(mx, H / 2, 0);
    group.add(mullion);
  }

  for (let i = 0; i < n_panels; i++) {
    const gx = outer_w + i * (panel_w + mullion_w) + panel_w / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(panel_w - panel_gap * 2, glass_h, gt), glassMat);
    glass.position.set(gx, H / 2, 0);
    group.add(glass);
  }

  // TRIMS
  const floorTrim = new THREE.Mesh(new THREE.BoxGeometry(W, 0.008, channel_d + 0.012), trimMat);
  floorTrim.position.set(W / 2, channel_h - 0.004, 0);
  group.add(floorTrim);

  const ceilTrim = new THREE.Mesh(new THREE.BoxGeometry(W, 0.008, channel_d + 0.012), trimMat);
  ceilTrim.position.set(W / 2, H - channel_h + 0.004, 0);
  group.add(ceilTrim);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
