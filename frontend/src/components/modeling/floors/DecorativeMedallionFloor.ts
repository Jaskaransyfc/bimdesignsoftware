import * as THREE from "three";

const MM_SCALE = 500;

export const renderDecorativeMedallionFloor = (
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

  // Create High-Fidelity Floral Pattern
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  // Colors
  const baseYellow = "#e6c447";
  const lightYellow = "#f5dc75";
  const cream = "#f5ebc4";
  const offwhite = "#fcf5e0";
  const warmOrange = "#d49429";
  const deepMaroon = "#782b24";
  const groutColor = "#c7ae57";

  // Base
  ctx.fillStyle = baseYellow;
  ctx.fillRect(0, 0, 1024, 1024);

  const drawTile = (ox: number, oy: number, size: number) => {
    ctx.save();
    ctx.translate(ox + size / 2, oy + size / 2);
    
    // 1. Outer Petals (Cream)
    ctx.fillStyle = cream;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.19, size * 0.16, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Inner Petals (Light Yellow)
    ctx.fillStyle = lightYellow;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.19, size * 0.08, size * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Flower Ring (Offwhite)
    ctx.strokeStyle = offwhite;
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.31, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Center Medallion
    ctx.fillStyle = offwhite;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lightYellow;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = deepMaroon;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.018, 0, Math.PI * 2); ctx.fill();

    // 5. Small maroon dots around center
    ctx.fillStyle = deepMaroon;
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const dx = Math.cos(ang) * size * 0.17;
      const dy = Math.sin(ang) * size * 0.17;
      ctx.beginPath(); ctx.arc(dx, dy, size * 0.018, 0, Math.PI * 2); ctx.fill();
    }

    // 6. Ornamental Curls
    ctx.strokeStyle = "rgba(252, 245, 224, 0.55)";
    ctx.lineWidth = size * 0.02;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.arc(size * 0.24, 0, size * 0.17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  };

  // Draw 2x2 grid of patterns
  const tileSize = 512;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      drawTile(i * tileSize, j * tileSize, tileSize);
    }
  }

  // 7. Intersection Motif (at corners and center)
  const drawCornerMotif = (cx: number, cy: number, size: number) => {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = cream;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = offwhite;
    ctx.lineWidth = size * 0.028;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2); ctx.stroke();

    // Star pattern
    ctx.fillStyle = deepMaroon;
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(size * 0.05, 0);
      ctx.lineTo(size * 0.15, size * 0.05);
      ctx.lineTo(size * 0.15, -size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Orange center
    ctx.fillStyle = warmOrange;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.032, 0, Math.PI * 2); ctx.fill();

    // Leaves
    ctx.fillStyle = deepMaroon;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(size * 0.12, 0, size * 0.075, size * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  drawCornerMotif(0, 0, tileSize);
  drawCornerMotif(512, 0, tileSize);
  drawCornerMotif(1024, 0, tileSize);
  drawCornerMotif(0, 512, tileSize);
  drawCornerMotif(512, 512, tileSize);
  drawCornerMotif(1024, 512, tileSize);
  drawCornerMotif(0, 1024, tileSize);
  drawCornerMotif(512, 1024, tileSize);
  drawCornerMotif(1024, 1024, tileSize);

  // 8. Grout Lines
  ctx.strokeStyle = groutColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
  ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
  ctx.stroke();
  ctx.strokeRect(0, 0, 1024, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(worldW / 1.5, worldD / 1.5);

  const floorMat = new THREE.MeshStandardMaterial({
    map: texture,
    color: isSelected ? "#3b82f6" : (color || "#ffffff"),
    roughness: 0.2,
    metalness: 0.08,
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
