import * as THREE from "three";

export const renderCurvedWindow = (
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

  const fw = 0.06; // frame thickness
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05; 
  
  const R_arch = winW / 2;
  const rectHeight = winH - R_arch;

  const materials = {
    frame: new THREE.MeshStandardMaterial({
      color: 0x2C3E50, // Dark Premium
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

  // 1. ARCHED FRAME
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-winW/2, -winH/2);
  outerShape.lineTo(winW/2, -winH/2);
  outerShape.lineTo(winW/2, -winH/2 + rectHeight);
  outerShape.absarc(0, -winH/2 + rectHeight, R_arch, 0, Math.PI, false);
  outerShape.lineTo(-winW/2, -winH/2);

  const innerPath = new THREE.Path();
  const innerRadius = R_arch - fw;
  innerPath.moveTo(-winW/2 + fw, -winH/2 + fw);
  innerPath.lineTo(winW/2 - fw, -winH/2 + fw);
  innerPath.lineTo(winW/2 - fw, -winH/2 + rectHeight);
  innerPath.absarc(0, -winH/2 + rectHeight, innerRadius, 0, Math.PI, false);
  innerPath.lineTo(-winW/2 + fw, -winH/2 + fw);
  outerShape.holes.push(innerPath);

  const frameGeom = new THREE.ExtrudeGeometry(outerShape, { depth: D, bevelEnabled: false, curveSegments: 32 });
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

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angle = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angle;
  }

  scene.add(group);
  return group;
};
