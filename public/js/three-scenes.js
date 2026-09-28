/* =========================================================
   NEXUS STORE — Three.js background scenes
   Home: chrome spheres + hex prisms morphing through 4 scroll phases
   Products: holographic floating product boxes
   About: neural-network particle field contracting to a "brain" silhouette
   ========================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("scene-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

// Shared PBR environment map (procedural room) so chrome/holographic materials
// have something believable to reflect, without loading external HDRIs.
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;

// ---------------- Neon lighting rig ----------------
const neonGreen = new THREE.PointLight(0x00ff88, 2.0, 15);
neonGreen.position.set(-5, 3, 4);
const neonCyan = new THREE.PointLight(0x00d4ff, 2.0, 15);
neonCyan.position.set(5, -3, 4);
const neonPurple = new THREE.PointLight(0x7c3aed, 1.5, 12);
neonPurple.position.set(0, 6, -4);
scene.add(neonGreen, neonCyan, neonPurple);
scene.add(new THREE.AmbientLight(0x223344, 0.6));

const lights = [neonGreen, neonCyan, neonPurple];
const baseIntensity = [2.0, 2.0, 1.5];

// ---------------- Mouse / pointer tracking ----------------
const pointer = { x: 0, y: 0, ndcX: 0, ndcY: 0 };
window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
});

const raycaster = new THREE.Raycaster();
const repulsionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const repulsionPoint = new THREE.Vector3();
const REPULSION_RADIUS = 1.5;
const REPULSION_STRENGTH = 0.15;

function updateRepulsionPoint() {
  raycaster.setFromCamera({ x: pointer.ndcX, y: pointer.ndcY }, camera);
  raycaster.ray.intersectPlane(repulsionPlane, repulsionPoint);
  if (!repulsionPoint) repulsionPoint.set(0, 0, 0);
}

/* =========================================================
   HOME SCENE — chrome spheres + hex prisms, 4 scroll phases
   ========================================================= */
const homeGroup = new THREE.Group();
scene.add(homeGroup);

const SPHERE_COUNT = 96;
const PRISM_COUNT = 12;
const TOTAL = SPHERE_COUNT + PRISM_COUNT;

function helixPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 6;
    const strand = i % 2 === 0 ? 1 : -1;
    pts.push({
      x: Math.cos(t) * 0.6 * strand,
      y: t / (Math.PI * 6) - 0.5,
    });
  }
  return pts;
}

const helixRaw = helixPoints(TOTAL);

// Precompute the 4 phase target positions for every instanced object.
const phasePositions = [[], [], [], []]; // [phaseIndex][objIndex] = THREE.Vector3

// Phase 0: double-helix DNA formation
helixRaw.forEach((p, i) => {
  const t = (i / TOTAL) * Math.PI * 6;
  phasePositions[0].push(new THREE.Vector3(p.x * 4.2, p.y * 6.5, Math.sin(t) * 1.4));
});

// Phase 1: crash down / spark-scatter across a "floor"
for (let i = 0; i < TOTAL; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 6.5;
  const restitution = 0.8; // bounce energy -> scatter height variance
  phasePositions[1].push(
    new THREE.Vector3(
      Math.cos(angle) * radius,
      -3.2 + Math.random() * restitution * 2.4,
      Math.sin(angle) * radius * 0.6 - 1
    )
  );
}

// Phase 2: circuit board Manhattan trace grid (with gaps)
{
  const cols = 12;
  const spacing = 0.95;
  let idx = 0;
  const cells = [];
  for (let gx = -cols / 2; gx < cols / 2; gx++) {
    for (let gy = -4; gy < 4; gy++) {
      if ((gx + gy) % 3 === 0) continue; // gaps in the trace
      cells.push([gx, gy]);
    }
  }
  for (let i = 0; i < TOTAL; i++) {
    const cell = cells[i % cells.length];
    const jitter = (Math.random() - 0.5) * 0.15;
    phasePositions[2].push(
      new THREE.Vector3(cell[0] * spacing + jitter, cell[1] * spacing + jitter, -0.5 + (i % 5) * 0.08)
    );
    idx++;
  }
}

// Phase 3: incoming data packets — flying toward the camera
for (let i = 0; i < TOTAL; i++) {
  const a = (i / TOTAL) * Math.PI * 2;
  phasePositions[3].push(
    new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 3), Math.sin(a) * (1 + Math.random() * 3), 6 + Math.random() * 4)
  );
}

