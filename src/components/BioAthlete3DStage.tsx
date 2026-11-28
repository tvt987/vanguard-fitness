import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  BODY_SYSTEM_ORDER,
  computeBioTelemetry,
  computeGaitPose,
  DEFAULT_BIO_STUDIO_STATE,
  injectOvertrainingSpike,
  MAX_POWER_W,
  MIN_POWER_W,
  POWER_PRESETS,
  prescribeAutonomicDeload,
  type BioCameraMode,
  type BioProtocolMode,
  type BioStudioState,
  type BioTelemetrySnapshot,
  type BodySystemId,
} from '../engines/bioAthlete3dEngine';
import type { Lang } from '../i18n/translations';
import {
  AlertTriangleIcon,
  CameraSideIcon,
  HeartPulseIcon,
  OrbitIcon,
  PulseIcon,
  ScanXRayIcon,
  ShieldIcon,
  ZapIcon,
} from './Icons';

export interface BioAthlete3DStageProps {
  lang: Lang;
  dark: boolean;
  onTelemetryChange?: (
    telemetry: BioTelemetrySnapshot,
    protocolMode: BioProtocolMode
  ) => void;
}

interface ArterialBeadSpec {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  offset: number;
  speedScale: number;
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fog: THREE.Fog;
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  heartPointLight: THREE.PointLight;
  floorMat: THREE.MeshStandardMaterial;
  plinthMat: THREE.MeshStandardMaterial;
  bezelMat: THREE.MeshStandardMaterial;
  trackDeckMat: THREE.MeshStandardMaterial;
  zoneRingMat: THREE.MeshStandardMaterial;
  shellMats: THREE.MeshPhysicalMaterial[];
  xrayWireMats: THREE.MeshBasicMaterial[];
  jointRingMat: THREE.MeshStandardMaterial;
  shoeAccentMat: THREE.MeshStandardMaterial;
  wristBandMat: THREE.MeshStandardMaterial;
  muscleMats: Record<BodySystemId, THREE.MeshStandardMaterial>;
  heartMat: THREE.MeshStandardMaterial;
  lungMat: THREE.MeshStandardMaterial;
  sternumBeaconMat: THREE.MeshStandardMaterial;
  arterialTubeMat: THREE.MeshBasicMaterial;
  arterialBeadMat: THREE.MeshBasicMaterial;
  spineMat: THREE.MeshStandardMaterial;
  warningRingMats: THREE.MeshBasicMaterial[];
  warningPulseMats: THREE.MeshBasicMaterial[];
  warningGroups: THREE.Group[];
  beltSlats: THREE.Mesh[];
  leftFootRipple: THREE.Mesh;
  rightFootRipple: THREE.Mesh;
  leftFootRippleMat: THREE.MeshBasicMaterial;
  rightFootRippleMat: THREE.MeshBasicMaterial;
  arterialBeads: ArterialBeadSpec[];
  pickables: THREE.Object3D[];
  // Articulated rig nodes
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  heartGroup: THREE.Group;
  lungsGroup: THREE.Group;
  leftShoulderGroup: THREE.Group;
  leftElbowGroup: THREE.Group;
  rightShoulderGroup: THREE.Group;
  rightElbowGroup: THREE.Group;
  leftHipGroup: THREE.Group;
  leftKneeGroup: THREE.Group;
  leftAnkleGroup: THREE.Group;
  rightHipGroup: THREE.Group;
  rightKneeGroup: THREE.Group;
  rightAnkleGroup: THREE.Group;
  internalOrganGroup: THREE.Group;
}

function tagPickable(
  obj: THREE.Object3D,
  systemId: BodySystemId,
  pickables: THREE.Object3D[]
): void {
  obj.userData.bodySystem = systemId;
  pickables.push(obj);
}

