import * as THREE from "three";
import { Wall } from "@/types/modeling";

const PLAN_SCALE = 10;

export const renderStandardBIMWall = (
  scene: THREE.Scene,
  wall: Wall,
  dx: number,
  dy: number,
  length: number,
  thickness: number,
  height: number,
  openings: any[],
  isSelected: boolean,
  color?: string
) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.lineTo(0, height);
  shape.closePath();

  openings.forEach((op) => {
    // Skip invalid or zero-width openings to prevent NaN errors
    if (Math.abs(op.maxX - op.minX) < 0.001) return;

    const hole = new THREE.Path();
    const clampedStart = Math.max(0, Math.min(length, op.minX));
    const clampedEnd = Math.max(0, Math.min(length, op.maxX));
    const opH = op.height;
    const sillH = op.sillHeight || 0;

    // Draw hole Clockwise (CW) -> oriented opposite to the outer shape (CCW)
    hole.moveTo(clampedStart, sillH);
    hole.lineTo(clampedStart, sillH + opH);
    hole.lineTo(clampedEnd, sillH + opH);
    hole.lineTo(clampedEnd, sillH);
    hole.closePath();
    shape.holes.push(hole);
  });

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -thickness / 2);

  let matRoughness = 0.85;
  let matMetalness = 0.05;
  let matOpacity = 1.0;
  let matTransparent = false;
  let matMap = null;

  const wallMat = String(wall.material || "").toLowerCase();

  if (wallMat.includes("glass")) {
    matRoughness = 0.1;
    matMetalness = 0.9;
    matOpacity = 0.35;
    matTransparent = true;
  } else if (wallMat.includes("steel") || wallMat.includes("metal")) {
    matRoughness = 0.3;
    matMetalness = 0.8;
  } else if (wallMat.includes("brick")) {
    matRoughness = 0.95;
    matMetalness = 0.0;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color || "#a52a2a"; // Use user color for bricks
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 64, 32);
      ctx.strokeRect(32, 32, 64, 32);
      matMap = new THREE.CanvasTexture(canvas);
      matMap.wrapS = THREE.RepeatWrapping;
      matMap.wrapT = THREE.RepeatWrapping;
      matMap.repeat.set(4, 4);
    }
  } else if (wallMat.includes("cmu") || wallMat.includes("block")) {
    matRoughness = 0.9;
    matMetalness = 0.1;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color || "#95a5a6"; // Use user color for CMU
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#7f8c8d";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 60, 30);
      ctx.strokeRect(2, 34, 60, 30);
      matMap = new THREE.CanvasTexture(canvas);
      matMap.wrapS = THREE.RepeatWrapping;
      matMap.wrapT = THREE.RepeatWrapping;
      matMap.repeat.set(2, 4);
    }
  } else if (wallMat.includes("wood") || wallMat.includes("frame")) {
    matRoughness = 0.6;
    matMetalness = 0.02;
  }

  const material = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (matMap ? "#ffffff" : (color || (wallMat.includes("wood") ? "#8B4513" : "#95a5a6"))),
    roughness: matRoughness,
    metalness: matMetalness,
    transparent: matTransparent,
    opacity: matOpacity,
    map: matMap,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    wall.startPoint.x / PLAN_SCALE,
    0,
    wall.startPoint.y / PLAN_SCALE,
  );
  mesh.rotation.y = -Math.atan2(dy, dx);
  scene.add(mesh);

  return material; // We return the material because Model3DPreview uses it for corner fillers
};
