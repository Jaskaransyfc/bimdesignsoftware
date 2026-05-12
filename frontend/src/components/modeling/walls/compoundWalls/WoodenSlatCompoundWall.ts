import * as THREE from "three";

export const renderWoodenSlatCompoundWall = (
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
  const wall_t = 0.26;
  const panel_count = 6;
  const column_w = 0.42;
  const column_d = 0.32;
  const slat_w = 0.09;
  const slat_d = 0.042;
  const slat_gap = 0.038;
  const slat_bottom_gap = 0.12;
  const slat_top_gap = 0.18;
  const frame_beam_h = 0.18;
  const base_h = 0.22;

  const inner_len = wall_len - (panel_count + 1) * column_w;
  const panel_w = inner_len / panel_count;
  const slat_h = wall_h - slat_bottom_gap - slat_top_gap;

  const concreteStyle = new THREE.MeshStandardMaterial({ color: "#8D8A84", metalness: 0.02, roughness: 0.96 });
  const woodStyle = new THREE.MeshStandardMaterial({ color: "#8A5B34", metalness: 0.01, roughness: 0.82 });
  const beamStyle = new THREE.MeshStandardMaterial({ color: "#74706B", roughness: 0.94 });
  const baseStyle = new THREE.MeshStandardMaterial({ color: "#5D5954", roughness: 0.98 });

  // BASE PLINTH
  const base = new THREE.Mesh(new THREE.BoxGeometry(wall_len, base_h, wall_t + 0.06), baseStyle);
  base.position.set(wall_len / 2, base_h / 2, 0);
  group.add(base);

  // CONCRETE COLUMNS
  for (let i = 0; i < panel_count + 1; i++) {
    const x = i * (panel_w + column_w);
    const col = new THREE.Mesh(new THREE.BoxGeometry(column_w, wall_h, column_d), concreteStyle);
    col.position.set(x + column_w / 2, wall_h / 2, 0);
    group.add(col);
  }

  // TOP BEAM
  const top_beam = new THREE.Mesh(new THREE.BoxGeometry(wall_len, frame_beam_h, wall_t + 0.04), beamStyle);
  top_beam.position.set(wall_len / 2, wall_h - frame_beam_h / 2, 0);
  group.add(top_beam);

  // BOTTOM BEAM
  const bottom_beam = new THREE.Mesh(new THREE.BoxGeometry(wall_len, 0.12, wall_t + 0.04), beamStyle);
  bottom_beam.position.set(wall_len / 2, base_h + 0.06, 0);
  group.add(bottom_beam);

  // WOODEN SLATS
  let seed = 11;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < panel_count; i++) {
    const panel_x = column_w + i * (panel_w + column_w);
    const usable_w = panel_w - 0.08;
    const slat_count = Math.floor(usable_w / (slat_w + slat_gap));

    for (let s = 0; s < slat_count; s++) {
      const x = panel_x + 0.04 + s * (slat_w + slat_gap);
      const depth_shift = (random() - 0.5) * 0.02;

      const slat = new THREE.Mesh(new THREE.BoxGeometry(slat_w, slat_h, slat_d), woodStyle);
      slat.position.set(x + slat_w / 2, base_h + slat_bottom_gap + slat_h / 2, depth_shift);
      group.add(slat);
    }
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
