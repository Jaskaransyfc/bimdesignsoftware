import * as THREE from "three";

export const renderRibbedGlassPartition = (
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
  const D = 0.09;
  const channel_h = 0.055;
  const channel_d = 0.08;
  const outer_w = 0.045;
  const mullion_w = 0.025;
  const mullion_d = 0.075;
  const gt = 0.014;
  const n_panels = 5;
  const panel_gap = 0.003;

  const flute_w = 0.012;
  const valley_w = 0.006;
  const flute_raise = 0.008;
  const pitch = flute_w + valley_w;

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#1A1614",
    metalness: 0.72,
    roughness: 0.3,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#C8D8D4",
    opacity: 0.55,
    transparent: true,
    metalness: 0.1,
    roughness: 0.55,
  });

  const ridgeMat = new THREE.MeshStandardMaterial({
    color: "#D4E0DC",
    opacity: 0.65,
    transparent: true,
    metalness: 0.12,
    roughness: 0.4,
  });

  const ledMat = new THREE.MeshStandardMaterial({
    color: "#FFF4C2",
    metalness: 0,
    roughness: 1.0,
    emissive: "#FFF4C2",
    emissiveIntensity: 0.5,
  });

  // FRAME
  const floorCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  floorCh.position.set(W / 2, channel_h / 2, 0);
  group.add(floorCh);

  const ceilCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  ceilCh.position.set(W / 2, H - channel_h / 2, 0);
  group.add(ceilCh);

  const postL = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, 0.08), frameMat);
  postL.position.set(outer_w / 2, H / 2, 0);
  group.add(postL);

  const postR = new THREE.Mesh(new THREE.BoxGeometry(outer_w, H, 0.08), frameMat);
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
    const gy = H / 2;
    
    // Base glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(panel_w - panel_gap * 2, glass_h, gt), glassMat);
    glass.position.set(gx, gy, 0);
    group.add(glass);

    // Ribs/Ridges
    const gw = panel_w - panel_gap * 2;
    const n_fit = Math.floor(gw / pitch);
    const x_off = (gw - n_fit * pitch) / 2;
    
    for (let fi = 0; fi < n_fit; fi++) {
      const rx = gx - gw / 2 + x_off + fi * pitch + flute_w / 2;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(flute_w, glass_h, flute_raise), ridgeMat);
      ridge.position.set(rx, gy, gt / 2 + flute_raise / 2);
      group.add(ridge);
    }

    // LED base
    const led = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.01, 0.016, 0.025), ledMat);
    led.position.set(gx, channel_h + 0.008, 0);
    group.add(led);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
