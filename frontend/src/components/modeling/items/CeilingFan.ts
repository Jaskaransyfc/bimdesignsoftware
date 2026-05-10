import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderCeilingFan = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const blade_span = Number(m.blade_span ?? 1.2);
  const blade_width = Number(m.blade_width ?? 0.15);
  const drop_height = Number(m.drop_height ?? 0.35);
  const motor_radius = Number(m.motor_radius ?? 0.12);

  const materials = {
    motor: new THREE.MeshStandardMaterial({
      color: 0x2C3033, // Dark grey motor
      metalness: 0.6,
      roughness: 0.4
    }),
    blade: new THREE.MeshStandardMaterial({
      color: 0x8A5A44, // Wooden blade
      metalness: 0.1,
      roughness: 0.8
    }),
    rod: new THREE.MeshStandardMaterial({
      color: 0x111111, // Black rod
      metalness: 0.8,
      roughness: 0.3
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.5,
    })
  };

  const addPart = (geom: THREE.BufferGeometry, matName: keyof typeof materials, x: number, y: number, z: number, rotZ: number = 0) => {
    const mesh = new THREE.Mesh(geom, isSelected ? materials.selected : materials[matName]);
    mesh.position.set(x, y, z);
    if (rotZ !== 0) mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Ceiling Rose & Rod
  const rodGeom = new THREE.CylinderGeometry(0.015, 0.015, drop_height - 0.1);
  const rod = new THREE.Mesh(rodGeom, isSelected ? materials.selected : materials.rod);
  rod.rotation.x = Math.PI / 2; // Orient along Z in FreeCAD space
  rod.position.set(0, 0, drop_height / 2);
  group.add(rod);

  // Motor Housing
  const motorGeom = new THREE.CylinderGeometry(motor_radius, motor_radius * 0.9, 0.12, 32);
  const motor = new THREE.Mesh(motorGeom, isSelected ? materials.selected : materials.motor);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0, 0.06);
  group.add(motor);

  // Blades (3 blades)
  const blade_len = (blade_span / 2) - motor_radius;
  const bladeGeom = new THREE.BoxGeometry(blade_width, blade_len, 0.01);
  
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    const bx = Math.sin(angle) * (motor_radius + blade_len / 2);
    const by = Math.cos(angle) * (motor_radius + blade_len / 2);
    
    addPart(bladeGeom, "blade", bx, by, 0.08, -angle);
  }

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
