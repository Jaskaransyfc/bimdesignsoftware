import * as THREE from "three";

export const renderHorizontalMetalRailing = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number = 8.0,
  height: number = 1.1,
  rotation: number = 0
) => {
  const group = new THREE.Group();

  const frame_depth = 0.05;
  const post_w = 0.08;
  const rail_h = 0.035;
  const rail_gap = 0.09;
  const top_frame_h = 0.06;
  const bottom_frame_h = 0.04;
  const panel_count = 2;

  const metalMat = new THREE.MeshStandardMaterial({
    color: "#444444",
    metalness: 0.92,
    roughness: 0.25,
  });

  const createBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, metalMat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // 1. OUTER FRAME
  // Top rail
  createBox(length, top_frame_h, frame_depth, length / 2, height - top_frame_h / 2, 0);

  // Bottom rail
  createBox(length, bottom_frame_h, frame_depth, length / 2, bottom_frame_h / 2, 0);

  // Side posts
  createBox(post_w, height, frame_depth, post_w / 2, height / 2, 0);
  createBox(post_w, height, frame_depth, length - post_w / 2, height / 2, 0);

  // Center posts
  const panel_spacing = length / panel_count;
  for (let i = 1; i < panel_count; i++) {
    const x = i * panel_spacing;
    createBox(post_w, height, frame_depth, x, height / 2, 0);
  }

  // 2. HORIZONTAL BARS
  const usable_h = height - top_frame_h - bottom_frame_h;
  const n_rails = Math.floor(usable_h / (rail_h + rail_gap));
  const spacing = usable_h / (n_rails + 1);

  for (let i = 0; i < n_rails; i++) {
    const z_h = bottom_frame_h + spacing * (i + 1);

    // Left panel bar
    createBox(
      panel_spacing - post_w * 1.5,
      rail_h,
      frame_depth / 2,
      (post_w + panel_spacing - post_w / 2) / 2,
      z_h,
      0
    );

    // Right panel bar
    createBox(
      length - panel_spacing - post_w * 1.5,
      rail_h,
      frame_depth / 2,
      (panel_spacing + post_w / 2 + length - post_w) / 2,
      z_h,
      0
    );
  }

  // 3. BASE PLATES
  const foot_w = 0.12;
  const foot_d = 0.18;
  const foot_h = 0.025;

  const positions = [post_w / 2, length - post_w / 2];
  for (let i = 1; i < panel_count; i++) {
    positions.push(i * panel_spacing);
  }

  positions.forEach((px_pos) => {
    createBox(foot_w, foot_h, foot_d, px_pos, -foot_h / 2, 0);
  });

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
