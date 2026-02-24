'use strict';

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('c'),
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 48, 130);  // vue longue distance

const camera = new THREE.PerspectiveCamera(
  72, window.innerWidth / window.innerHeight,
  0.05, 200  // far clip augmenté
);
camera.rotation.order = 'YXZ';

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sunLight = new THREE.DirectionalLight(0xFFFBE0, 1.0);
sunLight.position.set(1, 3, 0.5);
scene.add(sunLight);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
