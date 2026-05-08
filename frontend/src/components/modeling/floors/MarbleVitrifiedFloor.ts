import * as THREE from "three";

const MM_SCALE = 500;

export const renderMarbleVitrifiedFloor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  width: number,
  depth: number,
  isSelected?: boolean,
  color?: string,
) => {
  const floorGroup = new THREE.Group();

  // DIMENSIONS (1m = 2 units)
  const worldW = (width / 1000) * 2;
  const worldD = (depth / 1000) * 2;
  const thick = 0.02 * 2; // 20mm tile thickness

  const floorMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#f1f5f9"), // Light white/gray
    roughness: 0.08,
    metalness: 0.12,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  // Main slab
  const geometry = new THREE.BoxGeometry(worldW, thick, worldD);
  const mesh = new THREE.Mesh(geometry, floorMat);
  mesh.position.set(0, thick / 2, 0);
  floorGroup.add(mesh);

  // Tile Lines (Grid)
  const tileSize = 0.6 * 2; // 600mm tiles
  const lineMat = new THREE.LineBasicMaterial({ color: "#cbd5e1", transparent: true, opacity: 0.5 });
  
  // Vertical lines
  for (let x = -worldW / 2 + tileSize; x < worldW / 2; x += tileSize) {
    const points = [
      new THREE.Vector3(x, thick + 0.001, -worldD / 2),
      new THREE.Vector3(x, thick + 0.001, worldD / 2),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeom, lineMat);
    floorGroup.add(line);
  }

  // Horizontal lines
  for (let z = -worldD / 2 + tileSize; z < worldD / 2; z += tileSize) {
    const points = [
      new THREE.Vector3(-worldW / 2, thick + 0.001, z),
      new THREE.Vector3(worldW / 2, thick + 0.001, z),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeom, lineMat);
    floorGroup.add(line);
  }

  // FINAL POSITIONING
  floorGroup.position.set(px, -0.001, pz); // Slightly below 0 to avoid Z-fighting with walls
  scene.add(floorGroup);
};
