import * as THREE from "three";

export const renderNaturalStoneCompoundWall = (
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
  const wall_t = 0.42;
  const base_h = 0.24;
  const stone_min_w = 0.22;
  const stone_max_w = 0.78;
  const stone_min_h = 0.12;
  const stone_max_h = 0.26;
  const joint_gap = 0.012;
  const coping_h = 0.12;
  const pillar_spacing = 4.5;
  const pillar_w = 0.52;

  const stoneStyle = new THREE.MeshStandardMaterial({ color: "#8A8176", metalness: 0.01, roughness: 1.0 });
  const pillarStyle = new THREE.MeshStandardMaterial({ color: "#6F665D", roughness: 0.98 });
  const copingStyle = new THREE.MeshStandardMaterial({ color: "#9A9186", roughness: 0.92 });
  const baseStyle = new THREE.MeshStandardMaterial({ color: "#5F5952", roughness: 1.0 });

  // BASE PLINTH
  const base = new THREE.Mesh(new THREE.BoxGeometry(wall_len, base_h, wall_t + 0.04), baseStyle);
  base.position.set(wall_len / 2, base_h / 2, 0);
  group.add(base);

  // STONE COURSES
  let y = base_h;
  const stoneGeometries: THREE.BoxGeometry[] = [];
  
  // Use a pseudo-random seed for consistency
  let seed = 21;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  while (y < wall_h - coping_h) {
    const row_h = stone_min_h + random() * (stone_max_h - stone_min_h);
    let x = -random() * 0.22;
    
    while (x < wall_len) {
      const stone_w = stone_min_w + random() * (stone_max_w - stone_min_w);
      const stone_depth = wall_t * (0.82 + random() * 0.18);
      const inset = random() * 0.035;
      
      const geo = new THREE.BoxGeometry(
        Math.min(stone_w - joint_gap, wall_len - x), 
        Math.min(row_h - joint_gap, wall_h - coping_h - y), 
        stone_depth
      );
      const mesh = new THREE.Mesh(geo, stoneStyle);
      mesh.position.set(x + stone_w / 2, y + row_h / 2, inset);
      group.add(mesh);
      
      x += stone_w;
    }
    y += row_h;
  }

  // STONE PILLARS
  const pillar_count = Math.floor(wall_len / pillar_spacing) + 1;
  for (let i = 0; i < pillar_count; i++) {
    const x = i * pillar_spacing;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillar_w, wall_h + 0.18, wall_t + 0.12), pillarStyle);
    pillar.position.set(x, (wall_h + 0.18) / 2, 0);
    group.add(pillar);
  }

  // COPING STONES
  const coping_w = 0.86;
  const coping_step = 0.9;
  const coping_count = Math.floor(wall_len / coping_step);
  for (let i = 0; i < coping_count; i++) {
    const x = i * coping_step;
    const coping = new THREE.Mesh(new THREE.BoxGeometry(coping_w, coping_h, wall_t + 0.08), copingStyle);
    coping.position.set(x + coping_w / 2, wall_h + coping_h / 2, 0);
    group.add(coping);
  }

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
