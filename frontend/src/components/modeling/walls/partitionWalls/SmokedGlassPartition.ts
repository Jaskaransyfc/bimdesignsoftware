import * as THREE from "three";

export const renderSmokedGlassPartition = (
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
  const D = 0.085;
  const channel_h = 0.055;
  const channel_d = 0.08;
  const outer_w = 0.05;
  const mullion_w = 0.028;
  const mullion_d = 0.075;
  const gt = 0.012;
  const n_panels = 5;
  const panel_gap = 0.004;

  const tints = [
    { color: "#1A1F22", opacity: 0.75, metalness: 0.25, roughness: 0.08 },
    { color: "#1E2428", opacity: 0.7, metalness: 0.28, roughness: 0.06 },
    { color: "#16191C", opacity: 0.8, metalness: 0.22, roughness: 0.1 },
    { color: "#202528", opacity: 0.72, metalness: 0.26, roughness: 0.07 },
    { color: "#181C1F", opacity: 0.78, metalness: 0.24, roughness: 0.09 },
  ];

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#1C1C1C",
    metalness: 0.85,
    roughness: 0.2,
  });

  const edgeMat = new THREE.MeshStandardMaterial({
    color: "#8AB0B8",
    opacity: 0.9,
    transparent: true,
    metalness: 0.6,
    roughness: 0.05,
  });

  // FRAME
  const floorCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  floorCh.position.set(W / 2, channel_h / 2, 0);
  group.add(floorCh);

  const ceilCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  ceilCh.position.set(W / 2, H - channel_h / 2, 0);
  group.add(ceilCh);

  const postL = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, channel_d), frameMat);
  postL.position.set(outer_w / 2, H / 2, 0);
  group.add(postL);

  const postR = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, channel_d), frameMat);
  postR.position.set(W - outer_w / 2, H / 2, 0);
  group.add(postR);

  const inner_w = W - 2 * outer_w;
  const panel_w = (inner_w - (n_panels - 1) * mullion_w) / n_panels;
  const glass_h = H - 2 * channel_h - panel_gap * 2;

  for (let i = 0; i < n_panels - 1; i++) {
    const mx = outer_w + (i + 1) * panel_w + i * mullion_w + mullion_w / 2;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(mullion_w, H - 2 * channel_h, mullion_d), frameMat);
    mullion.position.set(mx, H / 2, 0);
    group.add(mullion);
  }

  for (let i = 0; i < n_panels; i++) {
    const gx = outer_w + i * (panel_w + mullion_w) + panel_w / 2;
    const tint = tints[i % tints.length];
    
    const glassMat = new THREE.MeshStandardMaterial({
      color: tint.color,
      opacity: tint.opacity,
      transparent: true,
      metalness: tint.metalness,
      roughness: tint.roughness,
    });

    const glass = new THREE.Mesh(new THREE.BoxGeometry(panel_w - panel_gap * 2, glass_h, gt), glassMat);
    glass.position.set(gx, H / 2, 0);
    group.add(glass);

    // Edges
    const et = 0.003;
    const gw = panel_w - panel_gap * 2;
    
    // Top/Bottom edges
    const edgeT = new THREE.Mesh(new THREE.BoxGeometry(gw, et, gt + 0.002), edgeMat);
    edgeT.position.set(gx, H - channel_h - panel_gap - et / 2, 0);
    group.add(edgeT);

    const edgeB = new THREE.Mesh(new THREE.BoxGeometry(gw, et, gt + 0.002), edgeMat);
    edgeB.position.set(gx, channel_h + panel_gap + et / 2, 0);
    group.add(edgeB);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
