import * as THREE from "three";

export const renderOvalWindow = (
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

  // 1. OVAL FRAME
  const outerShape = new THREE.Shape();
  outerShape.absellipse(0, 0, winW/2, winH/2, 0, Math.PI * 2, false);

  const innerPath = new THREE.Path();
  innerPath.absellipse(0, 0, winW/2 - fw, winH/2 - fw, 0, Math.PI * 2, true);
  outerShape.holes.push(innerPath);

  const frameGeom = new THREE.ExtrudeGeometry(outerShape, { depth: D, bevelEnabled: false, curveSegments: 64 });
  addPart(frameGeom, "frame", 0, 0, -D/2);

  // 2. STONE SILL
  const sillGeom = new THREE.BoxGeometry(winW * 0.7, 0.04, wallThickness * 0.6);
  addPart(sillGeom, "sill", 0, -winH/2 - 0.02, wallThickness/2 + 0.02);

  // 3. GLASS
  const glassShape = new THREE.Shape();
  glassShape.absellipse(0, 0, winW/2 - fw, winH/2 - fw, 0, Math.PI * 2, false);
  const glassGeom = new THREE.ExtrudeGeometry(glassShape, { depth: 0.01, bevelEnabled: false, curveSegments: 64 });
  addPart(glassGeom, "glass", 0, 0, -0.005);

  // 4. GRILLS (Cross)
  const grillThickness = 0.025;
  const vGrill = new THREE.BoxGeometry(grillThickness, winH - 2*fw, 0.02);
  addPart(vGrill, "frame", 0, 0, 0);
  const hGrill = new THREE.BoxGeometry(winW - 2*fw, grillThickness, 0.02);
  addPart(hGrill, "frame", 0, 0, 0);

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angle = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angle;
  }

  scene.add(group);
  return group;
};
