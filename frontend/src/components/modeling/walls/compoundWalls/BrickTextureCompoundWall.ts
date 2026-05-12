import * as THREE from "three";

export const renderBrickTextureCompoundWall = (
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
  const wall_t = 0.28;
  const brick_w = 0.23;
  const brick_h = 0.075;
  const brick_d = 0.11;
  const mortar = 0.01;
  const base_h = 0.22;
  const panel_count = 5;
  const column_w = 0.42;
  const column_d = 0.32;
  const band_h = 0.14;
  const coping_h = 0.12;

  const usable_h = wall_h - base_h - coping_h;
  const rows = Math.floor(usable_h / (brick_h + mortar));
  const panel_w = (wall_len - column_w * (panel_count + 1)) / panel_count;

  const brickStyle = new THREE.MeshStandardMaterial({ color: "#8E4F39", metalness: 0.01, roughness: 0.96 });
  const concreteStyle = new THREE.MeshStandardMaterial({ color: "#87837D", roughness: 0.94 });
  const bandStyle = new THREE.MeshStandardMaterial({ color: "#6E6A65", roughness: 0.92 });
  const copingStyle = new THREE.MeshStandardMaterial({ color: "#79746F", roughness: 0.90 });
  const baseStyle = new THREE.MeshStandardMaterial({ color: "#5B5752", roughness: 0.98 });

  // BASE PLINTH
  const base = new THREE.Mesh(new THREE.BoxGeometry(wall_len, base_h, wall_t + 0.04), baseStyle);
  base.position.set(wall_len / 2, base_h / 2, 0);
  group.add(base);

  // CONCRETE COLUMNS
  for (let i = 0; i < panel_count + 1; i++) {
    const x = i * (panel_w + column_w);
    const col = new THREE.Mesh(new THREE.BoxGeometry(column_w, wall_h, column_d), concreteStyle);
    col.position.set(x + column_w / 2, wall_h / 2, 0);
    group.add(col);
  }

  // BRICK PANELS (Using InstancedMesh for performance)
  const bricksPerPanel = rows * (Math.floor(panel_w / (brick_w + mortar)) + 2);
  const totalBricks = bricksPerPanel * panel_count;
  const brickGeo = new THREE.BoxGeometry(brick_w, brick_h, brick_d);
  const instancedBricks = new THREE.InstancedMesh(brickGeo, brickStyle, totalBricks);
  
  let brickIdx = 0;
  const dummy = new THREE.Object3D();
  let seed = 8;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (let p = 0; p < panel_count; p++) {
    const px_base = column_w + p * (panel_w + column_w);
    const cols = Math.floor(panel_w / (brick_w + mortar)) + 2;

    for (let r = 0; r < rows; r++) {
      const y = base_h + r * (brick_h + mortar);
      const offset = (r % 2 === 1) ? (brick_w * 0.5) : 0;

      for (let c = 0; c < cols; c++) {
        const x = px_base + c * (brick_w + mortar) - offset;
        if (x < px_base || x + brick_w > px_base + panel_w) continue;

        const depth_shift = (random() - 0.5) * 0.008;
        const height_shift = (random() - 0.5) * 0.003;

        dummy.position.set(x + brick_w / 2, y + height_shift + brick_h / 2, depth_shift);
        dummy.updateMatrix();
        instancedBricks.setMatrixAt(brickIdx++, dummy.matrix);
      }
    }
  }
  instancedBricks.count = brickIdx;
  group.add(instancedBricks);

  // HORIZONTAL CONCRETE BANDS
  for (const by of [base_h + 0.9, base_h + 1.9]) {
    if (by > wall_h - coping_h) continue;
    const band = new THREE.Mesh(new THREE.BoxGeometry(wall_len, band_h, wall_t + 0.04), bandStyle);
    band.position.set(wall_len / 2, by + band_h / 2, 0);
    group.add(band);
  }

  // TOP COPING
  const coping = new THREE.Mesh(new THREE.BoxGeometry(wall_len, coping_h, wall_t + 0.06), copingStyle);
  coping.position.set(wall_len / 2, wall_h - coping_h / 2, 0);
  group.add(coping);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
