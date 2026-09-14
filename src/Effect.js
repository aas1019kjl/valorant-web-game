import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

export class Effect {
  constructor(scene, type, position, duration) {
    this.scene = scene;
    this.type = type;
    this.position = position.clone();
    this.duration = duration / 1000;
    this.age = 0;
    this.alive = true;

    if (type === 'smoke') {
      const geo = new THREE.SphereGeometry(CONFIG.SMOKE_RADIUS, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.SMOKE,
        transparent: true,
        opacity: 0.4,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.copy(this.position);
      scene.add(this.mesh);
    }
  }

  update(deltaTime) {
    this.age += deltaTime;
    if (this.mesh) {
      this.mesh.material.opacity = 0.4 * (1 - this.age / this.duration);
    }
    if (this.age >= this.duration) this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
