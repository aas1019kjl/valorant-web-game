import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { Player } from './Player.js';
import { Projectile } from './Projectile.js';
import { buildMap } from './MapBuilder.js';
import { InputManager } from './InputManager.js';
import { HUD } from './HUD.js';
import { Radar } from './Radar.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.BG);
    this.scene.fog = new THREE.Fog(COLORS.BG, 60, 150);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this._setupLights();

    this.players = [];
    this.bots = [];
    this.projectiles = [];
    this.effects = [];
    this.obstacles = [];

    this.input = new InputManager(canvas);
    this.hud = new HUD();
    this.radar = new Radar();

    this._lastTime = performance.now();
    this._running = false;

    window.addEventListener('resize', () => this._onResize());
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -100;
    dir.shadow.camera.right = 100;
    dir.shadow.camera.top = 100;
    dir.shadow.camera.bottom = -100;
    this.scene.add(dir);

    const hemi = new THREE.HemisphereLight(0x4466ff, 0x2a2d3e, 0.3);
    this.scene.add(hemi);
  }

  init() {
    this.obstacles = buildMap(this.scene);

    const player = new Player(this.scene, 0, -30, false);
    this.players.push(player);

    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 60 + 20;
      this.bots.push(new Player(this.scene, x, z, true));
    }
  }

  start() {
    this._running = true;
    this._loop();
  }

  _loop() {
    if (!this._running) return;

    const now = performance.now();
    const deltaTime = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;

    this._update(deltaTime);
    this._render();

    requestAnimationFrame(() => this._loop());
  }

  _update(deltaTime) {
    const player = this.players[0];

    for (const p of this.players) p.update(deltaTime, this.input, this);
    for (const bot of this.bots) bot.update(deltaTime, this.input, this);

    const allTargets = [...this.players, ...this.bots];
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(deltaTime, allTargets);
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].update(deltaTime);
      if (!this.effects[i].alive) this.effects.splice(i, 1);
    }

    this._checkDeaths(player);

    if (player && player.alive) {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.copy(player.rotation);
      this.camera.position.copy(player.position);
      this.camera.position.y += 0.8;
    }

    this.hud.update(player, this, deltaTime);
    this.radar.update(player, this.bots, this.effects);
  }

  _checkDeaths(player) {
    for (const bot of this.bots) {
      if (!bot._deathHandled && !bot.alive) {
        bot._deathHandled = true;
        if (player) {
          player.kills++;
          this.hud.showKill('You', 'Bot');
          this.hud.showCenterMessage('ENEMY DOWN');
        }
        setTimeout(() => { bot._deathHandled = false; }, 100);
      }
    }

    if (player && !player._deathHandled && !player.alive) {
      player._deathHandled = true;
      this.hud.showKill('Bot', 'You');
      this.hud.showCenterMessage('YOU DIED');
      this.hud.flashDamage();
      setTimeout(() => { player._deathHandled = false; }, 100);
    }

    if (player && player.alive && player.health < player._lastHealth) {
      this.hud.flashDamage();
    }
    if (player) player._lastHealth = player.health;
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  destroy() {
    this._running = false;
    this.input.dispose();
    for (const p of this.players) p.destroy();
    for (const b of this.bots) b.destroy();
    for (const pr of this.projectiles) pr.destroy();
    for (const e of this.effects) e.destroy();
    this.renderer.dispose();
  }
}
