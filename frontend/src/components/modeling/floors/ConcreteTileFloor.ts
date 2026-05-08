import * as THREE from "three";

const MM_SCALE = 500;

export const renderConcreteTileFloor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  width: number,
  depth: number,
  isSelected?: boolean,
  color?: string,
) => {
  const floorGroup = new THREE.Group();

  const worldW = (width / 1000) * 2;
  const worldD = (depth / 1000) * 2;
  const thick = 0.02 * 2;

  // Create Procedural Concrete Texture
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Base Color
  const baseColor = color || "#4b5563";
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Add Noise/Grain
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const val = Math.random() * 20 - 10;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Grout Lines
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.moveTo(256, 0); ctx.lineTo(256, 512);
  ctx.moveTo(0, 256); ctx.lineTo(512, 256);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldW / 1.2, worldD / 1.2);

  const floorMat = new THREE.MeshStandardMaterial({
    map: texture,
    color: isSelected ? "#3b82f6" : "#ffffff",
    roughness: 0.8,
    metalness: 0.1,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const geometry = new THREE.BoxGeometry(worldW, thick, worldD);
  const mesh = new THREE.Mesh(geometry, floorMat);
  mesh.position.set(0, thick / 2, 0);
  floorGroup.add(mesh);

  floorGroup.position.set(px, -0.001, pz);
  scene.add(floorGroup);
};
