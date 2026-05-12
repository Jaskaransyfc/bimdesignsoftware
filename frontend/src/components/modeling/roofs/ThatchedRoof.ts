import * as THREE from "three";

export const renderThatchedRoof = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  width: number,
  depth: number,
  rotation: number,
  selected = false
) => {
  const group = new THREE.Group();
  
  const RW = width;
  const RD = depth;
  const pitch_h = 2.8;
  const overhang = 0.7;
  const thatch_t = 0.18;
  const n_layers = 16;
  const ridge_w = 0.35;
  const ridge_h = 0.28;

  const thatchStyle = new THREE.MeshStandardMaterial({ color: "#C8A030", metalness: 0.02, roughness: 0.98 });
  const ridgeStyle = new THREE.MeshStandardMaterial({ color: "#8A6820", metalness: 0.03, roughness: 0.97 });
  const fringeStyle = new THREE.MeshStandardMaterial({ color: "#B89028", metalness: 0.02, roughness: 0.99 });

  const rl = RW + 2 * overhang;
  const ry_ridge = 0;
  const ry_eave_f = -RD / 2 - overhang;
  const ry_eave_b = RD / 2 + overhang;
  const rz_ridge = pitch_h;
  const rz_eave = 0;

  // THATCH LAYERS
  const makeThatchLayers = (yEave: number, yRidge: number, zEave: number, zRidge: number) => {
    const run = Math.abs(yRidge - yEave);
    const rise = Math.abs(zRidge - zEave);
    const sign = yRidge > yEave ? 1 : -1;

    for (let i = 0; i < n_layers; i++) {
      const t0 = i / n_layers;
      const t1 = (i + 1) / n_layers;
      const tc = (t0 + t1) / 2;

      const ly = yEave + sign * tc * run;
      const lz = zEave + tc * rise;
      const lt = thatch_t * (1.8 - 0.9 * tc);
      const taper = tc * overhang * 0.3;
      const lw = rl - 2 * taper;

      const layer = new THREE.Mesh(new THREE.BoxGeometry(lw, run / n_layers + 0.005, lt), thatchStyle);
      layer.position.set(0, lz, ly);
      layer.rotation.x = -Math.atan2(rise, run * sign);
      group.add(layer);
    }
  };

  makeThatchLayers(ry_eave_f, ry_ridge, rz_eave, rz_ridge);
  makeThatchLayers(ry_eave_b, ry_ridge, rz_eave, rz_ridge);

  // FRINGE
  const fringe_rows = 4;
  for (let i = 0; i < fringe_rows; i++) {
    const tf = i / fringe_rows;
    const droop = 0.06 + tf * 0.12;
    const fw = rl - i * 0.04;
    
    // Front fringe
    const fyf = ry_eave_f - 0.2 - i * thatch_t * 0.4;
    const fringeF = new THREE.Mesh(new THREE.BoxGeometry(fw, thatch_t * 0.8, 0.22), fringeStyle);
    fringeF.position.set(0, rz_eave - droop, fyf);
    group.add(fringeF);
    
    // Back fringe
    const fyb = ry_eave_b + 0.2 + i * thatch_t * 0.4;
    const fringeB = new THREE.Mesh(new THREE.BoxGeometry(fw, thatch_t * 0.8, 0.22), fringeStyle);
    fringeB.position.set(0, rz_eave - droop, fyb);
    group.add(fringeB);
  }

  // RIDGE
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(rl, ridge_h, ridge_w), ridgeStyle);
  ridge.position.set(0, rz_ridge, 0);
  group.add(ridge);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
