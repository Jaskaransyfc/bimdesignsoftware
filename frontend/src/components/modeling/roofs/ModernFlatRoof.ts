import * as THREE from "three";

export const renderModernFlatRoof = (
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
  const slab_t = 0.3;
  const fascia_h = 0.18;
  const fascia_t = 0.04;
  const par_h = 0.2;
  const par_t = 0.08;
  const cop_t = 0.02;
  const cop_oh = 0.015;
  const r = 0.2; // corner radius
  const soffit_t = 0.025;
  const soffit_oh = 0.02;

  const slabStyle = new THREE.MeshStandardMaterial({ color: "#C8C0B4", metalness: 0.05, roughness: 0.85 });
  const soffitStyle = new THREE.MeshStandardMaterial({ color: "#D4CEC8", metalness: 0.04, roughness: 0.80 });
  const fasciaStyle = new THREE.MeshStandardMaterial({ color: "#B8B0A8", metalness: 0.06, roughness: 0.78 });
  const dripStyle = new THREE.MeshStandardMaterial({ color: "#909898", metalness: 0.75, roughness: 0.25 });
  const memStyle = new THREE.MeshStandardMaterial({ color: "#1E1E1E", metalness: 0.02, roughness: 0.95 });
  const parStyle = new THREE.MeshStandardMaterial({ color: "#C4BDB6", metalness: 0.04, roughness: 0.82 });
  const copStyle = new THREE.MeshStandardMaterial({ color: "#A8A09A", metalness: 0.08, roughness: 0.70 });

  // Helper for rounded rectangle shape
  const createRoundedRectShape = (w: number, d: number, radius: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + radius, -d / 2);
    shape.lineTo(w / 2 - radius, -d / 2);
    shape.absarc(w / 2 - radius, -d / 2 + radius, radius, -Math.PI / 2, 0, false);
    shape.lineTo(w / 2, d / 2 - radius);
    shape.absarc(w / 2 - radius, d / 2 - radius, radius, 0, Math.PI / 2, false);
    shape.lineTo(-w / 2 + radius, d / 2);
    shape.absarc(-w / 2 + radius, d / 2 - radius, radius, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w / 2, -d / 2 + radius);
    shape.absarc(-w / 2 + radius, -d / 2 + radius, radius, Math.PI, 1.5 * Math.PI, false);
    return shape;
  };

  // SLAB
  const slabShape = createRoundedRectShape(RW, RD, r);
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: slab_t, bevelEnabled: false });
  const slab = new THREE.Mesh(slabGeo, slabStyle);
  slab.rotation.x = Math.PI / 2;
  group.add(slab);

  // MEMBRANE
  const memGeo = new THREE.BoxGeometry(RW, 0.012, RD);
  const membrane = new THREE.Mesh(memGeo, memStyle);
  membrane.position.set(0, slab_t + 0.006, 0);
  group.add(membrane);

  // SOFFIT
  const r2 = r + soffit_oh;
  const soffitShape = createRoundedRectShape(RW + 2 * soffit_oh, RD + 2 * soffit_oh, r2);
  const soffitGeo = new THREE.ExtrudeGeometry(soffitShape, { depth: soffit_t, bevelEnabled: false });
  const soffit = new THREE.Mesh(soffitGeo, soffitStyle);
  soffit.rotation.x = Math.PI / 2;
  soffit.position.set(0, -soffit_t, 0);
  group.add(soffit);

  // FASCIA
  const fasciaGeo = new THREE.BoxGeometry(RW - 2 * r, fascia_h, fascia_t);
  const fasciaF = new THREE.Mesh(fasciaGeo, fasciaStyle);
  fasciaF.position.set(0, -soffit_t - fascia_h / 2, -RD / 2 - soffit_oh - fascia_t / 2);
  group.add(fasciaF);
  
  const fasciaB = new THREE.Mesh(fasciaGeo, fasciaStyle);
  fasciaB.position.set(0, -soffit_t - fascia_h / 2, RD / 2 + soffit_oh + fascia_t / 2);
  group.add(fasciaB);

  const fasciaL = new THREE.Mesh(new THREE.BoxGeometry(fascia_t, fascia_h, RD - 2 * r), fasciaStyle);
  fasciaL.position.set(-RW / 2 - soffit_oh - fascia_t / 2, -soffit_t - fascia_h / 2, 0);
  group.add(fasciaL);

  const fasciaR = new THREE.Mesh(new THREE.BoxGeometry(fascia_t, fascia_h, RD - 2 * r), fasciaStyle);
  fasciaR.position.set(RW / 2 + soffit_oh + fascia_t / 2, -soffit_t - fascia_h / 2, 0);
  group.add(fasciaR);

  // PARAPET
  const parapetGeoF = new THREE.BoxGeometry(RW, par_h, par_t);
  const parF = new THREE.Mesh(parapetGeoF, parStyle);
  parF.position.set(0, slab_t + 0.012 + par_h / 2, -RD / 2 + par_t / 2);
  group.add(parF);

  const parB = new THREE.Mesh(parapetGeoF, parStyle);
  parB.position.set(0, slab_t + 0.012 + par_h / 2, RD / 2 - par_t / 2);
  group.add(parB);

  // COPING
  const copGeoF = new THREE.BoxGeometry(RW + 2 * cop_oh, cop_t, par_t + cop_oh);
  const copF = new THREE.Mesh(copGeoF, copStyle);
  copF.position.set(0, slab_t + 0.012 + par_h + cop_t / 2, -RD / 2 + par_t / 2);
  group.add(copF);

  group.position.set(px, 0, pz);
  group.rotation.y = rotation;
  scene.add(group);
};
