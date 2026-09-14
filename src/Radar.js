import { CONFIG } from './config.js';

export class Radar {
  constructor() {
    this.canvas = document.getElementById('radarCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.size = this.canvas.width;
  }

  update(player, bots, effects) {
    const ctx = this.ctx;
    const s = this.size;

    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(0, 153, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, (s / 2) * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#0099ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);

    if (!player) return;

    const scale = s / (CONFIG.MAP_SIZE * 1.2);
    const cx = s / 2;
    const cy = s / 2;

    for (const eff of effects) {
      if (eff.type !== 'smoke') continue;
      const x = cx + (eff.position.x - player.position.x) * scale;
      const y = cy + (eff.position.z - player.position.z) * scale;
      ctx.fillStyle = 'rgba(136, 136, 136, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.SMOKE_RADIUS * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const bot of bots) {
      if (!bot.alive) continue;
      const x = cx + (bot.position.x - player.position.x) * scale;
      const y = cy + (bot.position.z - player.position.z) * scale;
      if (x < 0 || x > s || y < 0 || y > s) continue;
      ctx.fillStyle = '#ff4655';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.sin(player.rotation.y) * 12,
      cy + Math.cos(player.rotation.y) * 12,
    );
    ctx.stroke();
  }
}
