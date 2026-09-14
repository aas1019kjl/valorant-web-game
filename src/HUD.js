import { CONFIG } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      healthText: document.getElementById('healthText'),
      healthBar: document.getElementById('healthBar'),
      shieldText: document.getElementById('shieldText'),
      shieldBar: document.getElementById('shieldBar'),
      ammoText: document.getElementById('ammoText'),
      ultText: document.getElementById('ultText'),
      ultBar: document.getElementById('ultBar'),
      abilityQ: document.getElementById('abilityQ'),
      abilityE: document.getElementById('abilityE'),
      abilityR: document.getElementById('abilityR'),
      abilityF: document.getElementById('abilityF'),
      debug: document.getElementById('debug'),
      killFeed: document.getElementById('killFeed'),
      centerMessage: document.getElementById('centerMessage'),
      damageVignette: document.getElementById('damageVignette'),
    };
    this._fpsSamples = [];
    this._lastFpsUpdate = 0;
    this._fps = 0;
  }

  update(player, game, deltaTime) {
    if (!player) return;

    const hp = Math.max(0, Math.ceil(player.health));
    this.el.healthText.textContent = `${hp}/${CONFIG.MAX_HEALTH}`;
    this.el.healthBar.style.width = `${(player.health / CONFIG.MAX_HEALTH) * 100}%`;
    this.el.healthBar.classList.toggle('low', player.health < 30);

    const sh = Math.max(0, Math.ceil(player.shield));
    this.el.shieldText.textContent = `${sh}/${CONFIG.MAX_SHIELD}`;
    this.el.shieldBar.style.width = `${(player.shield / CONFIG.MAX_SHIELD) * 100}%`;

    const ammoDisplay = player.reloading ? 'RELOADING' : `${player.ammo} / ${player.totalAmmo}`;
    this.el.ammoText.textContent = ammoDisplay;

    const ult = Math.ceil(player.ultimate);
    this.el.ultText.textContent = `${ult}/${CONFIG.ULT_THRESHOLD}`;
    this.el.ultBar.style.width = `${(player.ultimate / CONFIG.ULT_THRESHOLD) * 100}%`;

    for (const key of ['Q', 'E', 'R', 'F']) {
      const ab = player.abilities[key];
      const el = this.el['ability' + key];
      el.classList.toggle('cooldown', !ab.ready);
      el.classList.toggle('ready', ab.ready);

      let label = ab.name;
      if (!ab.ready && ab.cooldown > 0) {
        label += ` (${Math.ceil(ab.cooldown)}s)`;
      } else if (key === 'F') {
        label += ` (${Math.floor((player.ultimate / CONFIG.ULT_THRESHOLD) * 100)}%)`;
      } else {
        label += ' (Ready)';
      }
      el.innerHTML = `<span class="key">${key}</span> ${label}`;
    }

    // FPS
    const now = performance.now();
    this._fpsSamples.push(deltaTime);
    if (this._fpsSamples.length > 30) this._fpsSamples.shift();
    if (now - this._lastFpsUpdate > 250) {
      const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
      this._fps = Math.round(1 / avg);
      this._lastFpsUpdate = now;
    }

    this.el.debug.textContent =
      `FPS: ${this._fps}\n` +
      `Pos: ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}\n` +
      `Bots: ${game.bots.filter(b => b.alive).length}/${game.bots.length}\n` +
      `Projectiles: ${game.projectiles.length}\n` +
      `Kills: ${player.kills}  Deaths: ${player.deaths}`;
  }

  showKill(killerName, victimName) {
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `<span class="killer">${killerName}</span> eliminated <span class="victim">${victimName}</span>`;
    this.el.killFeed.appendChild(entry);
    setTimeout(() => entry.remove(), 5000);
  }

  showCenterMessage(msg) {
    if (!this.el.centerMessage) {
      this.el.centerMessage = document.createElement('div');
      this.el.centerMessage.id = 'centerMessage';
      document.getElementById('hud').appendChild(this.el.centerMessage);
    }
    this.el.centerMessage.textContent = msg;
    this.el.centerMessage.classList.add('show');
    setTimeout(() => this.el.centerMessage.classList.remove('show'), 2000);
  }

  flashDamage() {
    if (!this.el.damageVignette) {
      this.el.damageVignette = document.createElement('div');
      this.el.damageVignette.id = 'damageVignette';
      document.getElementById('hud').appendChild(this.el.damageVignette);
    }
    this.el.damageVignette.classList.add('hit');
    setTimeout(() => this.el.damageVignette.classList.remove('hit'), 300);
  }
}
