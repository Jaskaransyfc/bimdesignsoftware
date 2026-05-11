import * as THREE from "three";

export const renderTripleCasementWindow = (
  scene: THREE.Scene,
  x: number,
  z: number,
  vectors: { dir: { x: number; z: number } } | null,
  winW: number,
  winH: number,
  sillHeight: number,
  hostWall: any,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  // Premium Dimensions
  const fw = 0.06; // outer frame thickness
  const mw = 0.05; // mullion width
  const sw = 0.04; // sash bar thickness
  const sd = 0.05; // sash depth
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05; // Slightly thicker for clean reveal
  const rail_y_ratio = 0.75; // Transom height ratio

  const materials = {
    frame: new THREE.MeshStandardMaterial({
      color: 0x2C3E50, // Premium Dark Midnight Blue/Grey
      metalness: 0.4,
      roughness: 0.3
    }),
    sash: new THREE.MeshStandardMaterial({
      color: 0x34495E,
      metalness: 0.3,
      roughness: 0.4
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xA9CCE3,
      transparent: true,
      opacity: 0.35,
      metalness: 0.6,
      roughness: 0.1,
      side: THREE.DoubleSide
    }),
    sill: new THREE.MeshStandardMaterial({
      color: 0xBDC3C7, // Concrete/Stone Sill
      roughness: 0.9,
      metalness: 0.1
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // 1. OUTER FRAME
  const bottomF = new THREE.BoxGeometry(winW, fw, D);
  const topF = new THREE.BoxGeometry(winW, fw, D);
  const leftF = new THREE.BoxGeometry(fw, winH - fw, D);
  const rightF = new THREE.BoxGeometry(fw, winH - fw, D);

  addPart(bottomF, "frame", 0, -winH/2 + fw/2, 0);
  addPart(topF, "frame", 0, winH/2 - fw/2, 0);
  addPart(leftF, "frame", -winW/2 + fw/2, 0, 0);
  addPart(rightF, "frame", winW/2 - fw/2, 0, 0);

  // 2. STONE SILL (Exterior)
  const sillW = winW + 0.2;
  const sillD = wallThickness * 0.6;
  const sillGeom = new THREE.BoxGeometry(sillW, 0.04, sillD);
  addPart(sillGeom, "sill", 0, -winH/2 - 0.02, wallThickness/2 + sillD/2 - 0.02);

  // 3. MULLIONS (Vertical Dividers)
  const iw = winW - 2*fw;
  const ih = winH - 2*fw;
  const col_w = (iw - 2*mw) / 3.0;

  const mullionGeom = new THREE.BoxGeometry(mw, ih, D - 0.01);
  const m_x1 = -winW/2 + fw + col_w + mw/2;
  const m_x2 = m_x1 + mw/2 + col_w + mw/2;

  addPart(mullionGeom, "frame", m_x1, 0, 0);
  addPart(mullionGeom, "frame", m_x2, 0, 0);

  // 4. SASHES (Three Casements)
  const col_centers = [
    -winW/2 + fw + col_w/2,
    m_x1 + mw/2 + col_w/2,
    m_x2 + mw/2 + col_w/2
  ];

  const sW = col_w - 0.01; // Small gap for realism
  const sH = ih - 0.01;
  const rail_y_local = -sH/2 + sH * rail_y_ratio;

  col_centers.forEach((cx) => {
    // Top & Bottom sash rails
    addPart(new THREE.BoxGeometry(sW, sw, sd), "sash", cx, -sH/2 + sw/2, 0);
    addPart(new THREE.BoxGeometry(sW, sw, sd), "sash", cx, sH/2 - sw/2, 0);
    // Vertical sash stiles
    addPart(new THREE.BoxGeometry(sw, sH - 2*sw, sd), "sash", cx - sW/2 + sw/2, 0, 0);
    addPart(new THREE.BoxGeometry(sw, sH - 2*sw, sd), "sash", cx + sW/2 - sw/2, 0, 0);
    
    // Transom/Mid-rail
    addPart(new THREE.BoxGeometry(sW - 2*sw, sw, sd), "sash", cx, rail_y_local, 0);

    // Glass Panes
    const ugH = sH/2 - sw/2 - (rail_y_local + sw/2);
    const lgH = (rail_y_local - sw/2) - (-sH/2 + sw/2);
    
    addPart(new THREE.BoxGeometry(sW - 2*sw, ugH - 0.005, 0.01), "glass", cx, rail_y_local + sw/2 + ugH/2, 0);
    addPart(new THREE.BoxGeometry(sW - 2*sw, lgH - 0.005, 0.01), "glass", cx, rail_y_local - sw/2 - lgH/2, 0);
  });

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angle = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angle;
  }

  scene.add(group);
  return group;
};
