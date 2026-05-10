import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderCarpet = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const carpet_width = Number(m.carpet_width ?? 3.0);
  const carpet_depth = Number(m.carpet_depth ?? 2.0);
  const carpet_thickness = Number(m.carpet_thickness ?? 0.02);
  const fringe_length = Number(m.fringe_length ?? 0.1);

  const materials = {
    main: new THREE.MeshStandardMaterial({
      color: 0xECE5D9, // Light cream premium color
      metalness: 0.0,
      roughness: 1.0,
    }),
    pattern: new THREE.MeshStandardMaterial({
      color: 0xC1B29D, // Subtly darker pattern
      metalness: 0.0,
      roughness: 1.0,
    }),
    fringe: new THREE.MeshStandardMaterial({
      color: 0xDFD6C9,
      metalness: 0.0,
      roughness: 1.0,
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    // carpets don't cast strong shadows, keep flat
    group.add(mesh);
  };

  // Main Carpet Body
  const baseGeom = new THREE.BoxGeometry(carpet_width, carpet_depth, carpet_thickness);
  addPart(baseGeom, "main", 0, 0, carpet_thickness / 2);

  // Fringes on Left and Right (along X axis edges)
  const fringeGeom = new THREE.BoxGeometry(fringe_length, carpet_depth, carpet_thickness * 0.5);
  addPart(fringeGeom, "fringe", -carpet_width / 2 - fringe_length / 2, 0, carpet_thickness * 0.25);
  addPart(fringeGeom, "fringe", carpet_width / 2 + fringe_length / 2, 0, carpet_thickness * 0.25);

  // Geometric Pattern (Overlapping thin boxes to simulate a woven pattern)
  const patternGeom1 = new THREE.BoxGeometry(carpet_width * 0.8, carpet_depth * 0.05, carpet_thickness * 1.1);
  const patternGeom2 = new THREE.BoxGeometry(carpet_width * 0.05, carpet_depth * 0.8, carpet_thickness * 1.1);
  
  addPart(patternGeom1, "pattern", 0, carpet_depth * 0.3, carpet_thickness / 2);
  addPart(patternGeom1, "pattern", 0, -carpet_depth * 0.3, carpet_thickness / 2);
  addPart(patternGeom2, "pattern", carpet_width * 0.3, 0, carpet_thickness / 2);
  addPart(patternGeom2, "pattern", -carpet_width * 0.3, 0, carpet_thickness / 2);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
