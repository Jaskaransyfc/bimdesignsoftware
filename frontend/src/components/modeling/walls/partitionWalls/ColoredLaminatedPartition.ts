import * as THREE from "three";

export const renderColoredLaminatedPartition = (
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
  const D = 0.088;
  const channel_h = 0.052;
  const channel_d = 0.08;
  const outer_w = 0.048;
  const mullion_w = 0.024;
  const mullion_d = 0.075;
  const gt = 0.016;
  const interlayer_t = 0.004;
  const n_panels = 6;
  const panel_gap = 0.004;

  const laminates = [
    { name: "cobalt", color: "#1A4A8A", opacity: 0.72, metalness: 0.12, roughness: 0.06 },
    { name: "emerald", color: "#1A6B45", opacity: 0.7, metalness: 0.1, roughness: 0.05 },
    { name: "amber", color: "#C47A10", opacity: 0.68, metalness: 0.14, roughness: 0.06 },
    { name: "ruby", color: "#8A1A2A", opacity: 0.74, metalness: 0.12, roughness: 0.05 },
    { name: "violet", color: "#4A1A7A", opacity: 0.7, metalness: 0.11, roughness: 0.06 },
    { name: "teal", color: "#0E5A62", opacity: 0.68, metalness: 0.13, roughness: 0.05 },
  ];

  const frameMat = new THREE.MeshStandardMaterial({
    color: "#E8E8E8",
    metalness: 0.75,
    roughness: 0.22,
  });

  const floorCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  floorCh.position.set(W / 2, channel_h / 2, 0);
  group.add(floorCh);

  const ceilCh = new THREE.Mesh(new THREE.BoxGeometry(W, channel_h, channel_d), frameMat);
  ceilCh.position.set(W / 2, H - channel_h / 2, 0);
  group.add(ceilCh);

  const inner_w = W - 2 * outer_w;
  const panel_w = (inner_w - (n_panels - 1) * mullion_w) / n_panels;
  const glass_h = H - 2 * channel_h - panel_gap * 2;

  for (let i = 0; i < n_panels; i++) {
    const gx = outer_w + i * (panel_w + mullion_w) + panel_w / 2;
    const lam = laminates[i % laminates.length];
    
    const glassMat = new THREE.MeshStandardMaterial({
      color: lam.color,
      opacity: lam.opacity,
      transparent: true,
      metalness: lam.metalness,
      roughness: lam.roughness,
    });

    const glass = new THREE.Mesh(new THREE.BoxGeometry(panel_w - panel_gap * 2, glass_h, gt), glassMat);
    glass.position.set(gx, H / 2, 0);
    group.add(glass);

    // Glow at base
    const glowMat = new THREE.MeshStandardMaterial({
      color: lam.color,
      emissive: lam.color,
      emissiveIntensity: 0.4,
    });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(panel_w - 0.04, 0.014, 0.022), glowMat);
    glow.position.set(gx, channel_h + 0.007, 0);
    group.add(glow);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
