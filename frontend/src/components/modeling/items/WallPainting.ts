import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderWallPainting = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const painting_width = Number(m.painting_width ?? 2.0);
  const painting_height = Number(m.painting_height ?? 1.2);
  const painting_depth = Number(m.painting_depth ?? 0.05);
  const frame_thickness = Number(m.frame_thickness ?? 0.08);

  const materials = {
    canvas: new THREE.MeshStandardMaterial({
      color: 0xE8ECEF, // Light canvas color
      metalness: 0.0,
      roughness: 1.0,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: 0x1A1A1A, // Dark frame
      metalness: 0.1,
      roughness: 0.6,
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: "canvas" | "frame", x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Canvas
  const canvasGeom = new THREE.BoxGeometry(
    painting_width - frame_thickness * 2,
    painting_height - frame_thickness * 2,
    painting_depth * 0.8
  );
  addPart(canvasGeom, "canvas", 0, 0, painting_depth / 2);

  // Frame (4 parts)
  const topFrame = new THREE.BoxGeometry(painting_width, frame_thickness, painting_depth);
  const bottomFrame = new THREE.BoxGeometry(painting_width, frame_thickness, painting_depth);
  const leftFrame = new THREE.BoxGeometry(frame_thickness, painting_height - frame_thickness * 2, painting_depth);
  const rightFrame = new THREE.BoxGeometry(frame_thickness, painting_height - frame_thickness * 2, painting_depth);

  addPart(topFrame, "frame", 0, painting_height / 2 - frame_thickness / 2, painting_depth / 2);
  addPart(bottomFrame, "frame", 0, -painting_height / 2 + frame_thickness / 2, painting_depth / 2);
  addPart(leftFrame, "frame", -painting_width / 2 + frame_thickness / 2, 0, painting_depth / 2);
  addPart(rightFrame, "frame", painting_width / 2 - frame_thickness / 2, 0, painting_depth / 2);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
