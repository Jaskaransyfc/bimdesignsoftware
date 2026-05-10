import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderModularKitchenL = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const kitchen_x_len = Number(m.kitchen_x_len ?? 3.2);
  const kitchen_y_len = Number(m.kitchen_y_len ?? 2.4);
  const counter_depth = Number(m.counter_depth ?? 0.6);
  const counter_height = Number(m.counter_height ?? 0.9);
  const cabinet_height = Number(m.cabinet_height ?? 0.72);
  const overhead_height = Number(m.overhead_height ?? 0.6);
  const overhead_depth = Number(m.overhead_depth ?? 0.35);
  const overhead_gap = Number(m.overhead_gap ?? 0.6);

  const materials = {
    countertop: new THREE.MeshStandardMaterial({
      color: 0xF5F5F5, // White quartz
      metalness: 0.1,
      roughness: 0.2
    }),
    baseCabinets: new THREE.MeshStandardMaterial({
      color: 0x2A3B4C, // Deep blue modern cabinets
      metalness: 0.2,
      roughness: 0.7
    }),
    upperCabinets: new THREE.MeshStandardMaterial({
      color: 0xECECEC, // Light upper cabinets
      metalness: 0.05,
      roughness: 0.8
    }),
    backsplash: new THREE.MeshStandardMaterial({
      color: 0xDDDDDD, // Light grey tile
      metalness: 0.1,
      roughness: 0.3
    }),
    skirting: new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.5,
      roughness: 0.5
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Base Cabinets - Main X Wing
  const xWingGeom = new THREE.BoxGeometry(kitchen_x_len, counter_depth, cabinet_height);
  addPart(xWingGeom, "baseCabinets", kitchen_x_len / 2, counter_depth / 2, 0.1 + cabinet_height / 2);

  // Base Cabinets - Y Wing
  const yWingLen = kitchen_y_len - counter_depth;
  if (yWingLen > 0) {
    const yWingGeom = new THREE.BoxGeometry(counter_depth, yWingLen, cabinet_height);
    addPart(yWingGeom, "baseCabinets", counter_depth / 2, counter_depth + yWingLen / 2, 0.1 + cabinet_height / 2);
  }

  // Skirting
  const xSkirt = new THREE.BoxGeometry(kitchen_x_len, counter_depth * 0.9, 0.1);
  addPart(xSkirt, "skirting", kitchen_x_len / 2, counter_depth / 2 + 0.05, 0.05);

  if (yWingLen > 0) {
    const ySkirt = new THREE.BoxGeometry(counter_depth * 0.9, yWingLen, 0.1);
    addPart(ySkirt, "skirting", counter_depth / 2 + 0.05, counter_depth + yWingLen / 2, 0.05);
  }

  // Countertop - Main X Wing
  const topThickness = 0.04;
  const xTop = new THREE.BoxGeometry(kitchen_x_len, counter_depth, topThickness);
  addPart(xTop, "countertop", kitchen_x_len / 2, counter_depth / 2, counter_height - topThickness / 2);

  // Countertop - Y Wing
  if (yWingLen > 0) {
    const yTop = new THREE.BoxGeometry(counter_depth, yWingLen, topThickness);
    addPart(yTop, "countertop", counter_depth / 2, counter_depth + yWingLen / 2, counter_height - topThickness / 2);
  }

  // Overhead Cabinets - X Wing
  const upperZ = counter_height + overhead_gap;
  const xUpper = new THREE.BoxGeometry(kitchen_x_len, overhead_depth, overhead_height);
  addPart(xUpper, "upperCabinets", kitchen_x_len / 2, overhead_depth / 2, upperZ + overhead_height / 2);

  // Overhead Cabinets - Y Wing
  const yUpperLen = kitchen_y_len - overhead_depth;
  if (yUpperLen > 0) {
    const yUpper = new THREE.BoxGeometry(overhead_depth, yUpperLen, overhead_height);
    addPart(yUpper, "upperCabinets", overhead_depth / 2, overhead_depth + yUpperLen / 2, upperZ + overhead_height / 2);
  }

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  // Offset to place the corner at origin
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
