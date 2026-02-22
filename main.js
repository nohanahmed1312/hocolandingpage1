import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// --- Scene Setup ---
const scene = new THREE.Scene();

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

// --- Renderer ---
const canvas = document.querySelector('#bg');
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Lighting Environment ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// --- Objects ---
let headphonesModel = null;
const loader = new GLTFLoader();

// --- Materials Logic ---
// We will modify existing materials to preserve textures (if any), 
// rather than replacing them completely.

let currentTheme = 'black';

function applyTheme(color) {
  if (!headphonesModel) return;
  currentTheme = color;

  headphonesModel.traverse((node) => {
    if (node.isMesh && node.material) {
      // Clone material so we don't mess up shared references irreversibly if needed, 
      // but here we just modify the instance for performance/simplicity in this toggle.
      // Ideally we cache original materials, but for this simple toggle adjusting props is fine.

      const mat = node.material;
      const name = (node.name || "").toLowerCase();
      const matName = (mat.name || "").toLowerCase();

      // Identify presumed "Metal" parts
      const isMetalPart = name.includes('metal') || name.includes('silver') || name.includes('connector') ||
        matName.includes('metal') || matName.includes('silver');

      if (color === 'black') {
        // --- PREMIUM BLACK THEME ---
        if (isMetalPart) {
          // Chrome Accents (Shiny)
          mat.color.set(0xeeeeee);
          mat.metalness = 1.0;
          mat.roughness = 0.15;
        } else {
          // Black Body (Satin/Leather mix)
          // Slightly less metallic to look like high-quality plastic/leather
          mat.color.set(0x111111);
          mat.metalness = 0.2;
          mat.roughness = 0.35;
        }
      } else if (color === 'silver') {
        // --- SLEEK SILVER THEME ---
        if (isMetalPart) {
          // Chrome Accents
          mat.color.set(0xffffff);
          mat.metalness = 1.0;
          mat.roughness = 0.1;
        } else {
          // Silver Body
          // A darker grey base allows the reflections to shine, looking like real metal.
          // Pure white looks like plastic.
          mat.color.set(0xaaaaaa); // Standard Silver Grey
          mat.metalness = 1.0;     // Fully metallic
          mat.roughness = 0.25;    // Sharper reflections
        }
      }

      mat.needsUpdate = true;
    }
  });
}

loader.load(
  '/hoco_w35.glb',
  (gltf) => {
    headphonesModel = gltf.scene;

    // --- Scale Normalization logic ---
    const box = new THREE.Box3().setFromObject(headphonesModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Resize to always be roughly 4.5 units wide/tall (Larger)
    const scaleFactor = 4.5 / (maxDim || 1);
    headphonesModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Center model at 0,0,0
    // 1. Get the bounding box of the SCALED model
    const boundingBox = new THREE.Box3().setFromObject(headphonesModel);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center); // This is the World Center of the model right now

    // 2. Adjust position to move that center to (0,0,0)
    // We strictly subtract the current center offset.
    headphonesModel.position.x -= center.x;
    headphonesModel.position.y -= center.y;
    headphonesModel.position.z -= center.z;

    // 3. Optional: Fine-tune vertical position visually
    // Since geometric center might be different from visual center
    headphonesModel.position.y += 0.5; // Lift it up a bit visually

    headphonesModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    // Apply initial theme
    applyTheme('black');

    scene.add(headphonesModel);
  },
  undefined,
  (error) => {
    console.error('An error occurred loading the model:', error);
  }
);

// --- Particle System ---
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 700;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 15;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
  size: 0.02, color: 0xaaaaaa, transparent: true, opacity: 0.8,
});
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// --- Lighting ---
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xccddff, 5);
pointLight.position.set(-3, 2, -3);
scene.add(pointLight);

// --- Interaction Logic ---
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
  mouseX = (event.clientX - windowHalfX);
  mouseY = (event.clientY - windowHalfY);
});

let scrollY = window.scrollY;
window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
});

// Color Picker Logic
const buttons = document.querySelectorAll('.color-btn');
buttons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // UI Update
    buttons.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    // Theme Update
    const color = e.target.getAttribute('data-color');
    applyTheme(color);
  });
});


// --- Resize Handling ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  const elapsedTime = clock.getElapsedTime();

  targetX = mouseX * 0.001;
  targetY = mouseY * 0.001;

  if (headphonesModel) {
    // Scroll Animation (Position based)
    const baseRotation = elapsedTime * 0.2;
    const scrollRotation = scrollY * 0.002;
    headphonesModel.rotation.y = baseRotation + scrollRotation;

    // Interactive tilt
    headphonesModel.rotation.x += 0.05 * (targetY - headphonesModel.rotation.x);
    headphonesModel.rotation.z += 0.05 * (targetX - headphonesModel.rotation.z);
  }

  // Animate particles
  particlesMesh.rotation.y = -scrollY * 0.0005 + elapsedTime * 0.05;
  particlesMesh.rotation.x = -mouseY * 0.0001;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();