const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xe8e8e8,
  metalness: 1.0,
  roughness: 0.02,
  envMapIntensity: 3.0,
});
const prismMat = new THREE.MeshStandardMaterial({
  color: 0x00ff88,
  metalness: 0.9,
  roughness: 0.15,
  envMapIntensity: 2.2,
  emissive: 0x003318,
  emissiveIntensity: 0.6,
});

const sphereGeo = new THREE.SphereGeometry(0.16, 24, 24);
const prismGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 6);

const homeMeshes = [];
for (let i = 0; i < SPHERE_COUNT; i++) {
  const m = new THREE.Mesh(sphereGeo, chromeMat);
  m.position.copy(phasePositions[0][i]);
  homeGroup.add(m);
  homeMeshes.push(m);
}
for (let i = 0; i < PRISM_COUNT; i++) {
  const idx = SPHERE_COUNT + i;
  const m = new THREE.Mesh(prismGeo, prismMat.clone());
  m.rotation.x = Math.PI / 2;
  m.position.copy(phasePositions[0][idx]);
  homeGroup.add(m);
  homeMeshes.push(m);
}

let homeScrollProgress = 0; // 0..1 across the home route's scroll height
let homePhaseFloat = 0;

function updateHomeScrollProgress() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  homeScrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  homePhaseFloat = homeScrollProgress * 3; // 3 segments across 4 phases
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function animateHomeScene(elapsed, delta) {
  const phaseIndex = Math.min(2, Math.floor(homePhaseFloat));
  const localT = smoothstep(Math.min(1, homePhaseFloat - phaseIndex));
  const isFlashPhase = phaseIndex === 2 && localT > 0.6;

  homeGroup.rotation.y += delta * 0.05;

  for (let i = 0; i < homeMeshes.length; i++) {
    const mesh = homeMeshes[i];
    const a = phasePositions[phaseIndex][i];
    const b = phasePositions[phaseIndex + 1][i];
    const target = new THREE.Vector3().lerpVectors(a, b, localT);

    // gentle idle bob so it never looks frozen
    target.y += Math.sin(elapsed * 0.6 + i) * 0.05;

    // mouse repulsion
    const dx = target.x - repulsionPoint.x;
    const dy = target.y - repulsionPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < REPULSION_RADIUS && dist > 0.0001) {
      const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
      target.x += (dx / dist) * force * 4;
      target.y += (dy / dist) * force * 4;
    }

    mesh.position.lerp(target, 0.09);
    mesh.rotation.x += delta * (0.2 + (i % 5) * 0.05);
    mesh.rotation.y += delta * (0.15 + (i % 3) * 0.04);

    if (mesh.material.emissiveIntensity !== undefined) {
      const flash = isFlashPhase ? 1.2 + Math.sin(elapsed * 12 + i) * 0.8 : 0.6;
      mesh.material.emissiveIntensity = Math.max(0.2, flash);
    }
  }
}

/* =========================================================
   PRODUCTS SCENE — holographic floating boxes
   ========================================================= */
const productsGroup = new THREE.Group();
productsGroup.visible = false;
scene.add(productsGroup);

const boxDims = [
  [0.5, 1.0, 0.06], // phone
  [1.4, 0.9, 0.08], // laptop
  [0.9, 1.2, 0.05], // tablet
  [0.4, 0.4, 0.4], // console cube
  [0.3, 0.3, 0.3], // earbud case
  [1.6, 0.15, 1.0], // keyboard
];

const productMeshes = [];
for (let i = 0; i < 22; i++) {
  const dims = boxDims[i % boxDims.length];
  const geo = new THREE.BoxGeometry(...dims);
  const hue = (i / 22) * 0.6 + 0.35;
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(hue % 1, 0.7, 0.55),
    metalness: 0.3,
    roughness: 0.15,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 800],
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.8,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const angle = (i / 22) * Math.PI * 2;
  const radius = 2.6 + (i % 4) * 0.8;
  mesh.position.set(Math.cos(angle) * radius, Math.sin(i * 1.7) * 2.2, Math.sin(angle) * radius - 2);
  mesh.userData.baseSpin = 0.15 + Math.random() * 0.15;
  mesh.userData.hoverSpin = 0;
  mesh.userData.angle = angle;
  mesh.userData.radius = radius;
  mesh.userData.vOffset = Math.random() * Math.PI * 2;
  productsGroup.add(mesh);
  productMeshes.push(mesh);
}

const productRaycaster = new THREE.Raycaster();
window.addEventListener("pointermove", () => {
  if (!productsGroup.visible) return;
  productRaycaster.setFromCamera({ x: pointer.ndcX, y: pointer.ndcY }, camera);
  const hits = productRaycaster.intersectObjects(productMeshes);
  productMeshes.forEach((m) => (m.userData.hoverSpin = 0));
  if (hits[0]) hits[0].object.userData.hoverSpin = 2.2;
});

