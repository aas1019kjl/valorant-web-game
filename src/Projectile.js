import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';

export class Projectile {
  constructor(scene, position, direction, ownerId, isUltimate = false) {
    this.scene = scene;
    this.position = position.clone();
    this.direction = direction.clone().normalize();
    this.ownerId = ownerId;
    this.speed = CONFIG.PROJECTILE_SPEED;
    this.damage = isUltimate ? CONFIG.ULT_PROJECTILE_DAMAGE : CONFIG.PROJECTILE_DAMAGE;
    this.isUltimate = isUltimate;
    this.life = CONFIG.PROJECTILE_LIFE;
    this.alive = true;

    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: isUltimate ? COLORS.ULT_PROJECTILE : COLORS.PROJECTILE,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  update(deltaTime, targets) {
    this.position.add(this.direction.clone().multiplyScalar(this.speed));
    this.mesh.position.copy(this.position);
    this.life -= deltaTime;

    for (const target of targets) {
      if (target.id === this.ownerId || target.health <= 0) continue;
      if (this.position.distanceTo(target.position) < 1.0) {
        target.takeDamage(this.damage);
        this.destroy();
        return;
      }
    }

    if (this.life <= 0 || this.position.y < 0 ||
        Math.abs(this.position.x) > CONFIG.MAP_SIZE ||
        Math.abs(this.position.z) > CONFIG.MAP_SIZE) {
      this.destroy();
    }
  }

  destroy() {
    this.alive = false;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