const BioAthlete3DStage: React.FC<BioAthlete3DStageProps> = ({
  lang,
  dark,
  onTelemetryChange,
}) => {
  const [studioState, setStudioState] = useState<BioStudioState>(
    DEFAULT_BIO_STUDIO_STATE
  );
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const stateRef = useRef<BioStudioState>(studioState);
  const darkRef = useRef<boolean>(dark);

  const telemetry = useMemo(
    () => computeBioTelemetry(studioState.intensityW, studioState.acwr),
    [studioState.intensityW, studioState.acwr]
  );

  const telemetryRef = useRef<BioTelemetrySnapshot>(telemetry);

  useEffect(() => {
    stateRef.current = studioState;
  }, [studioState]);

  useEffect(() => {
    telemetryRef.current = telemetry;
    onTelemetryChange?.(telemetry, studioState.protocolMode);
  }, [telemetry, studioState.protocolMode, onTelemetryChange]);

  useEffect(() => {
    darkRef.current = dark;
  }, [dark]);

  // Smooth interactive orbit & camera state kept in refs for 60fps zero-rerender loop
  const orbitRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    dragDist: 0,
    userYawOffset: 0,
    userPitchOffset: 0,
    currentYaw: 0.62,
    currentPitch: 0.16,
    currentDist: 3.75,
    currentTargetX: 0.24,
    currentTargetY: 1.04,
  });

  // Reset manual drag offset whenever camera preset changes cleanly
  const selectCameraMode = (mode: BioCameraMode) => {
    orbitRef.current.userYawOffset = 0;
    orbitRef.current.userPitchOffset = 0;
    setStudioState((prev) => ({ ...prev, cameraMode: mode }));
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initBg = darkRef.current ? 0x0b0e14 : 0xf1f2ee;
    scene.background = new THREE.Color(initBg);
    const fog = new THREE.Fog(initBg, 7.2, 16.5);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 40);

    // 3-Point Swiss Architectural Studio Lighting
    const hemiLight = new THREE.HemisphereLight(
      0xffffff,
      darkRef.current ? 0x161c28 : 0xd9ddd6,
      darkRef.current ? 1.15 : 1.48
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffdf8, 1.85);
    keyLight.position.set(3.4, 6.2, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.8;
    keyLight.shadow.camera.right = 2.8;
    keyLight.shadow.camera.top = 2.8;
    keyLight.shadow.camera.bottom = -2.8;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.95);
    rimLight.position.set(-4.2, 3.2, -3.4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xfef3c7, 0.42);
    fillLight.position.set(3.2, 1.5, -2.5);
    scene.add(fillLight);

    const heartPointLight = new THREE.PointLight(0x10b981, 1.2, 2.4, 1.8);
    heartPointLight.position.set(0.05, 1.38, 0.18);
    scene.add(heartPointLight);

    // =========================================================================
    // 1. CALIBRATED ARCHITECTURAL BIOMECHANICS LAB FLOOR & CIRCULAR TREADMILL
    // =========================================================================
    const floorMat = new THREE.MeshStandardMaterial({
      color: darkRef.current ? 0x0b0e14 : 0xf1f2ee,
      roughness: 0.92,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(14, 64), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.085;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const plinthMat = new THREE.MeshStandardMaterial({
      color: darkRef.current ? 0x141923 : 0xe3e5df,
      roughness: 0.48,
      metalness: 0.16,
    });
    const plinthMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.68, 1.82, 0.09, 64),
      plinthMat
    );
    plinthMesh.position.y = -0.045;
    plinthMesh.receiveShadow = true;
    scene.add(plinthMesh);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: darkRef.current ? 0x263143 : 0xbec5be,
      roughness: 0.28,
      metalness: 0.65,
    });
    const outerBezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.022, 16, 96),
      bezelMat
    );
    outerBezel.rotation.x = Math.PI / 2;
    outerBezel.position.y = 0.002;
    scene.add(outerBezel);

    // Live thermal zone halo ring around circular treadmill
    const zoneRingMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.3,
    });
    const zoneRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.56, 0.012, 12, 96),
      zoneRingMat
    );
    zoneRing.rotation.x = Math.PI / 2;
    zoneRing.position.y = 0.006;
    scene.add(zoneRing);

    // Concentric calibration dial rings & 36 Swiss precision tick marks
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.38,
    });
    for (const r of [1.14, 1.36, 1.94]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.004, r + 0.004, 96),
        tickMat
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.003;
      scene.add(ring);
    }

    const tickGeoMajor = new THREE.BoxGeometry(0.014, 0.004, 0.11);
    const tickGeoMinor = new THREE.BoxGeometry(0.008, 0.004, 0.055);
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const isMajor = i % 3 === 0;
      const tick = new THREE.Mesh(isMajor ? tickGeoMajor : tickGeoMinor, tickMat);
      const rad = 1.46;
      tick.position.set(Math.sin(angle) * rad, 0.004, Math.cos(angle) * rad);
      tick.rotation.y = angle;
      scene.add(tick);
    }

    // Recessed carbon running deck
    const trackDeckMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      roughness: 0.62,
      metalness: 0.25,
    });
    const trackDeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.018, 2.24),
      trackDeckMat
    );
    trackDeck.position.y = -0.002;
    trackDeck.receiveShadow = true;
    scene.add(trackDeck);

    // Subtle glowing side track guide rails
    const railGeo = new THREE.BoxGeometry(0.018, 0.01, 2.24);
    for (const sx of [-0.43, 0.43]) {
      const rail = new THREE.Mesh(railGeo, zoneRingMat);
      rail.position.set(sx, 0.005, 0);
      scene.add(rail);
    }

    // 12 Animated calibrated velocity slats gliding beneath the runner
    const beltSlats: THREE.Mesh[] = [];
    const slatGeo = new THREE.BoxGeometry(0.74, 0.005, 0.022);
    const slatMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.34,
    });
    for (let i = 0; i < 12; i++) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(0, 0.009, -1.04 + (i / 12) * 2.08);
      scene.add(slat);
      beltSlats.push(slat);
    }

    // Dynamic footstrike ground-reaction force ripples
    const leftFootRippleMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rightFootRippleMat = leftFootRippleMat.clone();
    const rippleGeo = new THREE.RingGeometry(0.08, 0.14, 32);
    const leftFootRipple = new THREE.Mesh(rippleGeo, leftFootRippleMat);
    leftFootRipple.rotation.x = -Math.PI / 2;
    leftFootRipple.position.set(0.11, 0.012, 0.05);
    scene.add(leftFootRipple);

    const rightFootRipple = new THREE.Mesh(rippleGeo, rightFootRippleMat);
    rightFootRipple.rotation.x = -Math.PI / 2;
    rightFootRipple.position.set(-0.11, 0.012, 0.05);
    scene.add(rightFootRipple);

    // =========================================================================
    // 2. SCULPTED ARTICULATED 3D KINEMATIC RUNNER TWIN
    // =========================================================================
    const pickables: THREE.Object3D[] = [];
    const shellMats: THREE.MeshPhysicalMaterial[] = [];
    const xrayWireMats: THREE.MeshBasicMaterial[] = [];

    const makeShellMat = (colorHex = 0x222a36): THREE.MeshPhysicalMaterial => {
      const m = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.34,
        metalness: 0.32,
        clearcoat: 0.38,
        clearcoatRoughness: 0.28,
        transparent: false,
        opacity: 1,
      });
      shellMats.push(m);
      return m;
    };

    const primaryShellMat = makeShellMat(0x232b38);
    const secondaryShellMat = makeShellMat(0x2d3748);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1220,
      roughness: 0.12,
      metalness: 0.85,
      clearcoat: 0.9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
    });
    const jointRingMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.24,
      metalness: 0.78,
    });
    const shoeAccentMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.35,
    });
    const wristBandMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    const addXrayWire = (geo: THREE.BufferGeometry, parent: THREE.Object3D) => {
      const wm = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      xrayWireMats.push(wm);
      const wire = new THREE.Mesh(geo, wm);
      wire.scale.setScalar(1.015);
      parent.add(wire);
    };

    const makeMuscleMat = (): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.85,
        roughness: 0.28,
        metalness: 0.18,
      });

    const muscleMats: Record<BodySystemId, THREE.MeshStandardMaterial> = {
      cardiopulmonary: makeMuscleMat(),
      core: makeMuscleMat(),
      quadriceps: makeMuscleMat(),
      hamstrings_glutes: makeMuscleMat(),
      calves_achilles: makeMuscleMat(),
    };

    // Root pelvis group
    const athleteRoot = new THREE.Group();
    scene.add(athleteRoot);

    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 0.98, 0);
    athleteRoot.add(pelvisGroup);

    const pelvisGeo = new THREE.CapsuleGeometry(0.115, 0.11, 12, 20);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, primaryShellMat);
    pelvisMesh.rotation.z = Math.PI / 2;
    pelvisMesh.scale.set(1, 0.92, 0.82);
    pelvisMesh.castShadow = true;
    tagPickable(pelvisMesh, 'core', pickables);
    pelvisGroup.add(pelvisMesh);

    // Glutes thermal pads (part of hamstrings_glutes)
    const gluteGeo = new THREE.SphereGeometry(0.088, 16, 16);
    for (const sx of [-0.085, 0.085]) {
      const glute = new THREE.Mesh(gluteGeo, muscleMats.hamstrings_glutes);
      glute.position.set(sx, -0.02, -0.068);
      glute.scale.set(0.95, 1.08, 0.78);
      glute.castShadow = true;
      tagPickable(glute, 'hamstrings_glutes', pickables);
      pelvisGroup.add(glute);
    }

    // --- TORSO / CHEST / SPINE ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.075, 0);
    pelvisGroup.add(torsoGroup);

    // Tapered athletic lower torso / waist
    const waistGeo = new THREE.CylinderGeometry(0.132, 0.106, 0.22, 24);
    const waistMesh = new THREE.Mesh(waistGeo, primaryShellMat);
    waistMesh.position.set(0, 0.11, 0);
    waistMesh.scale.set(1.12, 1, 0.78);
    waistMesh.castShadow = true;
    tagPickable(waistMesh, 'core', pickables);
    torsoGroup.add(waistMesh);
    addXrayWire(waistGeo, waistMesh);

    // Sculpted upper athletic ribcage / chest shell
    const chestGeo = new THREE.CylinderGeometry(0.172, 0.134, 0.3, 24);
    const chestMesh = new THREE.Mesh(chestGeo, primaryShellMat);
    chestMesh.position.set(0, 0.35, 0.008);
    chestMesh.scale.set(1.16, 1, 0.78);
    chestMesh.castShadow = true;
    tagPickable(chestMesh, 'cardiopulmonary', pickables);
    torsoGroup.add(chestMesh);
    addXrayWire(chestGeo, chestMesh);

    // Sculpted shoulder girdle clavicle bar
    const clavicleGeo = new THREE.CapsuleGeometry(0.068, 0.32, 12, 20);
    const clavicleMesh = new THREE.Mesh(clavicleGeo, secondaryShellMat);
    clavicleMesh.rotation.z = Math.PI / 2;
    clavicleMesh.position.set(0, 0.485, 0);
    clavicleMesh.scale.set(1, 0.9, 0.92);
    clavicleMesh.castShadow = true;
    tagPickable(clavicleMesh, 'cardiopulmonary', pickables);
    torsoGroup.add(clavicleMesh);

    // Core Stabilizer thermal abdominal & oblique muscle bands
    const absPackGeo = new THREE.CapsuleGeometry(0.026, 0.075, 8, 12);
    for (let row = 0; row < 2; row++) {
      for (const sx of [-0.044, 0.044]) {
        const ab = new THREE.Mesh(absPackGeo, muscleMats.core);
        ab.position.set(sx, 0.085 + row * 0.09, 0.088);
        ab.scale.set(1.15, 0.85, 0.55);
        tagPickable(ab, 'core', pickables);
        torsoGroup.add(ab);
      }
    }
    const obliqueGeo = new THREE.CapsuleGeometry(0.025, 0.12, 8, 12);
    for (const sx of [-0.125, 0.125]) {
      const ob = new THREE.Mesh(obliqueGeo, muscleMats.core);
      ob.position.set(sx, 0.135, 0.022);
      ob.rotation.z = sx > 0 ? -0.18 : 0.18;
      ob.scale.set(0.75, 1, 1.15);
      tagPickable(ob, 'core', pickables);
      torsoGroup.add(ob);
    }

    // Outer sternum biometric heart beacon (visible in all modes!)
    const sternumBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.0,
      roughness: 0.18,
      metalness: 0.2,
    });
    const sternumHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, 0.018, 6),
      jointRingMat
    );
    sternumHousing.rotation.x = Math.PI / 2;
    sternumHousing.position.set(0, 0.365, 0.126);
    tagPickable(sternumHousing, 'cardiopulmonary', pickables);
    torsoGroup.add(sternumHousing);

    const sternumCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.022, 6),
      sternumBeaconMat
    );
    sternumCore.rotation.x = Math.PI / 2;
    sternumCore.position.set(0, 0.365, 0.128);
    tagPickable(sternumCore, 'cardiopulmonary', pickables);
    torsoGroup.add(sternumCore);

    // Pectoral subtle thermal accents (cardiopulmonary chest frame)
    const pecGeo = new THREE.SphereGeometry(0.072, 16, 12);
    for (const sx of [-0.088, 0.088]) {
      const pec = new THREE.Mesh(pecGeo, muscleMats.cardiopulmonary);
      pec.position.set(sx, 0.39, 0.095);
      pec.scale.set(1.18, 0.72, 0.42);
      tagPickable(pec, 'cardiopulmonary', pickables);
      torsoGroup.add(pec);
    }

    // --- INTERNAL BIO-XRAY CARDIOPULMONARY & ARTERIAL ASSEMBLY ---
    const internalOrganGroup = new THREE.Group();
    torsoGroup.add(internalOrganGroup);

    // Beating 3D anatomical heart (left-of-center chest)
    const heartGroup = new THREE.Group();
    heartGroup.position.set(0.036, 0.355, 0.022);
    internalOrganGroup.add(heartGroup);

    const heartMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.1,
      roughness: 0.25,
      metalness: 0.1,
    });
    const leftVentricle = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 20, 20),
      heartMat
    );
    leftVentricle.scale.set(0.85, 1.18, 0.88);
    leftVentricle.rotation.z = 0.28;
    tagPickable(leftVentricle, 'cardiopulmonary', pickables);
    heartGroup.add(leftVentricle);

    const rightAtrium = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 16, 16),
      heartMat
    );
    rightAtrium.position.set(-0.026, 0.028, 0.008);
    tagPickable(rightAtrium, 'cardiopulmonary', pickables);
    heartGroup.add(rightAtrium);

    const aortaArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.011, 10, 20, Math.PI * 1.15),
      heartMat
    );
    aortaArch.position.set(-0.008, 0.056, -0.004);
    aortaArch.rotation.y = Math.PI / 5;
    heartGroup.add(aortaArch);

    // Dual expanding 3D Lungs
    const lungsGroup = new THREE.Group();
    lungsGroup.position.set(0, 0.365, -0.005);
    internalOrganGroup.add(lungsGroup);

    const lungMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.25,
      roughness: 0.3,
      transparent: true,
      opacity: 0.78,
    });
    const lungGeo = new THREE.CapsuleGeometry(0.052, 0.115, 12, 16);
    for (const sx of [-0.095, 0.095]) {
      const lung = new THREE.Mesh(lungGeo, lungMat);
      lung.position.set(sx, 0, 0);
      lung.scale.set(0.95, 1.0, 0.78);
      lung.rotation.z = sx > 0 ? 0.12 : -0.12;
      tagPickable(lung, 'cardiopulmonary', pickables);
      lungsGroup.add(lung);
    }

    // 7 Articulated Spine Vertebrae discs
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.4,
    });
    const vertGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.026, 12);
    for (let v = 0; v < 7; v++) {
      const disc = new THREE.Mesh(vertGeo, spineMat);
      disc.position.set(0, 0.05 + v * 0.068, -0.058);
      internalOrganGroup.add(disc);
    }

    // Arterial Vascular Conduits + Animated Flow Photons
    const arterialTubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    const arterialBeadMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });

    const arterialCurves: THREE.CatmullRomCurve3[] = [
      // Descending aorta -> left femoral trunk
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.41, 0.015),
        new THREE.Vector3(0.01, 0.3, -0.02),
        new THREE.Vector3(0.01, 0.14, -0.02),
        new THREE.Vector3(0.06, 0.02, -0.01),
        new THREE.Vector3(0.1, -0.08, 0.0),
      ]),
      // Descending aorta -> right femoral trunk
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.41, 0.015),
        new THREE.Vector3(-0.01, 0.28, -0.02),
        new THREE.Vector3(-0.02, 0.13, -0.02),
        new THREE.Vector3(-0.06, 0.02, -0.01),
        new THREE.Vector3(-0.1, -0.08, 0.0),
      ]),
      // Carotid & Subclavian upper loop
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.41, 0.02),
        new THREE.Vector3(0.08, 0.46, 0.01),
        new THREE.Vector3(0.18, 0.48, 0.0),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.41, 0.02),
        new THREE.Vector3(-0.06, 0.46, 0.01),
        new THREE.Vector3(-0.18, 0.48, 0.0),
      ]),
    ];

    const arterialBeads: ArterialBeadSpec[] = [];
    const beadGeo = new THREE.SphereGeometry(0.012, 8, 8);
    arterialCurves.forEach((curve, cIdx) => {
      const tubeGeo = new THREE.TubeGeometry(curve, 22, 0.007, 8, false);
      const tube = new THREE.Mesh(tubeGeo, arterialTubeMat);
      internalOrganGroup.add(tube);
      const count = cIdx < 2 ? 5 : 3;
      for (let b = 0; b < count; b++) {
        const bead = new THREE.Mesh(beadGeo, arterialBeadMat);
        internalOrganGroup.add(bead);
        arterialBeads.push({
          mesh: bead,
          curve,
          offset: b / count,
          speedScale: cIdx < 2 ? 1.0 : 1.35,
        });
      }
    });

    // --- NECK & SCULPTED AERODYNAMIC HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.545, 0.01);
    torsoGroup.add(headGroup);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.052, 0.09, 16),
      secondaryShellMat
    );
    neck.position.y = 0.03;
    neck.castShadow = true;
    headGroup.add(neck);

    const cranium = new THREE.Mesh(
      new THREE.SphereGeometry(0.102, 24, 20),
      primaryShellMat
    );
    cranium.position.set(0, 0.145, 0.008);
    cranium.scale.set(0.88, 1.08, 1.02);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Sculpted jaw contour
    const jaw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.044, 0.075, 16),
      secondaryShellMat
    );
    jaw.position.set(0, 0.082, 0.028);
    jaw.rotation.x = 0.18;
    headGroup.add(jaw);

    // Curved futuristic lab telemetry visor
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.098,
        0.096,
        0.044,
        24,
        1,
        true,
        -Math.PI * 0.36,
        Math.PI * 0.72
      ),
      visorMat
    );
    visor.position.set(0, 0.155, 0.015);
    headGroup.add(visor);

    // --- LEFT & RIGHT ARM CHAINS ---
    const buildArm = (side: 1 | -1) => {
      const shoulderGroup = new THREE.Group();
      shoulderGroup.position.set(side * 0.225, 0.475, 0);
      torsoGroup.add(shoulderGroup);

      const deltoid = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 16, 14),
        secondaryShellMat
      );
      deltoid.castShadow = true;
      shoulderGroup.add(deltoid);

      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 0.21, 10, 14),
        primaryShellMat
      );
      upperArm.position.set(0, -0.145, 0);
      upperArm.castShadow = true;
      shoulderGroup.add(upperArm);

      const elbowGroup = new THREE.Group();
      elbowGroup.position.set(0, -0.285, 0);
      shoulderGroup.add(elbowGroup);

      const elbowCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.039, 0.008, 10, 20),
        jointRingMat
      );
      elbowCollar.rotation.y = Math.PI / 2;
      elbowGroup.add(elbowCollar);

      const forearm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.034, 0.19, 10, 14),
        primaryShellMat
      );
      forearm.position.set(0, -0.13, 0);
      forearm.castShadow = true;
      elbowGroup.add(forearm);

      // WHOOP-inspired glowing biometric wrist sensor on left arm
      if (side === 1) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.037, 0.037, 0.032, 16),
          wristBandMat
        );
        band.position.set(0, -0.215, 0);
        elbowGroup.add(band);
      }

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 12),
        secondaryShellMat
      );
      hand.position.set(0, -0.265, 0.01);
      hand.scale.set(0.72, 1.25, 0.92);
      hand.castShadow = true;
      elbowGroup.add(hand);

      return { shoulderGroup, elbowGroup };
    };

    const { shoulderGroup: leftShoulderGroup, elbowGroup: leftElbowGroup } =
      buildArm(1);
    const { shoulderGroup: rightShoulderGroup, elbowGroup: rightElbowGroup } =
      buildArm(-1);

    // --- LEFT & RIGHT LEG CHAINS WITH MUSCLE HEAT-MAP + JOINT DANGER RINGS ---
    const warningRingMats: THREE.MeshBasicMaterial[] = [];
    const warningPulseMats: THREE.MeshBasicMaterial[] = [];
    const warningGroups: THREE.Group[] = [];

    const createWarningHalo = (radius: number): THREE.Group => {
      const grp = new THREE.Group();
      grp.visible = false;

      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.95,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.55,
      });
      warningRingMats.push(innerMat);
      warningPulseMats.push(outerMat);

      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.011, 12, 36),
        innerMat
      );
      ring1.rotation.x = Math.PI / 2;
      grp.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.42, 0.006, 10, 36),
        outerMat
      );
      ring2.rotation.x = Math.PI / 2;
      grp.add(ring2);

      // Vertical orthogonal lock halo for dramatic 3D visibility from any angle
      const ring3 = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.12, 0.005, 8, 32),
        outerMat
      );
      ring3.rotation.y = Math.PI / 2;
      grp.add(ring3);

      warningGroups.push(grp);
      return grp;
    };

    const buildLeg = (side: 1 | -1) => {
      const hipGroup = new THREE.Group();
      hipGroup.position.set(side * 0.105, -0.025, 0);
      pelvisGroup.add(hipGroup);

      const hipSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 16, 14),
        secondaryShellMat
      );
      hipGroup.add(hipSphere);

      // Thigh structural core
      const thighGeo = new THREE.CapsuleGeometry(0.064, 0.31, 12, 18);
      const thighMesh = new THREE.Mesh(thighGeo, primaryShellMat);
      thighMesh.position.set(0, -0.22, 0);
      thighMesh.castShadow = true;
      tagPickable(thighMesh, 'quadriceps', pickables);
      hipGroup.add(thighMesh);
      addXrayWire(thighGeo, thighMesh);

      // Anterior Quadriceps glowing thermal muscle pack
      const quadGeo = new THREE.CapsuleGeometry(0.048, 0.23, 12, 16);
      const quadMesh = new THREE.Mesh(quadGeo, muscleMats.quadriceps);
      quadMesh.position.set(side * 0.008, -0.205, 0.036);
      quadMesh.scale.set(1.06, 1.0, 0.72);
      quadMesh.castShadow = true;
      tagPickable(quadMesh, 'quadriceps', pickables);
      hipGroup.add(quadMesh);

      // Posterior Hamstring glowing thermal muscle pack
      const hamGeo = new THREE.CapsuleGeometry(0.044, 0.22, 12, 16);
      const hamMesh = new THREE.Mesh(hamGeo, muscleMats.hamstrings_glutes);
      hamMesh.position.set(0, -0.21, -0.038);
      hamMesh.scale.set(1.0, 1.0, 0.72);
      hamMesh.castShadow = true;
      tagPickable(hamMesh, 'hamstrings_glutes', pickables);
      hipGroup.add(hamMesh);

      // Knee joint assembly
      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -0.44, 0);
      hipGroup.add(kneeGroup);

      const kneeCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 16, 14),
        secondaryShellMat
      );
      kneeCap.castShadow = true;
      tagPickable(kneeCap, 'quadriceps', pickables);
      kneeGroup.add(kneeCap);

      const kneeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.058, 0.008, 10, 24),
        jointRingMat
      );
      kneeRing.rotation.y = Math.PI / 2;
      kneeGroup.add(kneeRing);

      // Knee crimson stress warning halo (visible under ACWR > 1.50!)
      const kneeWarning = createWarningHalo(0.115);
      kneeGroup.add(kneeWarning);

      // Shin / Tibia structural core
      const shinGeo = new THREE.CapsuleGeometry(0.046, 0.31, 12, 16);
      const shinMesh = new THREE.Mesh(shinGeo, primaryShellMat);
      shinMesh.position.set(0, -0.215, 0);
      shinMesh.castShadow = true;
      tagPickable(shinMesh, 'calves_achilles', pickables);
      kneeGroup.add(shinMesh);
      addXrayWire(shinGeo, shinMesh);

      // Posterior Calf / Gastrocnemius glowing thermal muscle belly
      const calfGeo = new THREE.CapsuleGeometry(0.042, 0.145, 12, 16);
      const calfMesh = new THREE.Mesh(calfGeo, muscleMats.calves_achilles);
      calfMesh.position.set(0, -0.145, -0.034);
      calfMesh.scale.set(0.95, 1.05, 0.8);
      calfMesh.castShadow = true;
      tagPickable(calfMesh, 'calves_achilles', pickables);
      kneeGroup.add(calfMesh);

      // Glowing Achilles tendon vertical ribbon
      const achillesGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.14, 10);
      const achillesMesh = new THREE.Mesh(
        achillesGeo,
        muscleMats.calves_achilles
      );
      achillesMesh.position.set(0, -0.315, -0.034);
      tagPickable(achillesMesh, 'calves_achilles', pickables);
      kneeGroup.add(achillesMesh);

      // Achilles crimson stress warning halo (visible under ACWR > 1.50!)
      const achillesWarning = createWarningHalo(0.098);
      achillesWarning.position.set(0, -0.355, -0.015);
      kneeGroup.add(achillesWarning);

      // Ankle & Performance Carbon Running Shoe
      const ankleGroup = new THREE.Group();
      ankleGroup.position.set(0, -0.425, 0);
      kneeGroup.add(ankleGroup);

      const ankleCollar = new THREE.Mesh(
        new THREE.TorusGeometry(0.04, 0.007, 8, 20),
        jointRingMat
      );
      ankleCollar.rotation.x = Math.PI / 2;
      ankleGroup.add(ankleCollar);

      const shoeUpper = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.046, 0.14, 10, 14),
        secondaryShellMat
      );
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.position.set(0, -0.035, 0.058);
      shoeUpper.scale.set(0.92, 1.0, 0.72);
      shoeUpper.castShadow = true;
      tagPickable(shoeUpper, 'calves_achilles', pickables);
      ankleGroup.add(shoeUpper);

      const shoeMidsole = new THREE.Mesh(
        new THREE.BoxGeometry(0.088, 0.022, 0.235),
        shoeAccentMat
      );
      shoeMidsole.position.set(0, -0.058, 0.058);
      shoeMidsole.castShadow = true;
      ankleGroup.add(shoeMidsole);

      return { hipGroup, kneeGroup, ankleGroup };
    };

    const {
      hipGroup: leftHipGroup,
      kneeGroup: leftKneeGroup,
      ankleGroup: leftAnkleGroup,
    } = buildLeg(1);
    const {
      hipGroup: rightHipGroup,
      kneeGroup: rightKneeGroup,
      ankleGroup: rightAnkleGroup,
    } = buildLeg(-1);

    handlesRef.current = {
      renderer,
      scene,
      camera,
      fog,
      hemiLight,
      keyLight,
      rimLight,
      heartPointLight,
      floorMat,
      plinthMat,
      bezelMat,
      trackDeckMat,
      zoneRingMat,
      shellMats,
      xrayWireMats,
      jointRingMat,
      shoeAccentMat,
      wristBandMat,
      muscleMats,
      heartMat,
      lungMat,
      sternumBeaconMat,
      arterialTubeMat,
      arterialBeadMat,
      spineMat,
      warningRingMats,
      warningPulseMats,
      warningGroups,
      beltSlats,
      leftFootRipple,
      rightFootRipple,
      leftFootRippleMat,
      rightFootRippleMat,
      arterialBeads,
      pickables,
      pelvisGroup,
      torsoGroup,
      headGroup,
      heartGroup,
      lungsGroup,
      leftShoulderGroup,
      leftElbowGroup,
      rightShoulderGroup,
      rightElbowGroup,
      leftHipGroup,
      leftKneeGroup,
      leftAnkleGroup,
      rightHipGroup,
      rightKneeGroup,
      rightAnkleGroup,
      internalOrganGroup,
    };

    // =========================================================================
    // 3. DIRECT 3D RAYCAST CLICK & SMOOTH ORBIT DRAG HANDLERS
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const getRaycastSystem = (ev: PointerEvent): BodySystemId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      for (const hit of hits) {
        const sys = hit.object.userData.bodySystem as BodySystemId | undefined;
        if (sys) return sys;
      }
      return null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      orbitRef.current.dragging = true;
      orbitRef.current.lastX = ev.clientX;
      orbitRef.current.lastY = ev.clientY;
      orbitRef.current.dragDist = 0;
      renderer.domElement.setPointerCapture?.(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (orbitRef.current.dragging) {
        const dx = ev.clientX - orbitRef.current.lastX;
        const dy = ev.clientY - orbitRef.current.lastY;
        orbitRef.current.lastX = ev.clientX;
        orbitRef.current.lastY = ev.clientY;
        orbitRef.current.dragDist += Math.hypot(dx, dy);
        orbitRef.current.userYawOffset -= dx * 0.0085;
        orbitRef.current.userPitchOffset = Math.max(
          -0.25,
          Math.min(0.45, orbitRef.current.userPitchOffset + dy * 0.006)
        );
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }
      const hovered = getRaycastSystem(ev);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };

    const onPointerUp = (ev: PointerEvent) => {
      const wasClick = orbitRef.current.dragDist < 7;
      orbitRef.current.dragging = false;
      renderer.domElement.releasePointerCapture?.(ev.pointerId);
      if (wasClick) {
        const hitSystem = getRaycastSystem(ev);
        if (hitSystem) {
          setStudioState((prev) => ({ ...prev, selectedSystem: hitSystem }));
        }
      }
      const hovered = getRaycastSystem(ev);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp HiDPI sizing across desktop & mobile
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(Math.round(entry.contentRect.width), 280);
        const h = Math.max(Math.round(entry.contentRect.height), 260);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    // =========================================================================
    // 4. 60FPS DETERMINISTIC KINEMATICS & PBR MATERIAL ANIMATION LOOP
    // =========================================================================
    let rafId = 0;
    let lastTime = performance.now();
    let phaseRad = 0.65; // Start in dynamic mid-stride athletic pose!
    let elapsedSec = 0;
    let beltTravel = 0;

    const tmpColor = new THREE.Color();
    const bgTarget = new THREE.Color();
    const plinthTarget = new THREE.Color();
    const bezelTarget = new THREE.Color();
    const emeraldColor = new THREE.Color(0x10b981);
    const cyanColor = new THREE.Color(0x06b6d4);

    const animate = (now: number) => {
      rafId = window.requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsedSec += dt;

      const st = stateRef.current;
      const tel = telemetryRef.current;
      const isDark = darkRef.current;
      const isXray = st.cameraMode === 'bio_xray';
      const isDeload = st.protocolMode === 'AUTONOMIC_DELOAD';
      const h = handlesRef.current;
      if (!h) return;

      // Advance gait phase smoothly according to live cadence
      const strideHz = tel.cadenceSpm / 120;
      phaseRad += dt * strideHz * Math.PI * 2;
      const pose = computeGaitPose(phaseRad, st.intensityW, st.acwr);

      // Apply articulated biomechanical pose (verified Three.js right-handed axes)
      h.pelvisGroup.position.y = 0.99 + pose.pelvisYOffset;
      h.pelvisGroup.rotation.y = pose.pelvisYaw;

      h.torsoGroup.rotation.x = pose.torsoForwardLean;
      h.torsoGroup.rotation.y = pose.torsoTwist;
      h.headGroup.rotation.x = pose.headNod;

      h.leftHipGroup.rotation.x = -pose.leftHipPitch;
      h.rightHipGroup.rotation.x = -pose.rightHipPitch;
      h.leftKneeGroup.rotation.x = pose.leftKneeFlex;
      h.rightKneeGroup.rotation.x = pose.rightKneeFlex;
      h.leftAnkleGroup.rotation.x = pose.leftAnklePitch;
      h.rightAnkleGroup.rotation.x = pose.rightAnklePitch;

      h.leftShoulderGroup.rotation.x = -pose.leftShoulderPitch;
      h.rightShoulderGroup.rotation.x = -pose.rightShoulderPitch;
      h.leftElbowGroup.rotation.x = -pose.leftElbowFlex;
      h.rightElbowGroup.rotation.x = -pose.rightElbowFlex;

      // Heartbeat systolic lub-dub & lung ventilatory expansion
      h.heartGroup.scale.setScalar(pose.heartPulseScale);
      h.lungsGroup.scale.set(
        pose.lungExpansionScale,
        1 + (pose.lungExpansionScale - 1) * 0.65,
        pose.lungExpansionScale
      );

      // Scroll treadmill belt slats backward at exact ground speed
      beltTravel += dt * (pose.groundSpeedKmh / 3.6) * 0.42;
      for (let i = 0; i < h.beltSlats.length; i++) {
        const rawZ = -1.04 + (((i / h.beltSlats.length) * 2.08 - beltTravel) % 2.08 + 2.08) % 2.08;
        h.beltSlats[i].position.z = rawZ;
      }

      // Dynamic footstrike impact ripples synced to foot nadir
      const accentHex = isDeload ? '#10b981' : tel.zoneColorHex;
      tmpColor.set(accentHex);

      const leftStrike = Math.max(0, Math.sin(phaseRad + 0.55));
      const rightStrike = Math.max(0, Math.sin(phaseRad + Math.PI + 0.55));
      h.leftFootRipple.scale.setScalar(0.8 + leftStrike * 1.45);
      h.leftFootRippleMat.opacity = (1 - leftStrike) * 0.45 * (leftStrike > 0.05 ? 1 : 0);
      h.leftFootRippleMat.color.copy(
        tel.jointWarningActive ? new THREE.Color(0xef4444) : tmpColor
      );

      h.rightFootRipple.scale.setScalar(0.8 + rightStrike * 1.45);
      h.rightFootRippleMat.opacity = (1 - rightStrike) * 0.45 * (rightStrike > 0.05 ? 1 : 0);
      h.rightFootRippleMat.color.copy(h.leftFootRippleMat.color);

      // Update studio theme backdrop (Swiss Daylight Alabaster vs Obsidian Lab)
      if (isXray) {
        bgTarget.setHex(isDark ? 0x060b14 : 0xe4edf2);
        plinthTarget.setHex(isDark ? 0x0f172a : 0xd0dfe8);
        bezelTarget.setHex(isDark ? 0x1e293b : 0x94a3b8);
      } else {
        bgTarget.setHex(isDark ? 0x0b0e14 : 0xf2f3ef);
        plinthTarget.setHex(isDark ? 0x141923 : 0xe4e6e0);
        bezelTarget.setHex(isDark ? 0x263143 : 0xc2c8c0);
      }
      (h.scene.background as THREE.Color).lerp(bgTarget, 0.12);
      h.fog.color.lerp(bgTarget, 0.12);
      h.floorMat.color.lerp(bgTarget, 0.12);
      h.plinthMat.color.lerp(plinthTarget, 0.12);
      h.bezelMat.color.lerp(bezelTarget, 0.12);

      // Update zone halo ring, shoe midsole, wrist sensor, and heart chest beacon
      h.zoneRingMat.color.lerp(tmpColor, 0.15);
      h.zoneRingMat.emissive.lerp(tmpColor, 0.15);
      h.zoneRingMat.emissiveIntensity =
        1.15 + (pose.heartPulseScale - 1) * 3.8;

      h.shoeAccentMat.color.lerp(tmpColor, 0.15);
      h.shoeAccentMat.emissive.lerp(tmpColor, 0.15);
      h.wristBandMat.color.lerp(tmpColor, 0.15);
      h.wristBandMat.emissive.lerp(tmpColor, 0.15);

      h.sternumBeaconMat.color.lerp(tmpColor, 0.18);
      h.sternumBeaconMat.emissive.lerp(tmpColor, 0.18);
      h.sternumBeaconMat.emissiveIntensity =
        1.5 + (pose.heartPulseScale - 1) * 9.0;

      h.heartPointLight.color.lerp(
        isXray ? (isDeload ? emeraldColor : tmpColor) : tmpColor,
        0.15
      );
      h.heartPointLight.intensity = isXray
        ? 2.2 + (pose.heartPulseScale - 1) * 7.5
        : 0.9 + (pose.heartPulseScale - 1) * 3.5;

      // Update BIO-XRAY translucency vs matte architectural titanium shell
      for (const sm of h.shellMats) {
        if (isXray) {
          sm.transparent = true;
          sm.depthWrite = false;
          sm.opacity = THREE.MathUtils.lerp(sm.opacity, 0.17, 0.16);
          sm.color.lerp(new THREE.Color(isDark ? 0x38bdf8 : 0x475569), 0.14);
        } else {
          sm.opacity = THREE.MathUtils.lerp(sm.opacity, 1.0, 0.16);
          if (sm.opacity > 0.96) {
            sm.transparent = false;
            sm.depthWrite = true;
            sm.opacity = 1.0;
          }
          sm.color.lerp(new THREE.Color(isDark ? 0x2c3648 : 0x222a36), 0.14);
        }
      }

      for (const wm of h.xrayWireMats) {
        wm.opacity = THREE.MathUtils.lerp(wm.opacity, isXray ? 0.22 : 0.0, 0.15);
        wm.color.lerp(isDeload ? emeraldColor : cyanColor, 0.14);
      }

      // Internal heart, lungs & arterial vascular flow visibility & pulsation
      h.internalOrganGroup.visible = isXray;
      if (isXray) {
        const heartCol = isDeload
          ? new THREE.Color(0x10b981)
          : new THREE.Color(
              tel.karvonenZone === 'Z5' || tel.jointWarningActive
                ? 0xef4444
                : tel.karvonenZone === 'Z4'
                  ? 0xf59e0b
                  : 0xf43f5e
            );
        h.heartMat.color.lerp(heartCol, 0.16);
        h.heartMat.emissive.lerp(heartCol, 0.16);
        h.heartMat.emissiveIntensity = 1.9 + (pose.heartPulseScale - 1) * 10;

        const lungCol = isDeload ? emeraldColor : cyanColor;
        h.lungMat.color.lerp(lungCol, 0.15);
        h.lungMat.emissive.lerp(lungCol, 0.15);
        h.lungMat.emissiveIntensity = 1.15 + (pose.lungExpansionScale - 1) * 7.5;

        h.arterialTubeMat.color.lerp(isDeload ? emeraldColor : tmpColor, 0.15);
        h.arterialBeadMat.color.lerp(
          isDeload ? new THREE.Color(0xa7f3d0) : new THREE.Color(0xffffff),
          0.15
        );

        const flowSpeed = (tel.heartRateBpm / 60) * 0.36;
        for (const spec of h.arterialBeads) {
          const u = (elapsedSec * flowSpeed * spec.speedScale + spec.offset) % 1;
          spec.curve.getPointAt(u, spec.mesh.position);
          const pulseScale = 0.85 + Math.sin(u * Math.PI) * 0.55;
          spec.mesh.scale.setScalar(pulseScale);
        }
      }

      // Update per-body-system thermal activation heat-map + selected aura
      for (const sysId of BODY_SYSTEM_ORDER) {
        const sysTel = tel.bodySystems[sysId];
        const mat = h.muscleMats[sysId];
        const isSelected = st.selectedSystem === sysId;
        const targetCol = new THREE.Color(
          isDeload && !sysTel.stressAlert ? '#10b981' : sysTel.hexColor
        );
        mat.color.lerp(targetCol, 0.16);
        mat.emissive.lerp(targetCol, 0.16);

        const baseEmissive = isXray
          ? 0.42 + sysTel.activation * 0.75
          : 0.45 + sysTel.activation * 1.45;
        const selectedBoost = isSelected
          ? 0.85 + Math.sin(elapsedSec * 5.2) * 0.32
          : 0;
        mat.emissiveIntensity = baseEmissive + selectedBoost;
        mat.transparent = isXray;
        mat.opacity = isXray ? (isSelected ? 0.88 : 0.46) : 1.0;
      }

      // Crimson Knee & Achilles Joint Stress Warning Halos (ACWR > 1.50)
      const dangerPulse = 0.5 + 0.5 * Math.sin(elapsedSec * 8.5);
      for (let i = 0; i < h.warningGroups.length; i++) {
        const grp = h.warningGroups[i];
        grp.visible = tel.jointWarningActive;
        if (tel.jointWarningActive) {
          grp.rotation.y = elapsedSec * (i % 2 === 0 ? 1.8 : -1.8);
          const outer = grp.children[1];
          if (outer) {
            outer.scale.setScalar(0.95 + dangerPulse * 0.35);
          }
          h.warningRingMats[i].opacity = 0.78 + dangerPulse * 0.22;
          h.warningPulseMats[i].opacity = 0.32 + (1 - dangerPulse) * 0.55;
        }
      }

      // Smooth Camera Mode Interpolation + Subtle Studio Orbit Drift
      const orb = orbitRef.current;
      let goalYaw = 0.62;
      let goalPitch = 0.16;
      let goalDist = 3.75;
      let goalTargetX = 0.22;
      let goalTargetY = 1.04;

      if (st.cameraMode === 'studio_orbit') {
        goalYaw = 0.62 + Math.sin(elapsedSec * 0.28) * 0.16 + orb.userYawOffset;
        goalPitch = 0.16 + orb.userPitchOffset;
        goalDist = 3.72;
        goalTargetX = container.clientWidth >= 560 ? 0.22 : 0.0;
        goalTargetY = 1.03;
      } else if (st.cameraMode === 'bio_xray') {
        goalYaw = 0.36 + Math.sin(elapsedSec * 0.24) * 0.12 + orb.userYawOffset;
        goalPitch = 0.1 + orb.userPitchOffset;
        goalDist = 3.22;
        goalTargetX = container.clientWidth >= 560 ? 0.18 : 0.0;
        goalTargetY = 1.12;
      } else {
        // side_gait: crisp sagittal right-side biomechanics profile
        goalYaw = Math.PI / 2 + orb.userYawOffset;
        goalPitch = 0.06 + orb.userPitchOffset;
        goalDist = 3.78;
        goalTargetX = 0.0;
        goalTargetY = 1.0;
      }

      orb.currentYaw = THREE.MathUtils.lerp(orb.currentYaw, goalYaw, 0.09);
      orb.currentPitch = THREE.MathUtils.lerp(orb.currentPitch, goalPitch, 0.09);
      orb.currentDist = THREE.MathUtils.lerp(orb.currentDist, goalDist, 0.09);
      orb.currentTargetX = THREE.MathUtils.lerp(orb.currentTargetX, goalTargetX, 0.09);
      orb.currentTargetY = THREE.MathUtils.lerp(orb.currentTargetY, goalTargetY, 0.09);

      const camX =
        orb.currentTargetX +
        Math.sin(orb.currentYaw) * Math.cos(orb.currentPitch) * orb.currentDist;
      const camY =
        orb.currentTargetY + Math.sin(orb.currentPitch) * orb.currentDist;
      const camZ =
        Math.cos(orb.currentYaw) * Math.cos(orb.currentPitch) * orb.currentDist;

      h.camera.position.set(camX, camY, camZ);
      h.camera.lookAt(orb.currentTargetX, orb.currentTargetY, 0);

      h.renderer.render(h.scene, h.camera);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      handlesRef.current = null;
    };
  }, []);

  const selectedSystemTelemetry = telemetry.bodySystems[studioState.selectedSystem];
  const isDeload = studioState.protocolMode === 'AUTONOMIC_DELOAD';
  const isDanger = telemetry.acwrVerdict === 'INJURY DANGER';

  const statusTone = isDanger
    ? {
        pill: 'border-rose-500/50 bg-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]',
        cardBorder: 'border-rose-500/55',
        accent: 'text-rose-600 dark:text-rose-400',
        bar: '#ef4444',
      }
    : isDeload
      ? {
          pill: 'border-emerald-500/45 bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.38)]',
          cardBorder: 'border-emerald-500/45',
          accent: 'text-emerald-700 dark:text-emerald-400',
          bar: '#10b981',
        }
      : {
          pill: 'border-[var(--vg-border)] bg-[var(--vg-surface)]/95 text-[var(--vg-ink)]',
          cardBorder: 'border-[var(--vg-border)]',
          accent: 'text-emerald-700 dark:text-[#a3e635]',
          bar: telemetry.zoneColorHex,
        };

  return (
    <div
      data-testid="bio-3d-stage"
      className={`overflow-hidden rounded-2xl border bg-[var(--vg-surface)] shadow-xl transition-colors duration-300 ${statusTone.cardBorder}`}
    >
      {/* Top Studio Header Bar: Live Mode Pill + 3 Camera Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-2.5 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: isDanger
                ? '#ef4444'
                : isDeload
                  ? '#10b981'
                  : telemetry.zoneColorHex,
              boxShadow: `0 0 8px ${
                isDanger
                  ? '#ef4444'
                  : isDeload
                    ? '#10b981'
                    : telemetry.zoneColorHex
              }`,
            }}
          />
          <span className="truncate font-mono-num text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--vg-ink)]">
            {lang === 'en'
              ? 'V4.0 3D KINEMATIC ATHLETE TWIN'
              : 'V4.0 BẢN SAO VĐV 3D SINH HỌC'}
          </span>
        </div>

        {/* Camera Mode Segmented Controls */}
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="3D Camera Modes"
        >
          <button
            type="button"
            data-testid="cam-studio-orbit"
            onClick={() => selectCameraMode('studio_orbit')}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono-num text-[10px] font-bold tracking-[0.06em] transition-all cursor-pointer ${
              studioState.cameraMode === 'studio_orbit'
                ? 'border-[#0f172a] bg-[#0f172a] text-white dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
            }`}
          >
            <OrbitIcon className="h-3 w-3 shrink-0" />
            <span>3D STUDIO ORBIT</span>
          </button>

          <button
            type="button"
            data-testid="cam-bio-xray"
            onClick={() => selectCameraMode('bio_xray')}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono-num text-[10px] font-bold tracking-[0.06em] transition-all cursor-pointer ${
              studioState.cameraMode === 'bio_xray'
                ? 'border-cyan-600 bg-cyan-600 text-white shadow-[0_0_12px_rgba(8,145,178,0.4)]'
                : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
            }`}
          >
            <ScanXRayIcon className="h-3 w-3 shrink-0" />
            <span>BIO-XRAY</span>
          </button>

          <button
            type="button"
            data-testid="cam-side-gait"
            onClick={() => selectCameraMode('side_gait')}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono-num text-[10px] font-bold tracking-[0.06em] transition-all cursor-pointer ${
              studioState.cameraMode === 'side_gait'
                ? 'border-[#0f172a] bg-[#0f172a] text-white dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
            }`}
          >
            <CameraSideIcon className="h-3 w-3 shrink-0" />
            <span>SIDE GAIT CAM</span>
          </button>
        </div>
      </div>

      {/* Primary 60fps Three.js PBR Stage Canvas + Floating Architectural HUD */}
      <div className="relative h-[320px] w-full select-none bg-[#f2f3ef] sm:h-[385px] lg:h-[405px] dark:bg-[#0b0e14]">
        {webglUnavailable ? (
          <div className="flex h-full items-center justify-center p-6 text-center font-mono-num text-xs text-[var(--vg-muted)]">
            WebGL 3D Engine unavailable in this browser context. Telemetry engine
            remains live below.
          </div>
        ) : (
          <div
            ref={mountRef}
            data-testid="bio-3d-canvas-host"
            className="h-full w-full"
            aria-label="Interactive 60fps 3D Biomechanical Running Athlete Twin"
          />
        )}

        {/* Top-Left Floating Live Physiological Vitals HUD */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col gap-1.5 sm:top-3 sm:left-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              data-testid="hud-zone-badge"
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/90 px-2.5 py-1 font-mono-num text-[10px] font-bold tracking-[0.08em] text-[#0f172a] shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-[#0b0e14]/88 dark:text-slate-100"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: isDeload ? '#10b981' : telemetry.zoneColorHex,
                }}
              />
              <span>
                {lang === 'en' ? telemetry.zoneLabelEn : telemetry.zoneLabelVi}
              </span>
            </div>

            {studioState.cameraMode === 'bio_xray' && (
              <div className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/85 px-2 py-1 font-mono-num text-[10px] font-bold tracking-[0.1em] text-cyan-200 backdrop-blur-md">
                <ScanXRayIcon className="h-3 w-3" />
                <span>CARDIOPULMONARY X-RAY</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div className="rounded-lg border border-black/10 bg-white/88 px-2 py-1 shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-[#0b0e14]/84">
              <div className="font-mono-num text-[8px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                HEART RATE
              </div>
              <div
                data-testid="hud-hr-value"
                className="font-mono-num text-xs font-bold text-[#0f172a] dark:text-white"
              >
                {telemetry.heartRateBpm}
                <span className="ml-0.5 text-[9px] font-medium text-slate-500">
                  bpm
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-black/10 bg-white/88 px-2 py-1 shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-[#0b0e14]/84">
              <div className="font-mono-num text-[8px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                LACTATE
              </div>
              <div
                data-testid="hud-lactate-value"
                className="font-mono-num text-xs font-bold"
                style={{ color: telemetry.zoneColorHex }}
              >
                {telemetry.bloodLactateMmol.toFixed(2)}
                <span className="ml-0.5 text-[9px] font-medium text-slate-500">
                  mM
                </span>
              </div>
            </div>

            <div className="hidden rounded-lg border border-black/10 bg-white/88 px-2 py-1 shadow-sm backdrop-blur-md sm:block dark:border-white/12 dark:bg-[#0b0e14]/84">
              <div className="font-mono-num text-[8px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                VO2 LIVE
              </div>
              <div
                data-testid="hud-vo2-value"
                className="font-mono-num text-xs font-bold text-[#0f172a] dark:text-white"
              >
                {telemetry.vo2MlKgMin.toFixed(1)}
                <span className="ml-0.5 text-[9px] font-medium text-slate-500">
                  mL
                </span>
              </div>
            </div>

            <div className="hidden rounded-lg border border-black/10 bg-white/88 px-2 py-1 shadow-sm backdrop-blur-md sm:block dark:border-white/12 dark:bg-[#0b0e14]/84">
              <div className="font-mono-num text-[8px] font-semibold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                CADENCE
              </div>
              <div
                data-testid="hud-cadence-value"
                className="font-mono-num text-xs font-bold text-[#0f172a] dark:text-white"
              >
                {Math.round(telemetry.cadenceSpm)}
                <span className="ml-0.5 text-[9px] font-medium text-slate-500">
                  spm
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Floating ACWR Verdict & HRV Readiness HUD */}
        <div className="pointer-events-none absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 sm:top-3 sm:right-3">
          <div
            data-testid="hud-acwr-verdict"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono-num text-[10px] font-bold tracking-[0.1em] backdrop-blur-md ${statusTone.pill}`}
          >
            {isDanger ? (
              <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ShieldIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {isDeload
                ? `DELOAD · ACWR ${telemetry.acwr.toFixed(2)}`
                : `${telemetry.acwrVerdict} · ${telemetry.acwr.toFixed(2)}`}
            </span>
          </div>

          <div
            className={`rounded-lg border px-2.5 py-1 text-right font-mono-num shadow-sm backdrop-blur-md ${
              isDanger
                ? 'border-rose-500/40 bg-rose-950/88 text-rose-100'
                : isDeload
                  ? 'border-emerald-500/40 bg-emerald-950/88 text-emerald-100'
                  : 'border-black/10 bg-white/90 text-[#0f172a] dark:border-white/15 dark:bg-[#0b0e14]/88 dark:text-slate-100'
            }`}
          >
            <div className="text-[8px] font-semibold tracking-[0.12em] opacity-75">
              {isDeload ? 'HRV REBOUND' : 'HRV READINESS'}
            </div>
            <div data-testid="hud-hrv-readiness" className="text-xs font-bold">
              {telemetry.hrvReadinessPct}% · {telemetry.hrvMs}ms
            </div>
          </div>
        </div>

        {/* Bottom-Left Subtle Interactive Hint (Desktop) */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 hidden items-center gap-2 rounded-md border border-black/10 bg-white/80 px-2 py-1 font-mono-num text-[9px] font-semibold tracking-[0.06em] text-slate-600 backdrop-blur-md sm:inline-flex dark:border-white/10 dark:bg-[#0b0e14]/80 dark:text-slate-300">
          <PulseIcon className="h-3 w-3 text-emerald-600 dark:text-[#a3e635]" />
          <span>
            {lang === 'en'
              ? 'DRAG TO ORBIT · CLICK 3D MUSCLE GROUP TO INSPECT'
              : 'KÉO XOAY 3D · CHẠM NHÓM CƠ ĐỂ XEM CHỈ SỐ'}
          </span>
        </div>

        {/* Bottom-Right Floating Localized 3D Anatomy Telemetry Card (Desktop/Tablet) */}
        <div
          data-testid="anatomy-telemetry-card"
          className="absolute right-3 bottom-3 hidden w-[238px] rounded-xl border border-black/12 bg-white/92 p-2.5 shadow-lg backdrop-blur-md sm:block dark:border-white/15 dark:bg-[#0b0e14]/90"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    isDeload && !selectedSystemTelemetry.stressAlert
                      ? '#10b981'
                      : selectedSystemTelemetry.hexColor,
                }}
              />
              <span className="truncate font-mono-num text-[10px] font-bold tracking-[0.06em] uppercase text-[#0f172a] dark:text-white">
                {lang === 'en'
                  ? selectedSystemTelemetry.shortLabelEn
                  : selectedSystemTelemetry.shortLabelVi}
              </span>
            </div>
            <span className="font-mono-num text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {Math.round(selectedSystemTelemetry.activation * 100)}%
            </span>
          </div>

          {/* Thermal Activation Progress Bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(selectedSystemTelemetry.activation * 100)}%`,
                backgroundColor:
                  isDeload && !selectedSystemTelemetry.stressAlert
                    ? '#10b981'
                    : selectedSystemTelemetry.hexColor,
              }}
            />
          </div>

          {/* Exact Localized Metrics: SmO2 %, Lactate Clearance, Joint Impact G-Force */}
          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-200/80 pt-2 dark:border-slate-800">
            <div>
              <div className="font-mono-num text-[8px] font-semibold text-slate-500">
                SmO2
              </div>
              <div className="font-mono-num text-xs font-bold text-[#0f172a] dark:text-white">
                {selectedSystemTelemetry.smo2Pct}%
              </div>
            </div>
            <div>
              <div className="font-mono-num text-[8px] font-semibold text-slate-500">
                LAC CLR
              </div>
              <div
                className={`font-mono-num text-xs font-bold ${
                  selectedSystemTelemetry.lactateClearanceMmolMin >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {selectedSystemTelemetry.lactateClearanceMmolMin >= 0 ? '+' : ''}
                {selectedSystemTelemetry.lactateClearanceMmolMin.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono-num text-[8px] font-semibold text-slate-500">
                IMPACT
              </div>
              <div
                className={`font-mono-num text-xs font-bold ${
                  selectedSystemTelemetry.stressAlert
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#0f172a] dark:text-white'
                }`}
              >
                {selectedSystemTelemetry.jointImpactG.toFixed(1)}G
              </div>
            </div>
          </div>

          <p className="mt-1.5 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
            {lang === 'en'
              ? selectedSystemTelemetry.clinicalNoteEn
              : selectedSystemTelemetry.clinicalNoteVi}
          </p>
        </div>
      </div>

      {/* Integrated Swiss Biomechanics Control Deck */}
      <div className="space-y-3 border-t border-[var(--vg-border)] bg-[var(--vg-surface)] p-3.5 sm:p-4">
        {/* Mobile Localized Telemetry Readout (shown cleanly below canvas on < sm to avoid canvas crowding) */}
        <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] p-2.5 sm:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-num text-[10px] font-bold uppercase text-[var(--vg-ink)]">
              {lang === 'en'
                ? selectedSystemTelemetry.labelEn
                : selectedSystemTelemetry.labelVi}
            </span>
            <span className="font-mono-num text-[10px] font-bold text-[var(--vg-muted)]">
              SmO2 {selectedSystemTelemetry.smo2Pct}% ·{' '}
              {selectedSystemTelemetry.jointImpactG.toFixed(1)}G
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-[var(--vg-muted)]">
            {lang === 'en'
              ? selectedSystemTelemetry.clinicalNoteEn
              : selectedSystemTelemetry.clinicalNoteVi}
          </p>
        </div>

        {/* Row 1: Live Power Scrubber (100W -> 380W) + 3 Quick Power Zones */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="bio-power-scrubber"
              className="inline-flex items-center gap-1.5 font-mono-num text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--vg-muted)]"
            >
              <ZapIcon className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>
                {lang === 'en' ? 'LIVE OUTPUT POWER' : 'CÔNG SUẤT PHÁT LỰC LIVE'}
              </span>
            </label>
            <div className="flex items-center gap-2 font-mono-num text-xs font-bold">
              <span
                data-testid="power-watts-readout"
                className="text-[var(--vg-ink)]"
              >
                {telemetry.intensityW}W
              </span>
              <span className="text-[10px] font-semibold text-[var(--vg-muted)]">
                · {telemetry.lt2Crossed ? 'ABOVE LT2 (4.0mM)' : telemetry.lt1Crossed ? 'LT1→LT2 TEMPO' : 'SUB-LT1 AEROBIC'}
              </span>
            </div>
          </div>

          <input
            id="bio-power-scrubber"
            data-testid="power-scrubber"
            type="range"
            min={MIN_POWER_W}
            max={MAX_POWER_W}
            step={5}
            value={studioState.intensityW}
            onChange={(e) => {
              const nextW = Number(e.target.value);
              setStudioState((prev) => ({
                ...prev,
                intensityW: nextW,
                protocolMode:
                  prev.acwr > 1.5 ? 'OVERTRAINING_SPIKE' : 'LIVE_TELEMETRY',
              }));
            }}
            className="vg-slider"
            aria-label="Live Athlete Output Power in Watts"
          />

          <div className="grid grid-cols-3 gap-1.5">
            {POWER_PRESETS.map((preset) => {
              const active = Math.abs(studioState.intensityW - preset.watts) <= 8;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`preset-${preset.watts}w`}
                  onClick={() =>
                    setStudioState((prev) => ({
                      ...prev,
                      intensityW: preset.watts,
                      protocolMode:
                        prev.acwr > 1.5
                          ? 'OVERTRAINING_SPIKE'
                          : 'LIVE_TELEMETRY',
                    }))
                  }
                  className={`rounded-lg border px-2 py-1.5 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[#0f172a] bg-[#0f172a] text-white dark:border-[#a3e635] dark:bg-[#a3e635] dark:text-[#08090c]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-ink)] hover:border-[var(--vg-accent)]'
                  }`}
                >
                  <div className="font-mono-num text-[10px] font-bold leading-tight">
                    {lang === 'en' ? preset.labelEn : preset.labelVi}
                  </div>
                  <div
                    className={`mt-0.5 text-[9px] leading-tight ${
                      active
                        ? 'opacity-80'
                        : 'text-[var(--vg-muted)]'
                    }`}
                  >
                    {lang === 'en' ? preset.subEn : preset.subVi}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: 5 Clickable 3D Anatomy System Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {BODY_SYSTEM_ORDER.map((sysId) => {
            const sys = telemetry.bodySystems[sysId];
            const selected = studioState.selectedSystem === sysId;
            return (
              <button
                key={sysId}
                type="button"
                data-testid={`anatomy-chip-${sysId}`}
                onClick={() =>
                  setStudioState((prev) => ({
                    ...prev,
                    selectedSystem: sysId,
                  }))
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-num text-[10px] font-semibold transition-all cursor-pointer ${
                  selected
                    ? 'border-[#0f172a] bg-[#0f172a] text-white dark:border-white dark:bg-white dark:text-[#08090c]'
                    : sys.stressAlert
                      ? 'border-rose-500/50 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface-alt)] text-[var(--vg-muted)] hover:text-[var(--vg-ink)]'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      isDeload && !sys.stressAlert ? '#10b981' : sys.hexColor,
                  }}
                />
                <span>{lang === 'en' ? sys.shortLabelEn : sys.shortLabelVi}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Deterministic Protocol Action Triggers (Overtraining Spike vs Autonomic Deload) */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            data-testid="btn-inject-overtrain"
            onClick={() =>
              setStudioState((prev) => injectOvertrainingSpike(prev))
            }
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono-num text-[10px] font-bold tracking-[0.06em] uppercase transition-all cursor-pointer ${
              isDanger
                ? 'border-rose-600 bg-rose-600 text-white shadow-[0_0_18px_rgba(225,29,72,0.38)]'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-600 hover:text-white dark:text-rose-300'
            }`}
          >
            <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            <span>
              {lang === 'en'
                ? 'INJECT OVERTRAINING (ACWR 1.65)'
                : 'TIÊM QUÁ TẢI (ACWR 1.65)'}
            </span>
          </button>

          <button
            type="button"
            data-testid="btn-prescribe-deload"
            onClick={() =>
              setStudioState((prev) => prescribeAutonomicDeload(prev))
            }
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono-num text-[10px] font-bold tracking-[0.06em] uppercase transition-all cursor-pointer ${
              isDeload
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                : 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-600 hover:text-white dark:text-emerald-300'
            }`}
          >
            <HeartPulseIcon className="h-3.5 w-3.5 shrink-0" />
            <span>
              {lang === 'en'
                ? 'PRESCRIBE AUTONOMIC DELOAD'
                : 'KÊ ĐƠN PHỤC HỒI TỰ CHỦ Z2'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BioAthlete3DStage;
