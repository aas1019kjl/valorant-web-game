import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

export function buildMap(scene) {
  const obstacles = [];

  const groundGeo = new THREE.PlaneGeometry(CONFIG.MAP_SIZE, CONFIG.MAP_SIZE);
  const groundMat = new THREE.MeshPhongMaterial({ color: COLORS.GROUND });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const wallMat = new THREE.MeshPhongMaterial({ color: COLORS.WALL });
  const h = CONFIG.WALL_HEIGHT;
  const half = CONFIG.MAP_SIZE / 2;

  const walls = [
    { w: CONFIG.MAP_SIZE, d: 1, x: 0, z: -half },
    { w: CONFIG.MAP_SIZE, d: 1, x: 0, z: half },
    { w: 1, d: CONFIG.MAP_SIZE, x: half, z: 0 },
    { w: 1, d: CONFIG.MAP_SIZE, x: -half, z: 0 },
  ];

  for (const w of walls) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, h, w.d),
      wallMat,
    );
    mesh.position.set(w.x, h / 2, w.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
  }

  const obsMat = new THREE.MeshPhongMaterial({ color: COLORS.OBSTACLE });
  for (let i = 0; i < 10; i++) {
    const size = 2 + Math.random() * 4;
    const x = (Math.random() - 0.5) * (CONFIG.MAP_SIZE - 30);
    const z = (Math.random() - 0.5) * (CONFIG.MAP_SIZE - 30);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 1.5, size),
      obsMat,
    );
    mesh.position.set(x, size * 0.75, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
  }

  return obstacles;
}
