import * as THREE from "three";

const MM_SCALE = 500;

export const renderLuxuryStoneFloor = (
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

  // Create Luxury Stone Texture (Marble-like)
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Base
  const baseColor = color || "#f8fafc";
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Veins
  ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, 0);
    for (let j = 0; j < 10; j++) {
      ctx.lineTo(Math.random() * 512, (j + 1) * 51.2);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldW / 2, worldD / 2);

  const floorMat = new THREE.MeshStandardMaterial({
    map: texture,
    color: isSelected ? "#3b82f6" : "#ffffff",
    roughness: 0.05,
    metalness: 0.2,
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
