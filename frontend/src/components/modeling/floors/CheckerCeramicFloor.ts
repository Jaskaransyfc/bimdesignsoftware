import * as THREE from "three";

const MM_SCALE = 500;

export const renderCheckerCeramicFloor = (
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

  // Create Diagonal Checker Texture
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Colors
  const cream = "#ede0cc";
  const terracotta = "#ab7a5f";

  // Drawing diagonal checkers
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-256, -256);

  const cellSize = 64;
  for (let i = -10; i < 20; i++) {
    for (let j = -10; j < 20; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? cream : terracotta;
      ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }
  ctx.restore();

  // Add Glossy Sheen (subtle gradient)
  const sheen = ctx.createLinearGradient(0, 0, 512, 512);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  sheen.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 512);

  // Grout lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldW / 1.5, worldD / 1.5);

  const floorMat = new THREE.MeshStandardMaterial({
    map: texture,
    color: isSelected ? "#3b82f6" : (color || "#ffffff"),
    roughness: 0.15,
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
