import * as THREE from "three";

export const renderSymmetricGableRoof = (
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
  const slope_run = RD / 2;
  const pitch_h = 2.2;
  const overhang = 0.4;
  const tile_rows = 16;
  const batten_h = 0.035;
  const batten_t = 0.028;
  const fascia_h = 0.16;
  const fascia_t = 0.038;
  const gutter_w = 0.12;
  const gutter_h = 0.08;
  const ridge_h = 0.14;
  const ridge_w = 0.2;
  const deck_t = 0.08;

  const deckStyle = new THREE.MeshStandardMaterial({ color: "#8A3510", metalness: 0.06, roughness: 0.90 });
  const battenStyle = new THREE.MeshStandardMaterial({ color: "#C04820", metalness: 0.08, roughness: 0.88 });
  const ridgeStyle = new THREE.MeshStandardMaterial({ color: "#8C3515", metalness: 0.10, roughness: 0.85 });
  const fasciaStyle = new THREE.MeshStandardMaterial({ color: "#E8E0D4", metalness: 0.05, roughness: 0.75 });
  const gutterStyle = new THREE.MeshStandardMaterial({ color: "#707878", metalness: 0.72, roughness: 0.28 });
  const gableStyle = new THREE.MeshStandardMaterial({ color: "#D4C8B8", metalness: 0.05, roughness: 0.80 });

  const rl = RW + 2 * overhang;
  const ry_ridge = 0;
  const ry_eave_f = -slope_run - overhang;
  const ry_eave_b = slope_run + overhang;
  const rz_ridge = pitch_h;
  const rz_eave = 0;

  // Decks
  const createSlopeDeck = (yEave: number, yRidge: number, zEave: number, zRidge: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(yEave, zEave - deck_t);
    shape.lineTo(yEave, zEave);
    shape.lineTo(yRidge, zRidge);
    shape.lineTo(yRidge, zRidge - deck_t);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: rl, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, deckStyle);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = -rl / 2;
    return mesh;
  };

  group.add(createSlopeDeck(ry_eave_f, ry_ridge, rz_eave, rz_ridge));
  group.add(createSlopeDeck(ry_eave_b, ry_ridge, rz_eave, rz_ridge));

  // Battens
  const battenGeo = new THREE.BoxGeometry(rl, batten_h, batten_t);
  for (let i = 0; i < tile_rows; i++) {
    const t = (i + 0.5) / tile_rows;
    const byf = ry_eave_f + t * (ry_ridge - ry_eave_f);
    const bzf = rz_eave + t * (rz_ridge - rz_eave);
    const bf = new THREE.Mesh(battenGeo, battenStyle);
    bf.position.set(0, bzf + batten_h / 2, byf);
    bf.rotation.x = -Math.atan2(rz_ridge - rz_eave, ry_ridge - ry_eave_f);
    group.add(bf);
    
    const byb = ry_eave_b + t * (ry_ridge - ry_eave_b);
    const bzb = rz_eave + t * (rz_ridge - rz_eave);
    const bb = new THREE.Mesh(battenGeo, battenStyle);
    bb.position.set(0, bzb + batten_h / 2, byb);
    bb.rotation.x = -Math.atan2(rz_ridge - rz_eave, ry_ridge - ry_eave_b);
    group.add(bb);
  }

  // Gables
  const createGable = (x: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-slope_run - overhang, rz_eave);
    shape.lineTo(0, rz_ridge);
    shape.lineTo(slope_run + overhang, rz_eave);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: fascia_t, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, gableStyle);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.x = x;
    return mesh;
  };
  group.add(createGable(-rl / 2 - fascia_t));
  group.add(createGable(rl / 2));

  // Ridge, Fascia, Gutters
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(rl, ridge_h, ridge_w), ridgeStyle);
  ridge.position.set(0, rz_ridge, 0);
  group.add(ridge);

  const ff = new THREE.Mesh(new THREE.BoxGeometry(rl, fascia_h, fascia_t), fasciaStyle);
  ff.position.set(0, rz_eave - fascia_h / 2, ry_eave_f - fascia_t / 2);
  group.add(ff);
  
  const fb = new THREE.Mesh(new THREE.BoxGeometry(rl, fascia_h, fascia_t), fasciaStyle);
  fb.position.set(0, rz_eave - fascia_h / 2, ry_eave_b + fascia_t / 2);
  group.add(fb);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
