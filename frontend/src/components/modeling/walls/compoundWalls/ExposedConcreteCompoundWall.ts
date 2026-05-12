import * as THREE from "three";

export const renderExposedConcreteCompoundWall = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  length: number,
  height: number,
  rotation: number,
  selected = false
) => {
  const group = new THREE.Group();

  const wall_len = length;
  const wall_h = height;
  const wall_t = 0.24;

  const column_w = 0.42;
  const column_d = 0.32;
  const panel_count = 6;
  const base_h = 0.18;
  const board_h = 0.18;
  const tie_r = 0.018;
  const tie_depth = 0.01;

  const inner_len = wall_len - column_w * (panel_count + 1);
  const panel_w = inner_len / panel_count;

  const concreteStyle = new THREE.MeshStandardMaterial({ color: "#8F8C87", metalness: 0.02, roughness: 0.96 });
  const panelStyle = new THREE.MeshStandardMaterial({ color: "#9A9792", metalness: 0.01, roughness: 0.98 });
  const grooveStyle = new THREE.MeshStandardMaterial({ color: "#6F6C68", roughness: 1.0 });
  const tieStyle = new THREE.MeshStandardMaterial({ color: "#5C5A57", metalness: 0.08, roughness: 0.88 });
  const capStyle = new THREE.MeshStandardMaterial({ color: "#7F7C78", roughness: 0.92 });

  // BASE PLINTH
  const base = new THREE.Mesh(new THREE.BoxGeometry(wall_len, base_h, wall_t + 0.04), concreteStyle);
  base.position.set(wall_len / 2, base_h / 2, 0);
  group.add(base);

  // COLUMNS
  for (let i = 0; i < panel_count + 1; i++) {
    const x = i * (panel_w + column_w);
    const col = new THREE.Mesh(new THREE.BoxGeometry(column_w, wall_h, column_d), concreteStyle);
    col.position.set(x + column_w / 2, wall_h / 2, 0);
    group.add(col);
  }

  // INFILL PANELS
  for (let i = 0; i < panel_count; i++) {
    const x = column_w + i * (panel_w + column_w);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panel_w, wall_h - 0.12, wall_t), panelStyle);
    panel.position.set(x + panel_w / 2, (wall_h - 0.12) / 2 + 0.08, 0);
    group.add(panel);

    // BOARD FORMED LINES
    const rows = Math.floor(wall_h / board_h);
    for (let r = 0; r < rows; r++) {
      const y = r * board_h;
      const groove = new THREE.Mesh(new THREE.BoxGeometry(panel_w, 0.008, 0.006), grooveStyle);
      groove.position.set(x + panel_w / 2, y, wall_t / 2);
      group.add(groove);
    }

    // TIE HOLES
    for (const ry of [0.7, 1.4, 2.1, 2.8]) {
      if (ry > wall_h) continue;
      for (const rx_ratio of [0.25, 0.5, 0.75]) {
        const tx = x + panel_w * rx_ratio;
        const tie = new THREE.Mesh(new THREE.CylinderGeometry(tie_r, tie_r, tie_depth, 14), tieStyle);
        tie.rotation.x = Math.PI / 2;
        tie.position.set(tx, ry, wall_t / 2 - tie_depth / 2);
        group.add(tie);
      }
    }
  }

  // WALL CAP
  const cap = new THREE.Mesh(new THREE.BoxGeometry(wall_len, 0.08, wall_t + 0.06), capStyle);
  cap.position.set(wall_len / 2, wall_h + 0.04, 0);
  group.add(cap);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
