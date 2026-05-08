import * as THREE from "three";
import { Stair } from "@/types/modeling";

const MM_SCALE = 500;

export const renderConcreteParametricStairs = (
  scene: THREE.Scene,
  stair: Stair,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  // Extract properties from metadata or use defaults from the provided Python script
  const steps = parseInt(stair.metadata?.number_of_steps || "8");
  const width = parseFloat(stair.metadata?.stair_width || "2.40");
  const tread = parseFloat(stair.metadata?.tread_depth || "0.42");
  const rise = parseFloat(stair.metadata?.rise_height || "0.22");
  const landing = parseFloat(stair.metadata?.landing_depth || "0.65");
  
  const origin_x = stair.position.x / 10; // PLAN_SCALE = 10
  const origin_y = stair.position.y / 10;
  const origin_z = 0;

  const concrete_brightness = parseFloat(stair.metadata?.concrete_brightness || "0.62");
  const show_dark_edges = stair.metadata?.show_dark_edges !== false;
  
  const metalness = parseFloat(stair.metadata?.metalness || "0.02");
  const roughness = parseFloat(stair.metadata?.roughness || "0.58");

  const baseColor = isSelected ? "#3b82f6" : (stair.color || "#9ca3af");

  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: metalness,
    roughness: roughness,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.5 : 0,
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: "#333333",
    metalness: 0.02,
    roughness: 0.5,
  });

  // 1. Individual Steps (Treads + Risers)
  for (let i = 0; i < steps; i++) {
    // Tread
    const treadGeom = new THREE.BoxGeometry(width, 0.05, tread);
    const treadMesh = new THREE.Mesh(treadGeom, concreteMaterial);
    const ty = origin_z + (i + 1) * rise;
    const tz = origin_y + i * tread + tread / 2;
    treadMesh.position.set(origin_x + width / 2, ty - 0.025, tz);
    group.add(treadMesh);

    // Riser (Solid block under the tread)
    const riserGeom = new THREE.BoxGeometry(width, (i + 1) * rise, tread);
    const riserMesh = new THREE.Mesh(riserGeom, concreteMaterial);
    riserMesh.position.set(origin_x + width / 2, (i + 1) * rise / 2, tz);
    group.add(riserMesh);

    // Dark Edge for visibility
    if (show_dark_edges) {
      const edgeGeom = new THREE.BoxGeometry(width + 0.01, 0.01, 0.01);
      const edgeMesh = new THREE.Mesh(edgeGeom, edgeMaterial);
      edgeMesh.position.set(origin_x + width / 2, ty, origin_y + i * tread);
      group.add(edgeMesh);
    }
  }

  // 2. Top Landing
  const total_depth_before_landing = steps * tread;
  const landingGeom = new THREE.BoxGeometry(width, steps * rise, landing);
  const landingMesh = new THREE.Mesh(landingGeom, concreteMaterial);
  landingMesh.position.set(
    origin_x + width / 2, 
    (steps * rise) / 2, 
    origin_y + total_depth_before_landing + landing / 2
  );
  group.add(landingMesh);

  // Top surface of landing
  const topLandingGeom = new THREE.BoxGeometry(width, 0.05, landing);
  const topLandingMesh = new THREE.Mesh(topLandingGeom, concreteMaterial);
  topLandingMesh.position.set(
    origin_x + width / 2,
    steps * rise - 0.025,
    origin_y + total_depth_before_landing + landing / 2
  );
  group.add(topLandingMesh);

  // Apply Rotation if any
  if (stair.rotation) {
    group.rotation.y = (stair.rotation * Math.PI) / 180;
  }

  scene.add(group);
};