function animateProductsScene(elapsed, delta) {
  productsGroup.rotation.y += delta * 0.03;
  productMeshes.forEach((mesh) => {
    const spin = mesh.userData.baseSpin + mesh.userData.hoverSpin;
    mesh.rotation.x += delta * spin * 0.6;
    mesh.rotation.y += delta * spin;
    mesh.position.y += Math.sin(elapsed * 0.5 + mesh.userData.vOffset) * 0.002;
    mesh.userData.hoverSpin *= 0.95;
  });
}

/* =========================================================
   ABOUT SCENE — neural network particles -> brain silhouette
   ========================================================= */
const aboutGroup = new THREE.Group();
aboutGroup.visible = false;
scene.add(aboutGroup);

const NODE_COUNT = 200;
const nodeGeo = new THREE.SphereGeometry(0.04, 8, 8);
const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

const nodeCloudPositions = [];
const nodeBrainPositions = [];
const nodeMeshes2 = [];

for (let i = 0; i < NODE_COUNT; i++) {
  const cloud = new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
  nodeCloudPositions.push(cloud);

  // Rough "brain silhouette": two lobes (ellipsoid blobs) with a central fold
  const lobe = Math.random() < 0.5 ? -1 : 1;
  const u = Math.random() * Math.PI * 2;
  const v = Math.acos(2 * Math.random() - 1);
  const r = 1.1 + Math.random() * 0.25;
  const bx = lobe * (0.55 + Math.abs(Math.sin(u)) * 0.9) + Math.sin(u) * r * 0.4;
  const by = Math.cos(v) * r * 0.9 + Math.sin(u * 2) * 0.15;
  const bz = Math.sin(u) * Math.sin(v) * r * 0.7;
  nodeBrainPositions.push(new THREE.Vector3(bx, by, bz));

  const mesh = new THREE.Mesh(nodeGeo, nodeMat);
  mesh.position.copy(cloud);
  aboutGroup.add(mesh);
  nodeMeshes2.push(mesh);
}

const lineMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.35 });
let lineSegments = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
aboutGroup.add(lineSegments);

let aboutScrollProgress = 0;
let lineRebuildCounter = 0;

function updateAboutScrollProgress() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  aboutScrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function rebuildNeuralLines() {
  const positions = [];
  const pts = nodeMeshes2.map((m) => m.position);
  const maxDist = 1.2;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].distanceTo(pts[j]) < maxDist) {
        positions.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
  }
  lineSegments.geometry.dispose();
  lineSegments.geometry = new THREE.BufferGeometry();
  lineSegments.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
}

function animateAboutScene(elapsed, delta) {
  const t = smoothstep(aboutScrollProgress);
  aboutGroup.rotation.y += delta * 0.04;

  for (let i = 0; i < nodeMeshes2.length; i++) {
    const target = new THREE.Vector3().lerpVectors(nodeCloudPositions[i], nodeBrainPositions[i], t);
    target.x += Math.sin(elapsed * 0.4 + i) * 0.03 * (1 - t);
    nodeMeshes2[i].position.lerp(target, 0.06);
  }

  const pulse = 0.25 + Math.sin(elapsed * 2.0) * 0.15;
  lineMat.opacity = Math.max(0.08, pulse);
  lineMat.color.setHSL(0.5 + Math.sin(elapsed * 0.3) * 0.08, 1, 0.55);

  lineRebuildCounter += delta;
  if (lineRebuildCounter > 0.28) {
    lineRebuildCounter = 0;
    rebuildNeuralLines();
  }
}

/* =========================================================
   Route switching
   ========================================================= */
export function setActiveScene(route) {
  homeGroup.visible = route === "home";
  productsGroup.visible = ["products", "deals", "gaming", "pro"].includes(route);
  aboutGroup.visible = route === "about";
}

/* =========================================================
   Render loop
   ========================================================= */
const clock = new THREE.Clock();

function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateRepulsionPoint();
  updateHomeScrollProgress();
  updateAboutScrollProgress();

  lights.forEach((light, i) => {
    light.intensity = baseIntensity[i] + Math.sin(elapsed * 2.0 + i) * 0.3;
  });

  if (homeGroup.visible) animateHomeScene(elapsed, delta);
  if (productsGroup.visible) animateProductsScene(elapsed, delta);
  if (aboutGroup.visible) animateAboutScene(elapsed, delta);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
