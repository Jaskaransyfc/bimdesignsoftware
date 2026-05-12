import * as THREE from "three";

export const renderModernMetalRailing = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number = 8.0,
  height: number = 1.1,
  rotation: number = 0
) => {
  const group = new THREE.Group();

  const panel_count = 2;
  const frame_w = 0.06;
  const frame_d = 0.04;
  const bar_w = 0.025;
  const bar_gap = 0.11;
  const post_w = 0.08;
  const bottom_gap = 0.03;

  const metalMat = new THREE.MeshStandardMaterial({
    color: "#4A4A4A",
    metalness: 0.92,
    roughness: 0.28,
  });

  // Helper to create boxes
  const createBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, metalMat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // 1. MAIN FRAME
  // Top rail
  createBox(length, frame_w, frame_d, length / 2, height - frame_w / 2, 0);

  // Bottom rail
  createBox(length, frame_w, frame_d, length / 2, frame_w / 2, 0);

  // End posts
  createBox(post_w, height, frame_d, post_w / 2, height / 2, 0);
  createBox(post_w, height, frame_d, length - post_w / 2, height / 2, 0);

  // Center posts
  const panel_spacing = length / panel_count;
  for (let i = 1; i < panel_count; i++) {
    const x = i * panel_spacing;
    createBox(post_w, height, frame_d, x, height / 2, 0);
  }

  // 2. VERTICAL BARS
  const usable_width = length - post_w * 2;
  const n_bars = Math.floor(usable_width / (bar_w + bar_gap));
  const spacing = usable_width / (n_bars + 1);

  for (let i = 0; i < n_bars; i++) {
    const x = post_w + spacing * (i + 1);

    // Skip bars near center posts
    let skip = false;
    for (let j = 1; j < panel_count; j++) {
      const cx = j * panel_spacing;
      if (Math.abs(x - cx) < post_w * 0.9) {
        skip = true;
      }
    }

    if (!skip) {
      createBox(
        bar_w,
        height - frame_w * 2 - bottom_gap,
        frame_d / 2,
        x,
        (height - frame_w * 2 - bottom_gap) / 2 + frame_w + bottom_gap,
        0
      );
    }
  }

  // 3. BASE FEET
  const foot_depth = 0.18;
  const foot_w = 0.10;
  const foot_h = 0.025;

  const post_positions = [post_w / 2, length - post_w / 2];
  for (let i = 1; i < panel_count; i++) {
    post_positions.push(i * panel_spacing);
  }

  post_positions.forEach((px_pos) => {
    createBox(foot_w, foot_h, foot_depth, px_pos, -foot_h / 2, 0);
  });

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
