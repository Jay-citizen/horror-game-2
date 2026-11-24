import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ab4cc);
scene.fog = new THREE.FogExp2(0x9ab4cc, 0.014);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4535, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(-40, 80, 30); scene.add(sun);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const world = new World(scene);
world.loadAround(8, 8, 2);
const player = new Player(world, camera, scene);
player.pos.set(8.5, world.surfaceHeight(8, 8) + 2, 8.5);

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  player.locked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = player.locked ? 'none' : 'flex';
  if (!player.locked) player.mouseL = false;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  player.update(dt);
  world.update(player.pos.x, player.pos.z);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
