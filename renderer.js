'use strict';

// ══════════════════════════════════════════════════════════════
//  SETUP THREE.JS
// ══════════════════════════════════════════════════════════════

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('c'),
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); // ciel bleu

// ── Scène ──────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 32, 62);

// ── Caméra (vue joueur) ────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  72,                                          // FOV
  window.innerWidth / window.innerHeight,      // aspect
  0.05,                                        // near
  70                                           // far
);
camera.rotation.order = 'YXZ'; // yaw → pitch → roll

// ── Éclairage ──────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xFFFBE0, 1.0);
sunLight.position.set(1, 3, 0.5);
scene.add(sunLight);

// ── Gestion du redimensionnement ──────────────────────────────
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
