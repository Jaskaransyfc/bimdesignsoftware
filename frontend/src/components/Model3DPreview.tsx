"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { convert2DTo3D } from "@/lib/geometry3d";
import { Element, Door, Window } from "@/types/modeling";

interface Model3DPreviewProps {
  elements: Element[];
  projectId: string;
}

const PLAN_SCALE = 10;
const MM_SCALE = 500; // Consistent with MM_TO_CANVAS = 50 and PLAN_SCALE = 10

export default function Model3DPreview({
  elements,
  projectId,
}: Model3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1e293b");

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      20000,
    );
    camera.position.set(120, 120, 140);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 20, 0);

    scene.add(new THREE.AmbientLight("#ffffff", 0.7));

    const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
    keyLight.position.set(150, 180, 120);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.45);
    fillLight.position.set(-120, 100, -100);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(800, 80, "#334155", "#334155");
    scene.add(grid);

    const axis = new THREE.AxesHelper(80);
    scene.add(axis);

    const model3D = convert2DTo3D(elements, projectId);
    const wallById = new Map(model3D.walls.map((wall) => [wall.id, wall]));
    const doorById = new Map(
      elements
        .filter((element): element is Door => element.type === "door")
        .map((door) => [door.id, door]),
    );
    const windowById = new Map(
      elements
        .filter((element): element is Window => element.type === "window")
        .map((window_) => [window_.id, window_]),
    );

    const getWallVectors = (wall: {
      startPoint: { x: number; y: number };
      endPoint: { x: number; y: number };
    }) => {
      const dx = (wall.endPoint.x - wall.startPoint.x) / PLAN_SCALE;
      const dz = (wall.endPoint.y - wall.startPoint.y) / PLAN_SCALE;
      const len = Math.hypot(dx, dz) || 1;
      const dir = { x: dx / len, z: dz / len };
      const normal = { x: -dir.z, z: dir.x };
      return { dir, normal };
    };

    const wallToOpeningMap = new Map<string, (Door | Window)[]>();
    elements.forEach((el) => {
      if (el.type === "door" || el.type === "window") {
        const opening = el as Door | Window;
        if (opening.wallId) {
          const list = wallToOpeningMap.get(opening.wallId) || [];
          list.push(opening);
          wallToOpeningMap.set(opening.wallId, list);
        }
      }
    });

    model3D.walls.forEach((wall) => {
      const dx = wall.endPoint.x - wall.startPoint.x;
      const dy = wall.endPoint.y - wall.startPoint.y;
      const length = Math.sqrt(dx * dx + dy * dy) / PLAN_SCALE;
      const thickness = wall.thickness / MM_SCALE;
      const height = wall.height / MM_SCALE;

      const openings = wallToOpeningMap.get(wall.id) || [];

      // Create a shape for the wall face
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(length, 0);
      shape.lineTo(length, height);
      shape.lineTo(0, height);
      shape.closePath();

      // Add holes for doors and windows
      openings.forEach((op) => {
        const opW = op.width / MM_SCALE;
        const opH = op.height / MM_SCALE;

        // Calculate offset from wall start
        const dist =
          Math.hypot(
            op.position.x - wall.startPoint.x,
            op.position.y - wall.startPoint.y,
          ) / PLAN_SCALE;
        const sillH =
          (op.type === "window" ? (op as any).position.z || 1000 : 0) /
          MM_SCALE;

        const hole = new THREE.Path();
        const xStart = dist - opW / 2;
        hole.moveTo(xStart, sillH);
        hole.lineTo(xStart + opW, sillH);
        hole.lineTo(xStart + opW, sillH + opH);
        hole.lineTo(xStart, sillH + opH);
        hole.closePath();
        shape.holes.push(hole);
      });

      const geometry = new (THREE as any).ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
      });
      const material = new THREE.MeshStandardMaterial({
        color: "#d4a574",
        roughness: 0.85,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Position: Start point, centered on thickness
      mesh.position.set(
        wall.startPoint.x / PLAN_SCALE,
        0,
        wall.startPoint.y / PLAN_SCALE,
      );
      mesh.rotation.y = -Math.atan2(dy, dx);

      // Offset by half thickness to center the wall on the line
      const angle = -Math.atan2(dy, dx);
      mesh.position.x += Math.sin(angle) * (thickness / 2);
      mesh.position.z += Math.cos(angle) * (thickness / 2);

      scene.add(mesh);

      // Add corner fillers (columns) to hide gaps between walls
      const fillerGeom = new THREE.BoxGeometry(thickness, height, thickness);
      const fillerMat = material;

      const startFiller = new THREE.Mesh(fillerGeom, fillerMat);
      startFiller.position.set(
        wall.startPoint.x / PLAN_SCALE,
        height / 2,
        wall.startPoint.y / PLAN_SCALE,
      );
      scene.add(startFiller);

      const endFiller = new THREE.Mesh(fillerGeom, fillerMat);
      endFiller.position.set(
        wall.endPoint.x / PLAN_SCALE,
        height / 2,
        wall.endPoint.y / PLAN_SCALE,
      );
      scene.add(endFiller);
    });

    model3D.doors.forEach((door) => {
      const doorW = Math.max(door.width / MM_SCALE, 0.1);
      const doorH = Math.max(door.height / MM_SCALE, 0.1);
      const hostWall = door.wallId ? wallById.get(door.wallId) : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;

      const doorLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.05, doorH - 0.05, 0.2),
        new THREE.MeshStandardMaterial({
          color: "#7c2d12",
          roughness: 0.55,
          metalness: 0.1,
        }),
      );

      const px_base = door.position.x / PLAN_SCALE;
      const pz_base = door.position.y / PLAN_SCALE;

      // Apply the same offset as the wall to center it
      const angle = hostWall
        ? -Math.atan2(
            hostWall.endPoint.y - hostWall.startPoint.y,
            hostWall.endPoint.x - hostWall.startPoint.x,
          )
        : 0;
      const wallThickness = hostWall ? hostWall.thickness / MM_SCALE : 0.46;
      const px = px_base + Math.sin(angle) * (wallThickness / 2);
      const pz = pz_base + Math.cos(angle) * (wallThickness / 2);

      doorLeaf.position.set(px, doorH / 2, pz);
      if (vectors) {
        doorLeaf.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      }
      scene.add(doorLeaf);

      // Add a small handle for visibility
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05),
        new THREE.MeshStandardMaterial({ color: "#fbbf24" }),
      );
      handle.position.set(
        px + (vectors?.dir.x || 0) * (doorW * 0.4),
        doorH / 2,
        pz + (vectors?.dir.z || 0) * (doorW * 0.4),
      );
      scene.add(handle);

      // Create frame as a dark wooden border
      const frameColor = "#522b11";
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: 0.7,
      });
      const frameThickness = hostWall
        ? hostWall.thickness / MM_SCALE + 0.05
        : 0.5;

      // Top frame
      const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(doorW + 0.1, 0.1, frameThickness),
        frameMaterial,
      );
      topFrame.position.set(px, doorH + 0.05, pz);
      if (vectors)
        topFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(topFrame);

      // Left frame
      const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, doorH, frameThickness),
        frameMaterial,
      );
      const lx = px - (vectors?.dir.x || 0) * (doorW / 2 + 0.05);
      const lz = pz - (vectors?.dir.z || 0) * (doorW / 2 + 0.05);
      leftFrame.position.set(lx, doorH / 2, lz);
      if (vectors)
        leftFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(leftFrame);

      // Right frame
      const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, doorH, frameThickness),
        frameMaterial,
      );
      const rx = px + (vectors?.dir.x || 0) * (doorW / 2 + 0.05);
      const rz = pz + (vectors?.dir.z || 0) * (doorW / 2 + 0.05);
      rightFrame.position.set(rx, doorH / 2, rz);
      if (vectors)
        rightFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(rightFrame);
    });

    model3D.windows.forEach((window_) => {
      const winW = Math.max(window_.width / MM_SCALE, 0.1);
      const winH = Math.max(window_.height / MM_SCALE, 0.1);
      const hostWall = window_.wallId
        ? wallById.get(window_.wallId)
        : undefined;
      const vectors = hostWall ? getWallVectors(hostWall) : null;
      const sillHeight = (window_.position.z || 1000) / MM_SCALE;

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.8,
      });

      // Window frame (simplified as a hollow border using 4 boxes)
      const fT = 0.1; // frame thickness
      const frameThickness = hostWall
        ? hostWall.thickness / MM_SCALE + 0.02
        : 0.48;
      const winFrame = new THREE.Group();

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(winW + fT, fT, frameThickness),
        frameMaterial,
      );
      top.position.y = winH / 2 + fT / 2;

      const bottom = new THREE.Mesh(
        new THREE.BoxGeometry(winW + fT, fT, frameThickness),
        frameMaterial,
      );
      bottom.position.y = -winH / 2 - fT / 2;

      const left = new THREE.Mesh(
        new THREE.BoxGeometry(fT, winH, frameThickness),
        frameMaterial,
      );
      left.position.x = -winW / 2 - fT / 2;

      const right = new THREE.Mesh(
        new THREE.BoxGeometry(fT, winH, frameThickness),
        frameMaterial,
      );
      right.position.x = winW / 2 + fT / 2;

      winFrame.add(top, bottom, left, right);

      const px_base = window_.position.x / PLAN_SCALE;
      const pz_base = window_.position.y / PLAN_SCALE;
      const angle = hostWall
        ? -Math.atan2(
            hostWall.endPoint.y - hostWall.startPoint.y,
            hostWall.endPoint.x - hostWall.startPoint.x,
          )
        : 0;
      const wallThickness = hostWall ? hostWall.thickness / MM_SCALE : 0.46;
      const px = px_base + Math.sin(angle) * (wallThickness / 2);
      const pz = pz_base + Math.cos(angle) * (wallThickness / 2);

      winFrame.position.set(px, sillHeight + winH / 2, pz);
      if (vectors)
        winFrame.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      scene.add(winFrame);

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(winW - 0.05, winH - 0.05, 0.1),
        new THREE.MeshStandardMaterial({
          color: "#7dd3fc",
          transparent: true,
          opacity: 0.5,
          roughness: 0.2,
          metalness: 0.15,
        }),
      );
      glass.position.set(px, sillHeight + winH / 2, pz);
      if (vectors) {
        glass.rotation.y = -Math.atan2(vectors.dir.z, vectors.dir.x);
      }
      scene.add(glass);
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: "#0f172a", side: 2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    const onResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let rafId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [elements, projectId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
