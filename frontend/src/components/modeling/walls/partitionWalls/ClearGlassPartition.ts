import * as THREE from "three";

export const renderClearGlassPartition = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number,
  height: number,
  rotation: number,
  selected = false
) => {
  const group = new THREE.Group();
  
  // --- Parameters (converted to world units, assuming 1 unit = 1 meter) ---
  // The user's code is in mm, so we divide by 1000 if needed, 
  // but the BIM system seems to use 1 unit = 1 meter (PLAN_SCALE = 50, MM_SCALE = 500 etc)
  // Let's use the provided logic but scale to match the system.
  // Standard scale in this project: 1.0 in three.js = 1.0 meter.
  
  const W = length;
  const H = height;
  const D = 0.08; // 80mm
  const channel_h = 0.06; // 60mm
  const channel_d = 0.07; // 70mm
  const mullion_w = 0.025; // 25mm
  const mullion_d = 0.07; // 70mm
  const gt = 0.012; // 12mm
  const panel_gap = 0.004; // 4mm
  
  const z_mullion = 0; // centered
  const z_channel = 0;
  const z_glass = 0;

  const channelMat = new THREE.MeshStandardMaterial({
    color: "#D0D0D0",
    metalness: 0.8,
    roughness: 0.2,
  });

  const mullionMat = new THREE.MeshStandardMaterial({
    color: "#C8C8C8",
    metalness: 0.82,
    roughness: 0.18,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#E0F4F8",
    transmission: 0.95,
    opacity: 0.15,
    transparent: true,
    metalness: 0.02,
    roughness: 0.01,
    thickness: gt,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: "#E0E0E0",
    metalness: 0.7,
    roughness: 0.25,
  });

  // FLOOR CHANNEL
  const floorChannel = new THREE.Mesh(
    new THREE.BoxGeometry(W, channel_h, channel_d),
    channelMat
  );
  floorChannel.position.set(W / 2, channel_h / 2, 0);
  group.add(floorChannel);

  // CEILING CHANNEL
  const ceilChannel = new THREE.Mesh(
    new THREE.BoxGeometry(W, channel_h, channel_d),
    channelMat
  );
  ceilChannel.position.set(W / 2, H - channel_h / 2, 0);
  group.add(ceilChannel);

  // TOP TRIM
  const topTrim = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.012, channel_d + 0.01),
    trimMat
  );
  topTrim.position.set(W / 2, H - channel_h - 0.006, 0);
  group.add(topTrim);

  // BOTTOM TRIM
  const botTrim = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.012, channel_d + 0.01),
    trimMat
  );
  botTrim.position.set(W / 2, channel_h + 0.006, 0);
  group.add(botTrim);

  // Panels layout
  const n_panels = 5;
  const panel_w = (W - (n_panels + 1) * mullion_w) / n_panels;
  const glass_h = H - 2 * channel_h - panel_gap * 2;

  for (let i = 0; i <= n_panels; i++) {
    const mx = i * (panel_w + mullion_w) + mullion_w / 2;
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(mullion_w, H - 2 * channel_h, mullion_d),
      mullionMat
    );
    mullion.position.set(mx, H / 2, 0);
    group.add(mullion);
  }

  for (let i = 0; i < n_panels; i++) {
    const gx = mullion_w + i * (panel_w + mullion_w) + panel_w / 2;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(panel_w - panel_gap * 2, glass_h, gt),
      glassMat
    );
    glass.position.set(gx, H / 2, 0);
    group.add(glass);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
