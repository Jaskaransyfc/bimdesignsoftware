import * as THREE from "three";
import { Wall } from "@/types/modeling";

const PLAN_SCALE = 10;

const createCuboid = (
  dim: [number, number, number],
  corner: [number, number, number],
  material: THREE.Material
) => {
  const geom = new THREE.BoxGeometry(dim[0], dim[1], dim[2]);
  geom.translate(dim[0] / 2, dim[1] / 2, dim[2] / 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(corner[0], corner[1], corner[2]);
  return mesh;
};

export const renderPartitionWall = (
  scene: THREE.Scene,
  wall: Wall,
  dx: number,
  dy: number,
  length: number,
  thickness: number,
  height: number,
  openings: any[],
  isSelected: boolean
) => {
  const wallGroup = new THREE.Group();
  const materialType = wall.material;

  // Adapt parameters from user scripts
  const W = length;
  const H = height;
  const D = thickness;

  let mainMat: THREE.Material | null = null;

  if (materialType === "Clear Glass Partition") {
    mainMat = renderClearGlassPartition(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Frosted Glass Partition") {
    mainMat = renderFrostedGlassPartition(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Etched Pattern Glass") {
    mainMat = renderEtchedPatternGlass(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Gradient Frosted Glass") {
    mainMat = renderGradientFrostedGlass(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Cracked Ice Glass") {
    mainMat = renderCrackedIceGlass(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Digital Printed Glass") {
    mainMat = renderDigitalPrintedGlass(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Natural Oak Slats") {
    mainMat = renderOakSlatsPartition(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Walnut Wood Slats") {
    mainMat = renderWalnutSlatsPartition(wallGroup, W, H, D, openings, isSelected);
  } else if (materialType === "Charred Wood") {
    mainMat = renderCharredWoodPartition(wallGroup, W, H, D, openings, isSelected);
  } else {
    return new THREE.MeshStandardMaterial({ color: "#ffffff" });
  }

  const angle = Math.atan2(dy, dx);
  wallGroup.rotation.y = -angle;
  wallGroup.position.set(
    wall.startPoint.x / PLAN_SCALE,
    0,
    wall.startPoint.y / PLAN_SCALE
  );

  scene.add(wallGroup);
  return mainMat || new THREE.MeshStandardMaterial({ color: "#ffffff" });
};

// --- CLEAR GLASS PARTITION ---
const renderClearGlassPartition = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.06 * PLAN_SCALE; // 60mm
  const channel_d = 0.07 * PLAN_SCALE;
  const mullion_w = 0.025 * PLAN_SCALE;
  const mullion_d = 0.07 * PLAN_SCALE;
  const gt = 0.012 * PLAN_SCALE;
  const panel_gap = 0.004 * PLAN_SCALE;

  const channelMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#D0D0D0",
    metalness: 0.8,
    roughness: 0.2,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#E0F4F8",
    opacity: 0.15,
    transparent: true,
    metalness: 0.02,
    roughness: 0.01,
  });

  const z_channel = (D - channel_d) / 2;
  const z_mullion = (D - mullion_d) / 2;
  const z_glass = (D - gt) / 2;

  // Channels
  group.add(createCuboid([W, channel_h, channel_d], [0, 0, z_channel], channelMat));
  group.add(createCuboid([W, channel_h, channel_d], [0, H - channel_h, z_channel], channelMat));

  // Determine panels based on openings
  // For simplicity, we create mullions at regular intervals and around openings
  const panelWidth = 1.0 * PLAN_SCALE; // 1m panels
  const n_panels = Math.floor(W / panelWidth);
  
  for (let i = 0; i <= n_panels; i++) {
    const mx = Math.min(i * panelWidth, W - mullion_w);
    
    // Check if mullion is inside an opening (skip if it's a full-height door opening)
    let inFullOpening = false;
    for(const op of openings) {
      if (mx >= op.minX && mx <= op.maxX && op.sillHeight === 0 && op.height >= H - channel_h) {
        inFullOpening = true;
        break;
      }
    }
    
    if (!inFullOpening) {
       group.add(createCuboid([mullion_w, H - 2 * channel_h, mullion_d], [mx, channel_h, z_mullion], channelMat));
    }
  }

  // Glass panels
  for (let i = 0; i < n_panels; i++) {
    const gx = i * panelWidth + mullion_w + panel_gap;
    const gw = Math.min(panelWidth - mullion_w - panel_gap * 2, W - gx - panel_gap);
    if (gw <= 0) continue;

    // Opening logic for glass
    let currentX = gx;
    const panelEndX = gx + gw;
    
    // We can simplify by just rendering glass where there's no opening
    // Or just render a single slab with holes (but user code used multiple panels)
    group.add(createCuboid([gw, H - 2 * channel_h - panel_gap * 2, gt], [gx, channel_h + panel_gap, z_glass], glassMat));
  }
  return channelMat;
};

// --- FROSTED GLASS PARTITION ---
const renderFrostedGlassPartition = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.05 * PLAN_SCALE;
  const channel_d = 0.075 * PLAN_SCALE;
  const mullion_w = 0.02 * PLAN_SCALE;
  const mullion_d = 0.07 * PLAN_SCALE;
  const gt = 0.012 * PLAN_SCALE;
  const panel_gap = 0.003 * PLAN_SCALE;

  const channelMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : "#A8AEB2",
    metalness: 0.82,
    roughness: 0.22,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#DDE4E8",
    opacity: 0.82,
    transparent: true,
    metalness: 0.02,
    roughness: 0.88,
  });

  const z_channel = (D - channel_d) / 2;
  const z_mullion = (D - mullion_d) / 2;
  const z_glass = (D - gt) / 2;

  group.add(createCuboid([W, channel_h, channel_d], [0, 0, z_channel], channelMat));
  group.add(createCuboid([W, channel_h, channel_d], [0, H - channel_h, z_channel], channelMat));

  const n_panels = 5;
  const panel_w = (W - (n_panels - 1) * mullion_w) / n_panels;

  for (let i = 0; i < n_panels; i++) {
    const gx = i * (panel_w + mullion_w) + panel_gap;
    const gw = panel_w - panel_gap * 2;
    group.add(createCuboid([gw, H - 2 * channel_h - panel_gap * 2, gt], [gx, channel_h + panel_gap, z_glass], glassMat));
    
    if (i < n_panels - 1) {
      const mx = (i + 1) * panel_w + i * mullion_w;
      group.add(createCuboid([mullion_w, H - 2 * channel_h, mullion_d], [mx, channel_h, z_mullion], channelMat));
    }
  }
  return channelMat;
};

// --- ETCHED PATTERN GLASS ---
const renderEtchedPatternGlass = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.055 * PLAN_SCALE;
  const channel_d = 0.08 * PLAN_SCALE;
  const gt = 0.014 * PLAN_SCALE;
  const flute_w = 0.012 * PLAN_SCALE;
  const valley_w = 0.006 * PLAN_SCALE;
  const flute_raise = 0.008 * PLAN_SCALE;
  const pitch = flute_w + valley_w;

  const frameMat = new THREE.MeshStandardMaterial({ color: "#1A1614", metalness: 0.72, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#C8D8D4", opacity: 0.55, transparent: true, metalness: 0.1, roughness: 0.55 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: "#D4E0DC", opacity: 0.65, transparent: true, metalness: 0.12, roughness: 0.4 });

  const z_glass = (D - gt) / 2;
  
  group.add(createCuboid([W, channel_h, channel_d], [0, 0, (D - channel_d) / 2], frameMat));
  group.add(createCuboid([W, channel_h, channel_d], [0, H - channel_h, (D - channel_d) / 2], frameMat));
  
  // Single glass slab for simplicity
  group.add(createCuboid([W, H - 2 * channel_h, gt], [0, channel_h, z_glass], glassMat));

  // Flutes (ridges)
  const n_ridges = Math.floor(W / pitch);
  for (let i = 0; i < n_ridges; i++) {
    const rx = i * pitch;
    group.add(createCuboid([flute_w, H - 2 * channel_h, flute_raise], [rx, channel_h, z_glass + gt / 2], ridgeMat));
  }
  return frameMat;
};

// --- GRADIENT FROSTED GLASS ---
const renderGradientFrostedGlass = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.055 * PLAN_SCALE;
  const n_slices = 10;
  const slice_h = (H - 2 * channel_h) / n_slices;
  const gt = 0.012 * PLAN_SCALE;
  const z_glass = (D - gt) / 2;

  const frameMat = new THREE.MeshStandardMaterial({ color: "#1A1A1A", metalness: 0.85, roughness: 0.18 });

  group.add(createCuboid([W, channel_h, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, channel_h, D], [0, H - channel_h, 0], frameMat));

  for (let si = 0; si < n_slices; si++) {
    const t = si / (n_slices - 1); // 0 at bottom, 1 at top
    const opacity = 0.92 - t * (0.92 - 0.15);
    const roughness = 0.95 - t * (0.95 - 0.02);
    
    const sliceMat = new THREE.MeshStandardMaterial({
      color: "#DDE4E8",
      opacity: opacity,
      transparent: true,
      roughness: roughness,
      metalness: 0.02,
    });
    
    group.add(createCuboid([W, slice_h, gt], [0, channel_h + si * slice_h, z_glass], sliceMat));
  }
  return frameMat;
};

// --- CRACKED ICE GLASS ---
const renderCrackedIceGlass = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.055 * PLAN_SCALE;
  const gt = 0.016 * PLAN_SCALE;
  const z_glass = (D - gt) / 2;

  const frameMat = new THREE.MeshStandardMaterial({ color: "#1A1A1A", metalness: 0.85, roughness: 0.18 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#DDEEF5", opacity: 0.28, transparent: true, metalness: 0.08, roughness: 0.04 });
  const crackMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", opacity: 0.9, transparent: true, roughness: 0.02 });

  group.add(createCuboid([W, channel_h, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, channel_h, D], [0, H - channel_h, 0], frameMat));
  group.add(createCuboid([W, H - 2 * channel_h, gt], [0, channel_h, z_glass], glassMat));

  // Add some random "cracks"
  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * W;
    const cy = channel_h + Math.random() * (H - 2 * channel_h);
    const cw = (Math.random() * 0.2 + 0.1) * PLAN_SCALE;
    const ch = 0.002 * PLAN_SCALE;
    group.add(createCuboid([cw, ch, 0.002 * PLAN_SCALE], [cx, cy, z_glass + gt / 2], crackMat));
    group.add(createCuboid([ch, cw, 0.002 * PLAN_SCALE], [cx, cy, z_glass + gt / 2], crackMat));
  }
  return frameMat;
};

// --- DIGITAL PRINTED GLASS ---
const renderDigitalPrintedGlass = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const channel_h = 0.052 * PLAN_SCALE;
  const gt = 0.012 * PLAN_SCALE;
  const z_glass = (D - gt) / 2;

  const frameMat = new THREE.MeshStandardMaterial({ color: "#D8D8D8", metalness: 0.8, roughness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#F0F4F6", opacity: 0.25, transparent: true, metalness: 0.05, roughness: 0.02 });

  group.add(createCuboid([W, channel_h, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, channel_h, D], [0, H - channel_h, 0], frameMat));
  group.add(createCuboid([W, H - 2 * channel_h, gt], [0, channel_h, z_glass], glassMat));

  const colors = ["#E63946", "#2A9D8F", "#E9C46A", "#6A4C93", "#F4A261"];
  // Random geometric print
  for (let i = 0; i < 30; i++) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color: col, opacity: 0.9, transparent: true });
    const pw = (Math.random() * 0.1 + 0.05) * PLAN_SCALE;
    const ph = (Math.random() * 0.1 + 0.05) * PLAN_SCALE;
    group.add(createCuboid([pw, ph, 0.002 * PLAN_SCALE], [Math.random() * (W - pw), channel_h + Math.random() * (H - 2 * channel_h - ph), z_glass + gt / 2 + 0.001 * PLAN_SCALE], mat));
  }
  return frameMat;
};

