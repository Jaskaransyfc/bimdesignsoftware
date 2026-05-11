import * as THREE from "three";

export const renderCircularWindow = (
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

  const radius = Math.min(winW, winH) / 2;
  const fw = 0.06; // frame thickness
  const sw = 0.04; // spoke thickness
  const sd = 0.05; // sash depth
  const wallThickness = hostWall ? hostWall.thickness / 500 : 0.4;
  const D = wallThickness + 0.05; 
  const spokesCount = 6;

  const materials = {
    frame: new THREE.MeshStandardMaterial({
      color: 0x2C3E50, // Dark Premium
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

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, px: number, py: number, pz: number, rotZ: number = 0) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(px, py, pz);
    if (rotZ !== 0) mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // 1. OUTER FRAME RING
  const outerShape = new THREE.Shape();
  outerShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const innerPath = new THREE.Path();
  innerPath.absarc(0, 0, radius - fw, 0, Math.PI * 2, true);
  outerShape.holes.push(innerPath);

  const frameGeom = new THREE.ExtrudeGeometry(outerShape, { depth: D, bevelEnabled: false, curveSegments: 64 });
  addPart(frameGeom, "frame", 0, 0, -D/2);

  // 2. STONE SILL (Center-bottom)
  const sillGeom = new THREE.BoxGeometry(winW * 0.7, 0.04, wallThickness * 0.6);
  addPart(sillGeom, "sill", 0, -radius - 0.02, wallThickness/2 + 0.02);

  // 3. GLASS DISC
  const glassGeom = new THREE.CylinderGeometry(radius - fw, radius - fw, 0.01, 64);
  const glassMesh = new THREE.Mesh(glassGeom, materials.glass);
  glassMesh.rotation.x = Math.PI / 2;
  group.add(glassMesh);

  // 4. HUB
  const hubRadius = sw * 1.8;
  const hubGeom = new THREE.CylinderGeometry(hubRadius, hubRadius, sd, 16);
  const hubMesh = new THREE.Mesh(hubGeom, materials.sash);
  hubMesh.rotation.x = Math.PI / 2;
  group.add(hubMesh);

  // 5. SPOKES
  const spokeLen = (radius - fw) - hubRadius;
  const spokeGeom = new THREE.BoxGeometry(sw, spokeLen, sd);

  for (let i = 0; i < spokesCount; i++) {
    const angle = (i * 2 * Math.PI) / spokesCount;
    const cy = Math.sin(angle) * (hubRadius + spokeLen / 2);
    const cx = Math.cos(angle) * (hubRadius + spokeLen / 2);
    addPart(spokeGeom, "sash", cx, cy, 0, angle - Math.PI / 2);
  }

  // Final Positioning
  group.position.set(x, sillHeight + winH / 2, z);
  if (vectors) {
    const angle = Math.atan2(vectors.dir.z, vectors.dir.x);
    group.rotation.y = -angle;
  }

  scene.add(group);
  return group;
};
