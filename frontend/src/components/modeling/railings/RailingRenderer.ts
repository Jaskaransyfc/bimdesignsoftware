import * as THREE from "three";
import { Railing, Point2D } from "@/types/modeling";

const MM_SCALE = 500;

export const renderRailing = (
  scene: THREE.Scene,
  railing: Railing,
  isSelected: boolean
) => {
  const group = new THREE.Group();
  const style = railing.style || "modern_metal";
  const height = railing.height / MM_SCALE || 1.1;
  const baseElevation = (railing.baseElevation || 0) / MM_SCALE;
  const path = railing.path;

  if (path.length < 2) return null;

  group.position.y = baseElevation;

  if (style === "glass_panel") {
    renderGlassPanelRailing(group, path, height, isSelected, railing.color);
  } else if (style === "organic_branch") {
    renderOrganicBranchRailing(group, path, height, isSelected, railing.color);
  } else {
    renderModernMetalRailing(group, path, height, isSelected, railing.color);
  }

  scene.add(group);
  return group;
};

// --- MODERN METAL RAILING ---
const renderModernMetalRailing = (
  group: THREE.Group,
  path: Point2D[],
  height: number,
  isSelected: boolean,
  color?: string
) => {
  const mat = new THREE.MeshStandardMaterial({
    color: isSelected ? 0x3b82f6 : (color || 0x2c3e50),
    metalness: 0.8,
    roughness: 0.2
  });

  const frameW = 0.05;
  const postW = 0.06;
  const barW = 0.02;
  const barGap = 0.12;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = new THREE.Vector2(path[i].x / 10, path[i].y / 10);
    const p2 = new THREE.Vector2(path[i+1].x / 10, path[i+1].y / 10);
    const dist = p1.distanceTo(p2);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const segmentGroup = new THREE.Group();
    segmentGroup.position.set(p1.x, 0, p1.y);
    segmentGroup.rotation.y = -angle;

    // Top Rail
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.04, frameW), mat);
    topRail.position.set(dist / 2, height - 0.02, 0);
    segmentGroup.add(topRail);

    // Bottom Rail
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.03, frameW), mat);
    botRail.position.set(dist / 2, 0.08, 0);
    segmentGroup.add(botRail);

    // Posts
    const postGeom = new THREE.BoxGeometry(postW, height, postW);
    const startPost = new THREE.Mesh(postGeom, mat);
    startPost.position.set(0, height / 2, 0);
    segmentGroup.add(startPost);

    if (i === path.length - 2) {
      const endPost = new THREE.Mesh(postGeom, mat);
      endPost.position.set(dist, height / 2, 0);
      segmentGroup.add(endPost);
    }

    // Vertical Bars
    const nBars = Math.floor(dist / (barW + barGap));
    const actualGap = dist / (nBars + 1);
    for (let j = 1; j <= nBars; j++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barW, height - 0.15, barW), mat);
      bar.position.set(j * actualGap, height / 2 + 0.03, 0);
      segmentGroup.add(bar);
    }

    group.add(segmentGroup);
  }
};

// --- GLASS PANEL RAILING ---
const renderGlassPanelRailing = (
  group: THREE.Group,
  path: Point2D[],
  height: number,
  isSelected: boolean,
  color?: string
) => {
  const metalMat = new THREE.MeshStandardMaterial({
    color: isSelected ? 0x3b82f6 : 0xbdc3c7,
    metalness: 0.9,
    roughness: 0.1
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xadd8e6,
    transparent: true,
    opacity: 0.3,
    metalness: 0.2,
    roughness: 0.05
  });

  const railR = 0.025;
  const glassThk = 0.012;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = new THREE.Vector2(path[i].x / 10, path[i].y / 10);
    const p2 = new THREE.Vector2(path[i+1].x / 10, path[i+1].y / 10);
    const dist = p1.distanceTo(p2);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const segmentGroup = new THREE.Group();
    segmentGroup.position.set(p1.x, 0, p1.y);
    segmentGroup.rotation.y = -angle;

    // Glass Panel
    const glass = new THREE.Mesh(new THREE.BoxGeometry(dist, height - 0.1, glassThk), glassMat);
    glass.position.set(dist / 2, height / 2 + 0.02, 0);
    segmentGroup.add(glass);

    // Top Handrail (Cylinder)
    const handrail = new THREE.Mesh(new THREE.CylinderGeometry(railR, railR, dist, 12), metalMat);
    handrail.rotation.z = Math.PI / 2;
    handrail.position.set(dist / 2, height, 0);
    segmentGroup.add(handrail);

    // Clamps/Posts
    const postGeom = new THREE.CylinderGeometry(0.02, 0.02, height, 12);
    const p1Post = new THREE.Mesh(postGeom, metalMat);
    p1Post.position.set(0, height / 2, 0);
    segmentGroup.add(p1Post);

    if (i === path.length - 2) {
      const p2Post = new THREE.Mesh(postGeom, metalMat);
      p2Post.position.set(dist, height / 2, 0);
      segmentGroup.add(p2Post);
    }

    group.add(segmentGroup);
  }
};

