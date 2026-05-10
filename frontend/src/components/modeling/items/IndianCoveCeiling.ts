import * as THREE from "three";
import { FurnitureItem } from "@/types/modeling";

export const renderIndianCoveCeiling = (
  scene: THREE.Scene,
  item: FurnitureItem,
  isSelected: boolean
) => {
  const group = new THREE.Group();

  const m = item.metadata || {};
  const room_width = Number(m.room_width ?? 4.0);
  const room_depth = Number(m.room_depth ?? 5.0);
  const cove_width = Number(m.cove_width ?? 0.5);
  const drop_depth = Number(m.drop_depth ?? 0.2);
  const corner_size = Number(m.corner_size ?? 0.8);

  const materials = {
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xFAFAFA, // Pure white
      metalness: 0.0,
      roughness: 0.95
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0x6E4C30, // Rich warm wood for traditional look
      metalness: 0.05,
      roughness: 0.7
    }),
    cove_light: new THREE.MeshBasicMaterial({
      color: 0xFFB347, // Warm golden/yellowish light emission
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

  // Peripheral Cove Drop
  const topBox = new THREE.BoxGeometry(room_width, cove_width, drop_depth);
  const bottomBox = new THREE.BoxGeometry(room_width, cove_width, drop_depth);
  const inner_d = room_depth - cove_width * 2;
  const leftBox = new THREE.BoxGeometry(cove_width, inner_d, drop_depth);
  const rightBox = new THREE.BoxGeometry(cove_width, inner_d, drop_depth);

  addPart(topBox, "ceiling", 0, room_depth / 2 - cove_width / 2, -drop_depth / 2);
  addPart(bottomBox, "ceiling", 0, -room_depth / 2 + cove_width / 2, -drop_depth / 2);
  addPart(leftBox, "ceiling", -room_width / 2 + cove_width / 2, 0, -drop_depth / 2);
  addPart(rightBox, "ceiling", room_width / 2 - cove_width / 2, 0, -drop_depth / 2);

  // Center Decorative Wood Panel
  const wood_w = room_width - cove_width * 2 - 0.4;
  const wood_d = room_depth - cove_width * 2 - 0.4;
  const centerWood = new THREE.BoxGeometry(wood_w, wood_d, 0.05);
  addPart(centerWood, "wood", 0, 0, -0.05 / 2);

  // Golden Light Strip
  const light_w = wood_w + 0.1;
  const light_d = wood_d + 0.1;
  const lightGap = 0.05;

  const lightTop = new THREE.BoxGeometry(light_w, lightGap, 0.02);
  const lightBottom = new THREE.BoxGeometry(light_w, lightGap, 0.02);
  const lightLeft = new THREE.BoxGeometry(lightGap, wood_d, 0.02);
  const lightRight = new THREE.BoxGeometry(lightGap, wood_d, 0.02);

  addPart(lightTop, "cove_light", 0, light_d / 2 - lightGap / 2, -0.05);
  addPart(lightBottom, "cove_light", 0, -light_d / 2 + lightGap / 2, -0.05);
  addPart(lightLeft, "cove_light", -light_w / 2 + lightGap / 2, 0, -0.05);
  addPart(lightRight, "cove_light", light_w / 2 - lightGap / 2, 0, -0.05);

  // Corner Accents (Typical in Indian interior design)
  const cornerGeom = new THREE.BoxGeometry(corner_size, corner_size, drop_depth * 1.1);
  const cx = room_width / 2 - cove_width / 2;
  const cy = room_depth / 2 - cove_width / 2;
  addPart(cornerGeom, "wood", cx, cy, -drop_depth / 2);
  addPart(cornerGeom, "wood", -cx, cy, -drop_depth / 2);
  addPart(cornerGeom, "wood", cx, -cy, -drop_depth / 2);
  addPart(cornerGeom, "wood", -cx, -cy, -drop_depth / 2);

  // Rotate to handle FreeCAD Z-up to ThreeJS Y-up
  const outerGroup = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  outerGroup.add(group);
  
  outerGroup.userData = { id: item.id, type: "FurnitureItem" };
  return outerGroup;
};