// --- OAK SLATS PARTITION ---
const renderOakSlatsPartition = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const frame_w = 0.055 * PLAN_SCALE;
  const slat_w = 0.042 * PLAN_SCALE;
  const slat_d = 0.032 * PLAN_SCALE;
  const slat_gap = 0.038 * PLAN_SCALE;
  const n_slats = Math.floor((W - 2 * frame_w) / (slat_w + slat_gap));

  const frameMat = new THREE.MeshStandardMaterial({ color: "#1C1C1C", metalness: 0.85, roughness: 0.24 });
  const oakMat = new THREE.MeshStandardMaterial({ color: "#C89258", roughness: 0.72 });

  group.add(createCuboid([frame_w, H, D], [0, 0, 0], frameMat));
  group.add(createCuboid([frame_w, H, D], [W - frame_w, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, H - frame_w, 0], frameMat));

  for (let i = 0; i < n_slats; i++) {
    const x = frame_w + i * (slat_w + slat_gap);
    group.add(createCuboid([slat_w, H - 2 * frame_w, slat_d], [x, frame_w, (D - slat_d) / 2], oakMat));
  }
  return frameMat;
};

// --- WALNUT SLATS PARTITION ---
const renderWalnutSlatsPartition = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const frame_w = 0.055 * PLAN_SCALE;
  const slat_w = 0.044 * PLAN_SCALE;
  const slat_d = 0.034 * PLAN_SCALE;
  const slat_gap = 0.034 * PLAN_SCALE;
  const n_slats = Math.floor((W - 2 * frame_w) / (slat_w + slat_gap));

  const frameMat = new THREE.MeshStandardMaterial({ color: "#161616", metalness: 0.88, roughness: 0.2 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: "#5B3924", roughness: 0.78 });

  group.add(createCuboid([frame_w, H, D], [0, 0, 0], frameMat));
  group.add(createCuboid([frame_w, H, D], [W - frame_w, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, H - frame_w, 0], frameMat));

  for (let i = 0; i < n_slats; i++) {
    const x = frame_w + i * (slat_w + slat_gap);
    group.add(createCuboid([slat_w, H - 2 * frame_w, slat_d], [x, frame_w, (D - slat_d) / 2], walnutMat));
  }
  return frameMat;
};

// --- CHARRED WOOD PARTITION ---
const renderCharredWoodPartition = (
  group: THREE.Group,
  W: number,
  H: number,
  D: number,
  openings: any[],
  isSelected: boolean
) => {
  const frame_w = 0.06 * PLAN_SCALE;
  const slat_w = 0.048 * PLAN_SCALE;
  const slat_d = 0.036 * PLAN_SCALE;
  const n_slats = Math.floor((W - 2 * frame_w) / slat_w);

  const frameMat = new THREE.MeshStandardMaterial({ color: "#111111", metalness: 0.9, roughness: 0.22 });
  const charredMat = new THREE.MeshStandardMaterial({ color: "#191919", roughness: 0.98 });

  group.add(createCuboid([frame_w, H, D], [0, 0, 0], frameMat));
  group.add(createCuboid([frame_w, H, D], [W - frame_w, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, 0, 0], frameMat));
  group.add(createCuboid([W, frame_w, D], [0, H - frame_w, 0], frameMat));

  for (let i = 0; i < n_slats; i++) {
    const x = frame_w + i * slat_w;
    group.add(createCuboid([slat_w, H - 2 * frame_w, slat_d], [x, frame_w, (D - slat_d) / 2], charredMat));
  }
  return frameMat;
};
