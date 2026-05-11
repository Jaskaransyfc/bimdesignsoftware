import * as THREE from "three";

export const renderTriangleWindow = (
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

  // 1. TRIANGULAR FRAME
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-winW/2, -winH/2);
  outerShape.lineTo(0, winH/2);
  outerShape.lineTo(winW/2, -winH/2);
  outerShape.closePath();

  // Inset calculation for triangular hole
  const angle = Math.atan2(winH, winW/2);
  const insetX = fw / Math.sin(angle);
  const insetY = fw;

  const innerPath = new THREE.Path();
  innerPath.moveTo(-winW/2 + insetX, -winH/2 + insetY);
  innerPath.lineTo(0, winH/2 - insetY*2); 
  innerPath.lineTo(winW/2 - insetX, -winH/2 + insetY);
  innerPath.closePath();
  outerShape.holes.push(innerPath);

  const frameGeom = new THREE.ExtrudeGeometry(outerShape, { depth: D, bevelEnabled: false });
  addPart(frameGeom, "frame", 0, 0, -D/2);

  // 2. STONE SILL
  const sillGeom = new THREE.BoxGeometry(winW + 0.15, 0.04, wallThickness * 0.6);
  addPart(sillGeom, "sill", 0, -winH/2 - 0.02, wallThickness/2 + 0.02);

  // 3. GLASS
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-winW/2 + insetX, -winH/2 + insetY);
  glassShape.lineTo(0, winH/2 - insetY*2);
  glassShape.lineTo(winW/2 - insetX, -winH/2 + insetY);
  glassShape.closePath();

  const glassGeom = new THREE.ExtrudeGeometry(glassShape, { depth: 0.01, bevelEnabled: false });
  addPart(glassGeom, "glass", 0, 0, -0.005);

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angleRot = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angleRot;
  }

  scene.add(group);
  return group;
};
