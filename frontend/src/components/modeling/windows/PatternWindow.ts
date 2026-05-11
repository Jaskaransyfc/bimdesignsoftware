import * as THREE from "three";

export const renderPatternWindow = (
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

  const fw = 0.06; // outer frame thickness
  const sd = 0.05; // sash depth
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05;

  const materials = {
    frame: new THREE.MeshStandardMaterial({
      color: 0x2C3E50, // Premium Dark
      metalness: 0.4,
      roughness: 0.3
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
      color: 0xBDC3C7, // Stone Sill
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

  const rectHeight = winH - winW/2;
  const radius = winW/2;
  
  // 1. ARCHED FRAME
  const shape = new THREE.Shape();
  shape.moveTo(-winW/2, -winH/2);
  shape.lineTo(winW/2, -winH/2);
  shape.lineTo(winW/2, -winH/2 + rectHeight);
  shape.absarc(0, -winH/2 + rectHeight, radius, 0, Math.PI, false);
  shape.lineTo(-winW/2, -winH/2);

  const innerShape = new THREE.Path();
  const innerRadius = radius - fw;
  innerShape.moveTo(-winW/2 + fw, -winH/2 + fw);
  innerShape.lineTo(winW/2 - fw, -winH/2 + fw);
  innerShape.lineTo(winW/2 - fw, -winH/2 + rectHeight);
  innerShape.absarc(0, -winH/2 + rectHeight, innerRadius, 0, Math.PI, false);
  innerShape.lineTo(-winW/2 + fw, -winH/2 + fw);
  shape.holes.push(innerShape);

  const frameGeom = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 32 });
  addPart(frameGeom, "frame", 0, 0, -D/2);

  // 2. STONE SILL
  const sillGeom = new THREE.BoxGeometry(winW + 0.15, 0.04, wallThickness * 0.6);
  addPart(sillGeom, "sill", 0, -winH/2 - 0.02, wallThickness/2 + 0.02);

  // 3. GLASS
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-winW/2 + fw, -winH/2 + fw);
  glassShape.lineTo(winW/2 - fw, -winH/2 + fw);
  glassShape.lineTo(winW/2 - fw, -winH/2 + rectHeight);
  glassShape.absarc(0, -winH/2 + rectHeight, innerRadius, 0, Math.PI, false);
  glassShape.lineTo(-winW/2 + fw, -winH/2 + fw);

  const glassGeom = new THREE.ExtrudeGeometry(glassShape, { depth: 0.01, bevelEnabled: false, curveSegments: 32 });
  addPart(glassGeom, "glass", 0, 0, -0.005);

  // 4. PATTERN GRILLS (Cross + Transom)
  const grillThickness = 0.025;
  const vGrill = new THREE.BoxGeometry(grillThickness, winH - 2*fw, 0.02);
  addPart(vGrill, "frame", 0, 0, 0);

  const hGrill = new THREE.BoxGeometry(winW - 2*fw, grillThickness, 0.02);
  addPart(hGrill, "frame", 0, -winH/2 + rectHeight, 0);

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angle = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angle;
  }

  scene.add(group);
  return group;
};
