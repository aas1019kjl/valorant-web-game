import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { Projectile } from './Projectile.js';
import { Effect } from './Effect.js';

let nextId = 0;

export class Player {
  constructor(scene, x, z, isBot = false) {
    this.scene = scene;
    this.id = ++nextId;
    this.isBot = isBot;
    this.position = new THREE.Vector3(x, CONFIG.GROUND_Y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');

    this.health = CONFIG.MAX_HEALTH;
    this.shield = 0;
    this.ammo = CONFIG.MAGAZINE_SIZE;
    this.totalAmmo = CONFIG.MAX_AMMO;
    this.ultimate = 0;
    this.maxUltimate = CONFIG.ULT_THRESHOLD;
    this.reloading = false;
    this.reloadTimer = 0;

    this.abilities = {};
    for (const [k, v] of Object.entries(CONFIG.ABILITIES)) {
      this.abilities[k] = { name: v.name, cooldown: 0, maxCooldown: v.maxCooldown, ready: true };
    }

    this.healActive = false;
    this.healTimer = 0;
    this.isStunned = false;
    this.stunDuration = 0;
    this.alive = true;
    this.lastShootTime = 0;
    this.kills = 0;
    this.deaths = 0;

    this._createMesh();
  }

  _createMesh() {
    const color = this.isBot ? COLORS.BOT : COLORS.PLAYER;
    const headColor = this.isBot ? COLORS.BOT_HEAD : COLORS.PLAYER_HEAD;

    const geo = new THREE.BoxGeometry(0.6, 2, 0.6);
    const mat = new THREE.MeshPhongMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshPhongMaterial({ color: headColor });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = 0.8;
    this.mesh.add(this.head);
  }

  getForward() {
    return new THREE.Vector3(
      Math.sin(this.rotation.y), 0, Math.cos(this.rotation.y),
    );
  }

  getRight() {
    return new THREE.Vector3(
      Math.cos(this.rotation.y), 0, -Math.sin(this.rotation.y),
    );
  }

  update(deltaTime, input, game) {
    if (!this.alive) return;

    if (this.isBot) {
      this._updateBot(deltaTime, game);
    } else {
      this._updateHuman(deltaTime, input, game);
    }

    this.position.add(this.velocity);
    this.mesh.position.copy(this.position);

    if (this.position.y > CONFIG.GROUND_Y) {
      this.velocity.y -= CONFIG.GRAVITY;
    } else {
      this.position.y = CONFIG.GROUND_Y;
      this.velocity.y = 0;
    }

    const half = CONFIG.MAP_SIZE / 2 - 1;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -half, half);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -half, half);

    this._updateAbilities(deltaTime);

    if (this.isStunned) {
      this.stunDuration -= deltaTime;
      if (this.stunDuration <= 0) this.isStunned = false;
    }

