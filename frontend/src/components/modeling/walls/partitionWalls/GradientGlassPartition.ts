import * as THREE from "three";

export const renderGradientGlassPartition = (
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
  const outer_w = 0.048;
  const mullion_w = 0.025;
  const mullion_d = 0.075;
  const gt = 0.012;
  const n_panels = 5;
  const panel_gap = 0.004;
  const n_slices = 20;

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#1A1A1A",
    metalness: 0.85,
    roughness: 0.18,
  });

  const edgeMat = new THREE.MeshStandardMaterial({
    color: "#C8DCE0",
    opacity: 0.85,
    transparent: true,
    metalness: 0.5,
    roughness: 0.04,
  });

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
  const slice_h = glass_h / n_slices;

  for (let i = 0; i < n_panels - 1; i++) {
    const mx = outer_w + (i + 1) * panel_w + i * mullion_w + mullion_w / 2;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(mullion_w, H - 2 * channel_h, mullion_d), frameMat);
    mullion.position.set(mx, H / 2, 0);
    group.add(mullion);
  }

  const topColor = new THREE.Color("#D2E6EB");
  const botColor = new THREE.Color("#F0F2F4");

  for (let i = 0; i < n_panels; i++) {
    const gx = outer_w + i * (panel_w + mullion_w) + panel_w / 2;
    
    for (let si = 0; si < n_slices; si++) {
      const t = si / (n_slices - 1); // 0 at bottom, 1 at top
      const sy = channel_h + panel_gap + si * slice_h + slice_h / 2;
      
      const sliceColor = new THREE.Color().lerpColors(botColor, topColor, t);
      const opacity = 0.92 - (0.92 - 0.15) * t;
      const rough = 0.95 - (0.95 - 0.02) * t;
      
      const sliceMat = new THREE.MeshStandardMaterial({
        color: sliceColor,
        opacity: opacity,
        transparent: true,
        roughness: rough,
        metalness: 0.05 - 0.04 * t,
      });

      const slice = new THREE.Mesh(new THREE.BoxGeometry(panel_w - panel_gap * 2, slice_h + 0.0005, gt), sliceMat);
      slice.position.set(gx, sy, 0);
      group.add(slice);
    }
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
