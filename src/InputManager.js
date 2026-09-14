export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { dx: 0, dy: 0, locked: false };
    this.shootRequested = false;
    this.abilityRequested = null;
    this.reloadRequested = false;

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;

      if (k === 'q') this.abilityRequested = 'Q';
      else if (k === 'e') this.abilityRequested = 'E';
      else if (k === 'r') this.reloadRequested = true;
      else if (k === 'f') this.abilityRequested = 'F';
    };

    this._onKeyUp = (e) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    this._onMouseMove = (e) => {
      if (!this.mouse.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    };

    this._onMouseDown = (e) => {
      if (e.button === 0) this.shootRequested = true;
    };

    this._onPointerLockChange = () => {
      this.mouse.locked = document.pointerLockElement === this.canvas;
    };

    this._onCanvasClick = () => {
      if (!this.mouse.locked) this.canvas.requestPointerLock();
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', this._onCanvasClick);
  }

  consumeMouseDelta() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return d;
  }

  consumeShoot() {
    const s = this.shootRequested;
    this.shootRequested = false;
    return s;
  }

  consumeAbility() {
    const a = this.abilityRequested;
    this.abilityRequested = null;
    return a;
  }

  consumeReload() {
    const r = this.reloadRequested;
    this.reloadRequested = false;
    return r;
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.removeEventListener('click', this._onCanvasClick);
  }
}
