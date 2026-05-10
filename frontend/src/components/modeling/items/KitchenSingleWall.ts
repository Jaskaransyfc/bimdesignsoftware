import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderKitchenSingleWall = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const kitchen_len = Number(m.kitchen_len ?? 3.6);
  const counter_depth = Number(m.counter_depth ?? 0.6);
  const counter_height = Number(m.counter_height ?? 0.9);
  const cabinet_height = Number(m.cabinet_height ?? 0.72);
  const overhead_height = Number(m.overhead_height ?? 0.6);
  const overhead_depth = Number(m.overhead_depth ?? 0.35);
  const overhead_gap = Number(m.overhead_gap ?? 0.6);

  const materials = {
    countertop: new THREE.MeshStandardMaterial({
      color: 0xE8E8E8, // Light marble
      metalness: 0.1,
      roughness: 0.2
    }),
    baseCabinets: new THREE.MeshStandardMaterial({
      color: 0x4A5043, // Olive grey
      metalness: 0.1,
      roughness: 0.8
    }),
    upperCabinets: new THREE.MeshStandardMaterial({
      color: 0xFAFAFA, // White upper
      metalness: 0.05,
      roughness: 0.9
    }),
    backsplash: new THREE.MeshStandardMaterial({
      color: 0xCCCCCC, // Subtle tile
      metalness: 0.1,
      roughness: 0.3
    }),
    skirting: new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.6,
      roughness: 0.6
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

  // Base Cabinets
  const baseGeom = new THREE.BoxGeometry(kitchen_len, counter_depth, cabinet_height);
  addPart(baseGeom, "baseCabinets", 0, counter_depth / 2, 0.1 + cabinet_height / 2);

  // Skirting
  const skirtGeom = new THREE.BoxGeometry(kitchen_len, counter_depth * 0.9, 0.1);
  addPart(skirtGeom, "skirting", 0, counter_depth / 2 + 0.05, 0.05);

  // Countertop
  const topThickness = 0.04;
  const topGeom = new THREE.BoxGeometry(kitchen_len, counter_depth, topThickness);
  addPart(topGeom, "countertop", 0, counter_depth / 2, counter_height - topThickness / 2);

  // Overhead Cabinets
  const upperZ = counter_height + overhead_gap;
  const upperGeom = new THREE.BoxGeometry(kitchen_len, overhead_depth, overhead_height);
  addPart(upperGeom, "upperCabinets", 0, overhead_depth / 2, upperZ + overhead_height / 2);

  // Backsplash
  const splashZ = counter_height;
  const splashGeom = new THREE.BoxGeometry(kitchen_len, 0.02, overhead_gap);
  addPart(splashGeom, "backsplash", 0, 0.01, splashZ + overhead_gap / 2);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