// --- ORGANIC BRANCH RAILING ---
const renderOrganicBranchRailing = (
  group: THREE.Group,
  path: Point2D[],
  height: number,
  isSelected: boolean,
  color?: string
) => {
  const metalMat = new THREE.MeshStandardMaterial({
    color: isSelected ? 0x3b82f6 : 0x2c3e50,
    metalness: 0.6,
    roughness: 0.4
  });
  const branchMat = new THREE.MeshStandardMaterial({
    color: 0x4b3621,
    roughness: 0.9,
    metalness: 0.1
  });

  const railR = 0.02;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = new THREE.Vector2(path[i].x / 10, path[i].y / 10);
    const p2 = new THREE.Vector2(path[i+1].x / 10, path[i+1].y / 10);
    const dist = p1.distanceTo(p2);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const segmentGroup = new THREE.Group();
    segmentGroup.position.set(p1.x, 0, p1.y);
    segmentGroup.rotation.y = -angle;

    // Frame
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(railR, railR, dist, 12), metalMat);
    topRail.rotation.z = Math.PI / 2;
    topRail.position.set(dist / 2, height, 0);
    segmentGroup.add(topRail);

    const botRail = new THREE.Mesh(new THREE.CylinderGeometry(railR, railR, dist, 12), metalMat);
    botRail.rotation.z = Math.PI / 2;
    botRail.position.set(dist / 2, 0.1, 0);
    segmentGroup.add(botRail);

    const postGeom = new THREE.CylinderGeometry(0.03, 0.03, height, 12);
    const p1Post = new THREE.Mesh(postGeom, metalMat);
    p1Post.position.set(0, height / 2, 0);
    segmentGroup.add(p1Post);

    if (i === path.length - 2) {
      const p2Post = new THREE.Mesh(postGeom, metalMat);
      p2Post.position.set(dist, height / 2, 0);
      segmentGroup.add(p2Post);
    }

    // Branches
    const nTrunks = Math.floor(dist / 0.8) + 1;
    const trunkGap = dist / (nTrunks + 1);
    for (let t = 1; t <= nTrunks; t++) {
      const trunkStart = new THREE.Vector3(t * trunkGap, 0.1, 0);
      makeBranchRecursive(segmentGroup, trunkStart, new THREE.Vector3(0, 1, 0), height * 0.6, 4, branchMat);
    }

    group.add(segmentGroup);
  }
};

const makeBranchRecursive = (
  parent: THREE.Object3D,
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  depth: number,
  material: THREE.Material
) => {
  if (depth === 0 || length < 0.05) return;

  const end = start.clone().add(dir.clone().multiplyScalar(length));
  
  // Cylinder for segment
  const segmentGeom = new THREE.CylinderGeometry(0.012 * (depth/4), 0.012 * (depth/4), length, 8);
  const mesh = new THREE.Mesh(segmentGeom, material);
  
  // Orient cylinder between start and end
  const center = start.clone().lerp(end, 0.5);
  mesh.position.copy(center);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(mesh);

  // Spawn children
  const nChildren = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < nChildren; i++) {
    const nextDir = dir.clone().applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (Math.random() - 0.5) * 1.5
    ).applyAxisAngle(
      new THREE.Vector3(1, 0, 0),
      (Math.random() - 0.5) * 0.5
    );
    makeBranchRecursive(parent, end, nextDir, length * (0.6 + Math.random() * 0.2), depth - 1, material);
  }
};
