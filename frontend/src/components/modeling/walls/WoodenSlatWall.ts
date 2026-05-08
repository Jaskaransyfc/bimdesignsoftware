import * as THREE from "three";
import { Wall } from "@/types/modeling";

const PLAN_SCALE = 10;

export const renderWoodenSlatWall = (
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
  const wallGroup = new THREE.Group();

  const slatWidth = 0.05 * 2; // 100mm slats (scaled)
  const slatGap = 0.03 * 2; 
  const totalSlatWidth = slatWidth + slatGap;
  const numSlats = Math.floor(length / totalSlatWidth);

  const material = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#8B4513"),
    roughness: 0.8,
    metalness: 0.05,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });

  const angle = Math.atan2(dy, dx);
  
  for (let i = 0; i <= numSlats; i++) {
    const xPos = i * totalSlatWidth;
    
    const slatEndX = xPos + slatWidth;
    let insideOpening = false;
    let opH = 0;
    let sillH = 0;

    for (const op of openings) {
      // Skip invalid openings
      if (isNaN(op.minX) || isNaN(op.maxX)) continue;

      // Check for overlap between slat range [xPos, slatEndX] and opening range [op.minX, op.maxX]
      const overlapStart = Math.max(xPos, op.minX);
      const overlapEnd = Math.min(slatEndX, op.maxX);

      if (overlapStart < overlapEnd) {
        insideOpening = true;
        opH = op.height;
        sillH = op.sillHeight || 0;
        break;
      }
    }

    if (!insideOpening) {
      const slatGeom = new THREE.BoxGeometry(slatWidth, height, thickness);
      slatGeom.translate(slatWidth / 2, height / 2, 0);
      const slat = new THREE.Mesh(slatGeom, material);
      slat.position.set(xPos, 0, 0);
      wallGroup.add(slat);
    } else {
      // Header above opening
      const headerH = height - (sillH + opH);
      if (headerH > 0.01) {
        const hGeom = new THREE.BoxGeometry(slatWidth, headerH, thickness);
        hGeom.translate(slatWidth / 2, headerH / 2, 0);
        const hSlat = new THREE.Mesh(hGeom, material);
        hSlat.position.set(xPos, sillH + opH, 0);
        wallGroup.add(hSlat);
      }
      // Footer below window
      if (sillH > 0.01) {
        const fGeom = new THREE.BoxGeometry(slatWidth, sillH, thickness);
        fGeom.translate(slatWidth / 2, sillH / 2, 0);
        const fSlat = new THREE.Mesh(fGeom, material);
        fSlat.position.set(xPos, 0, 0);
        wallGroup.add(fSlat);
      }
    }
  }

  wallGroup.rotation.y = -angle;
  wallGroup.position.set(
    wall.startPoint.x / PLAN_SCALE,
    0,
    wall.startPoint.y / PLAN_SCALE
  );

  scene.add(wallGroup);
  return material;
};
