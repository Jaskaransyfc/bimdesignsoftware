import * as THREE from "three";

const MM_SCALE = 500;

export const renderFloatingSwitchbackStairs = (
  scene: THREE.Scene,
  px: number,
  pz: number,
  width: number,
  height: number,
  rotation: number = 0,
  isSelected?: boolean,
  color?: string,
) => {
  const stairGroup = new THREE.Group();
  stairGroup.rotation.y = (rotation * Math.PI) / 180;

  // DIMENSIONS (translated to world units where 1m = 2 units)
  const totalWidth = width / MM_SCALE;
  const totalHeight = height / MM_SCALE;
  
  const treadWidth = (totalWidth - 0.2) / 2; // Split width between two flights with a gap
  const flightGap = 0.2; 
  const run = 0.3 * 2; // standard run ~300mm
  const treadThick = 0.08;
  
  const lowerSteps = 10;
  const upperSteps = 10;
  const totalSteps = lowerSteps + upperSteps;
  const stepRise = totalHeight / (totalSteps + 1);

  const woodMat = new THREE.MeshStandardMaterial({
    color: isSelected ? "#3b82f6" : (color || "#8B4513"),
    roughness: 0.3,
    metalness: 0.1,
    emissive: isSelected ? "#1d4ed8" : "#000000",
    emissiveIntensity: isSelected ? 0.3 : 0,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#a5d8ff",
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    metalness: 0.1,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: "#2d2d2d",
    metalness: 0.9,
    roughness: 0.1,
  });

  // 1. LOWER FLIGHT
  const lowerFlightGroup = new THREE.Group();
  for (let i = 0; i < lowerSteps; i++) {
    const x = i * run;
    const y = i * stepRise;
    
    // Tread
    const treadGeom = new THREE.BoxGeometry(run, treadThick, treadWidth);
    const tread = new THREE.Mesh(treadGeom, woodMat);
    tread.position.set(x + run / 2, y, 0);
    lowerFlightGroup.add(tread);

    // Stringer (side support)
    const stringerGeom = new THREE.BoxGeometry(run, 0.4, 0.05);
    const leftStringer = new THREE.Mesh(stringerGeom, metalMat);
    leftStringer.position.set(x + run / 2, y - 0.15, -treadWidth/2 - 0.025);
    lowerFlightGroup.add(leftStringer);
  }
  
  // Lower Flight Railing (Glass)
  const lowerRailGeom = new THREE.BoxGeometry(lowerSteps * run, 0.9, 0.01);
  const lowerRail = new THREE.Mesh(lowerRailGeom, glassMat);
  lowerRail.position.set((lowerSteps * run) / 2, (lowerSteps * stepRise) / 2 + 0.5, -treadWidth/2 - 0.05);
  lowerFlightGroup.add(lowerRail);

  // Metal Cap for lower rail
  const lowerCapGeom = new THREE.BoxGeometry(lowerSteps * run, 0.04, 0.04);
  const lowerCap = new THREE.Mesh(lowerCapGeom, metalMat);
  lowerCap.position.set((lowerSteps * run) / 2, lowerSteps * stepRise / 2 + 1.0, -treadWidth/2 - 0.05);
  lowerFlightGroup.add(lowerCap);

  lowerFlightGroup.position.set(0, 0, -treadWidth / 2 - flightGap / 2);
  stairGroup.add(lowerFlightGroup);

  // 2. LANDING
  const landingWidth = 1.2 * 2;
  const landingDepth = totalWidth;
  const landingX = lowerSteps * run;
  const landingY = lowerSteps * stepRise;

  const landingGeom = new THREE.BoxGeometry(landingWidth, treadThick, landingDepth);
  const landing = new THREE.Mesh(landingGeom, woodMat);
  landing.position.set(landingX + landingWidth / 2, landingY, 0);
  stairGroup.add(landing);

  // 3. UPPER FLIGHT
  const upperFlightGroup = new THREE.Group();
  for (let i = 0; i < upperSteps; i++) {
    const x = landingX - (i * run);
    const y = landingY + (i + 1) * stepRise;

    const treadGeom = new THREE.BoxGeometry(run, treadThick, treadWidth);
    const tread = new THREE.Mesh(treadGeom, woodMat);
    tread.position.set(x - run / 2, y, 0);
    upperFlightGroup.add(tread);

    // Stringer
    const stringerGeom = new THREE.BoxGeometry(run, 0.4, 0.05);
    const rightStringer = new THREE.Mesh(stringerGeom, metalMat);
    rightStringer.position.set(x - run / 2, y - 0.15, treadWidth/2 + 0.025);
    upperFlightGroup.add(rightStringer);
  }

  // Upper Flight Railing
  const upperRailGeom = new THREE.BoxGeometry(upperSteps * run, 0.9, 0.01);
  const upperRail = new THREE.Mesh(upperRailGeom, glassMat);
  upperRail.position.set(landingX - (upperSteps * run) / 2, landingY + (upperSteps * stepRise) / 2 + 1.0, treadWidth/2 + 0.05);
  upperFlightGroup.add(upperRail);

  upperFlightGroup.position.set(0, 0, treadWidth / 2 + flightGap / 2);
  stairGroup.add(upperFlightGroup);

  // FINAL POSITIONING
  stairGroup.position.set(px, 0, pz);
  scene.add(stairGroup);
};
