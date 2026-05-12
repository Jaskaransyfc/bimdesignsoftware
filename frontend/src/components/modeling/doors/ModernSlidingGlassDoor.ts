import * as THREE from "three";
import { Door, Wall } from "@/types/modeling";

const MM_SCALE = 500;

export const renderModernSlidingGlassDoor = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  vectors: any,
  doorW: number,
  doorH: number,
  hostWall?: Wall,
  isSelected?: boolean,
  color?: string
) => {
  const group = new THREE.Group();

  const black_mat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#2a2a2a"),
    metalness: 0.5,
    roughness: 0.3,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  // @ts-ignore - MeshPhysicalMaterial exists in three
  const glass_mat = new THREE.MeshPhysicalMaterial({
    color: "#fff5e6",
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.015,
    transparent: true,
    opacity: 1,
    // @ts-ignore
    side: THREE.DoubleSide,
    envMapIntensity: 1,
    clearcoat: 1,
  });

  const panel_count = 4;
  const panel_w = doorW / panel_count;
  const frame_d = hostWall ? hostWall.thickness / MM_SCALE + 0.04 : 0.08;

  for (let i = 0; i < panel_count; i++) {
    const x = -doorW / 2 + i * panel_w + panel_w / 2;
    const panelGroup = new THREE.Group();

    // Panel Frame
    const frameGeom = new THREE.BoxGeometry(panel_w, doorH, frame_d);
    // Simple way to show frame: use a slightly smaller glass panel inside
    const frame = new THREE.Mesh(frameGeom, black_mat);
    frame.position.y = doorH / 2;
    // Offset panels slightly for sliding look
    frame.position.z = (i % 2 === 0) ? 0.02 : -0.02;
    panelGroup.add(frame);

    const glassGeom = new THREE.BoxGeometry(panel_w - 0.08, doorH - 0.08, 0.012);
    const glass = new THREE.Mesh(glassGeom, glass_mat);
    glass.position.y = doorH / 2;
    glass.position.z = (i % 2 === 0) ? 0.021 : -0.019;
    panelGroup.add(glass);

    panelGroup.position.x = x;
    group.add(panelGroup);
  }

  // Handles
  const handleGeom = new THREE.BoxGeometry(0.018, 0.42, 0.02);
  const handleL = new THREE.Mesh(handleGeom, black_mat);
  handleL.position.set(-0.05, 1.05, 0.05);
  group.add(handleL);

  const handleR = new THREE.Mesh(handleGeom, black_mat);
  handleR.position.set(0.05, 1.05, 0.05);
  group.add(handleR);

  // Final Positioning
  group.position.set(px, 0, pz);
  if (vectors) {
    group.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
  }

  scene.add(group);
};
