import * as THREE from "three";

export const renderSoftRoundedFlatRoof = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  width: number,
  depth: number,
  height: number,
  rotation: number,
  selected = false
) => {
  const group = new THREE.Group();
  
  // Convert mm to world units (approximate)
  const roof_w = width;
  const roof_d = depth;
  const roof_h = height || 0.26; // 260mm

  const round_steps = 7;
  const step_size = 0.045; // 45mm

  const roofStyle = new THREE.MeshStandardMaterial({
    color: "#D8D6D2",
    metalness: 0.06,
    roughness: 0.84,
  });

  // MAIN CORE
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(roof_w, roof_h, roof_d),
    roofStyle
  );
  core.position.set(0, roof_h / 2, 0);
  group.add(core);

  // SOFT EDGE LAYERS
  for (let i = 0; i < round_steps; i++) {
    const inset = (i + 1) * step_size;
    const layer_h = roof_h * 0.1;
    const y = -((i + 1) * layer_h);

    const layer = new THREE.Mesh(
      new THREE.BoxGeometry(roof_w - inset * 2, layer_h, roof_d - inset * 2),
      roofStyle
    );
    layer.position.set(0, y + layer_h / 2, 0);
    group.add(layer);
  }

  // TOP CAP
  const top_cap = new THREE.Mesh(
    new THREE.BoxGeometry(roof_w - 0.12, 0.04, roof_d - 0.12),
    roofStyle
  );
  top_cap.position.set(0, roof_h + 0.02, 0);
  group.add(top_cap);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