    if (this.healActive) {
      this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.HEAL_RATE);
      this.healTimer -= deltaTime * 1000;
      if (this.healTimer <= 0) this.healActive = false;
    }

    this.ultimate = Math.min(this.maxUltimate, this.ultimate + CONFIG.ULT_PASSIVE_RATE * deltaTime * 60);
    this.abilities.F.ready = this.ultimate >= this.maxUltimate;

    if (this.reloading) {
      this.reloadTimer -= deltaTime * 1000;
      if (this.reloadTimer <= 0) this._finishReload();
    }
  }

  _updateHuman(deltaTime, input, game) {
    if (this.isStunned) return;

    const speed = CONFIG.PLAYER_SPEED;
    const fwd = this.getForward();
    const right = this.getRight();

    if (input.keys['w']) this.velocity.add(fwd.clone().multiplyScalar(speed));
    if (input.keys['s']) this.velocity.add(fwd.clone().multiplyScalar(-speed));
    if (input.keys['a']) this.velocity.add(right.clone().multiplyScalar(-speed));
    if (input.keys['d']) this.velocity.add(right.clone().multiplyScalar(speed));

    this.velocity.x *= CONFIG.PLAYER_FRICTION;
    this.velocity.z *= CONFIG.PLAYER_FRICTION;

    const md = input.consumeMouseDelta();
    this.rotation.y -= md.dx * CONFIG.MOUSE_SENSITIVITY;
    this.rotation.x -= md.dy * CONFIG.MOUSE_SENSITIVITY;
    this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI / 2, Math.PI / 2);

    if (input.consumeShoot()) this.shoot(game);
    if (input.consumeReload()) this.reload();

    const ability = input.consumeAbility();
    if (ability) this.useAbility(ability, game);
  }

  _updateBot(deltaTime, game) {
    if (this.isStunned) return;

    const player = game.players[0];
    if (!player || !player.alive) return;

    const dir = player.position.clone().sub(this.position);
    const dist = dir.length();
    dir.y = 0;
    if (dist > 0.1) {
      dir.normalize();
      this.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const speed = CONFIG.PLAYER_SPEED * CONFIG.BOT_SPEED_MULT;
    const fwd = this.getForward();

    if (dist > 6) {
      this.velocity.copy(fwd.clone().multiplyScalar(speed));
    } else {
      this.velocity.multiplyScalar(0.5);
    }

    if (dist < CONFIG.BOT_SHOOT_RANGE && Math.random() < CONFIG.BOT_SHOOT_CHANCE) {
      this.shoot(game);
    }

    if (Math.random() < CONFIG.BOT_ABILITY_CHANCE && this.abilities.Q.ready) {
      this.useAbility('Q', game);
    }
    if (Math.random() < CONFIG.BOT_ULT_CHANCE && this.abilities.F.ready) {
      this.useAbility('F', game);
    }
  }

  shoot(game) {
    const now = performance.now();
    if (now - this.lastShootTime < CONFIG.SHOOT_COOLDOWN) return;
    if (this.ammo <= 0 || this.reloading) return;

    this.lastShootTime = now;
    this.ammo--;

    const dir = new THREE.Vector3(
      Math.sin(this.rotation.y) + (Math.random() - 0.5) * 0.08,
      -Math.sin(this.rotation.x) + (Math.random() - 0.5) * 0.08,
      Math.cos(this.rotation.y) + (Math.random() - 0.5) * 0.08,
    ).normalize();

    const origin = this.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    game.projectiles.push(new Projectile(this.scene, origin, dir, this.id, false));

    this.ultimate = Math.min(this.maxUltimate, this.ultimate + CONFIG.ULT_PER_HIT);
  }

  reload() {
    if (this.reloading || this.ammo === CONFIG.MAGAZINE_SIZE || this.totalAmmo <= 0) return;
    this.reloading = true;
    this.reloadTimer = CONFIG.RELOAD_TIME;
  }

  _finishReload() {
    const needed = CONFIG.MAGAZINE_SIZE - this.ammo;
    const taken = Math.min(needed, this.totalAmmo);
    this.ammo += taken;
    this.totalAmmo -= taken;
    this.reloading = false;
  }

  useAbility(key, game) {
    const ab = this.abilities[key];
    if (!ab || !ab.ready) return;
    if (key === 'F' && this.ultimate < this.maxUltimate) return;

    ab.cooldown = ab.maxCooldown;
    ab.ready = false;

    switch (key) {
      case 'Q':
        this._createSmoke(game);
        break;
      case 'E':
        this.healActive = true;
        this.healTimer = CONFIG.HEAL_DURATION;
        break;
      case 'R':
        this._createStun(game);
        break;
      case 'F':
        this._launchUltimate(game);
        this.ultimate = 0;
        break;
    }
  }

  _createSmoke(game) {
    const pos = this.position.clone().add(
      this.getForward().multiplyScalar(5),
    );
    pos.y = CONFIG.GROUND_Y;
    game.effects.push(new Effect(this.scene, 'smoke', pos, CONFIG.SMOKE_DURATION));
  }

  _createStun(game) {
    for (const bot of game.bots) {
      if (!bot.alive) continue;
      if (bot.position.distanceTo(this.position) < CONFIG.STUN_RADIUS) {
        bot.isStunned = true;
        bot.stunDuration = CONFIG.STUN_DURATION;
      }
    }
  }

  _launchUltimate(game) {
    for (let i = 0; i < CONFIG.ULT_PROJECTILES; i++) {
      const angle = (i / CONFIG.ULT_PROJECTILES) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
      const origin = this.position.clone().add(new THREE.Vector3(0, 0.5, 0));
      game.projectiles.push(new Projectile(this.scene, origin, dir, this.id, true));
    }
  }

  takeDamage(amount) {
    const shieldAbsorb = Math.min(this.shield, amount);
    this.shield -= shieldAbsorb;
    this.health -= (amount - shieldAbsorb);

    if (this.health <= 0 && this.alive) {
      this.die();
    }
  }

  die() {
    this.health = 0;
    this.alive = false;
    this.deaths++;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();

    setTimeout(() => this.respawn(), CONFIG.RESPAWN_DELAY);
  }

  respawn() {
    this.health = CONFIG.MAX_HEALTH;
    this.shield = 0;
    this.ammo = CONFIG.MAGAZINE_SIZE;
    this.totalAmmo = CONFIG.MAX_AMMO;
    this.ultimate = 0;
    this.alive = true;
    this.reloading = false;
    this.position.set(
      (Math.random() - 0.5) * 60,
      CONFIG.GROUND_Y,
      (Math.random() - 0.5) * 60,
    );
    this.velocity.set(0, 0, 0);
    this._createMesh();
  }

  _updateAbilities(deltaTime) {
    for (const key of Object.keys(this.abilities)) {
      const ab = this.abilities[key];
      if (ab.cooldown > 0) {
        ab.cooldown -= deltaTime;
        if (ab.cooldown <= 0) {
          ab.cooldown = 0;
          ab.ready = key !== 'F' || this.ultimate >= this.maxUltimate;
        } else {
          ab.ready = false;
        }
      }
    }
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
