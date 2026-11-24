import * as THREE from 'three';
import { DATA } from './blocks.js';

export class Player {
  constructor(world, camera, scene) {
    this.world = world; this.camera = camera;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.onGround = false; this.eye = 1.62;
    this.keys = new Set(); this.mouseL = false; this.locked = false;
    this.inv = { 2: 20, 3: 10, 4: 10, 5: 10, 10: 20, 1: 5, 6: 5, 7: 3, 8: 3 };
    this.hotbar = [1, 2, 3, 4, 5, 6, 10, 7, 8];
    this.sel = 0; this.target = null; this.mineKey = ''; this.mineProg = 0;
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    this.flash = new THREE.SpotLight(0xfff2cc, 0, 35, Math.PI / 6, 0.4, 1);
    camera.add(this.flash); camera.add(this.flash.target); this.flash.target.position.set(0, 0, -1);
    this.hl = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    this.hl.visible = false; scene.add(this.hl);
    this.hbEl = document.getElementById('hotbar');
    this.mineEl = document.getElementById('mine');
    this.slots = this.hotbar.map(() => { const d = document.createElement('div'); d.className = 'slot'; this.hbEl.appendChild(d); return d; });
    this.bind();
  }
  bind() {
    addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (!this.locked) return;
      if (e.code.startsWith('Digit') && e.code !== 'Digit0') this.sel = +e.code.slice(5) - 1;
      if (e.code === 'KeyF') this.flash.intensity = this.flash.intensity ? 0 : 12;
      if (e.code === 'ControlLeft') e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0022));
    });
    addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) this.mouseL = true;
      if (e.button === 2) this.place();
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouseL = false; });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('wheel', e => { if (this.locked) this.sel = (this.sel + (e.deltaY > 0 ? 1 : 8)) % 9; });
    addEventListener('blur', () => { this.keys.clear(); this.mouseL = false; });
  }
  collides(x, y, z) {
    const w = this.world, r = 0.3;
    for (let ix = Math.floor(x - r); ix <= Math.floor(x + r); ix++)
      for (let iy = Math.floor(y); iy <= Math.floor(y + 1.8); iy++)
        for (let iz = Math.floor(z - r); iz <= Math.floor(z + r); iz++)
          if (w.solidAt(ix, iy, iz)) return true;
    return false;
  }
  update(dt) {
    dt = Math.min(dt, 0.05);
    const k = this.keys, on = this.locked;
    const ix = on ? (k.has('KeyD') - k.has('KeyA')) : 0, iz = on ? (k.has('KeyS') - k.has('KeyW')) : 0;
    const crouch = on && (k.has('ControlLeft') || k.has('ControlRight'));
    const sprint = on && (k.has('ShiftLeft') || k.has('ShiftRight')) && !crouch;
    const speed = crouch ? 2.2 : sprint ? 7.5 : 4.5;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    let dx = ix * c + iz * s, dz = -ix * s + iz * c;
    const len = Math.hypot(dx, dz) || 1; dx = dx / len * (ix || iz ? speed : 0); dz = dz / len * (ix || iz ? speed : 0);
    const a = Math.min(1, 12 * dt);
    this.vel.x += (dx - this.vel.x) * a; this.vel.z += (dz - this.vel.z) * a;
    this.vel.y -= 24 * dt;
    if (on && k.has('Space') && this.onGround) this.vel.y = 8;
    const p = this.pos;
    p.x += this.vel.x * dt; if (this.collides(p.x, p.y, p.z)) { p.x -= this.vel.x * dt; this.vel.x = 0; }
    p.z += this.vel.z * dt; if (this.collides(p.x, p.y, p.z)) { p.z -= this.vel.z * dt; this.vel.z = 0; }
    p.y += this.vel.y * dt; this.onGround = false;
    if (this.collides(p.x, p.y, p.z)) { if (this.vel.y < 0) this.onGround = true; p.y -= this.vel.y * dt; this.vel.y = 0; }
    if (p.y < -20) { p.y = 60; this.vel.set(0, 0, 0); }
    this.eye += ((crouch ? 1.25 : 1.62) - this.eye) * Math.min(1, 12 * dt);
    this.camera.position.set(p.x, p.y + this.eye, p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.interact(dt);
    this.drawHud();
  }
  interact(dt) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.target = this.world.raycast(this.camera.position, dir, 5);
    const t = this.target;
    this.hl.visible = !!t;
    if (!t) { this.mineProg = 0; this.mineKey = ''; return; }
    this.hl.position.set(t.pos[0] + 0.5, t.pos[1] + 0.5, t.pos[2] + 0.5);
    const key = t.pos.join(',');
    if (this.locked && this.mouseL && t.pos[1] > 0) {
      if (key !== this.mineKey) { this.mineKey = key; this.mineProg = 0; }
      const id = this.world.getBlock(...t.pos);
      this.mineProg += dt / DATA[id].time;
      if (this.mineProg >= 1) {
        const d = DATA[id].drop; this.inv[d] = (this.inv[d] || 0) + 1;
        this.world.setBlock(...t.pos, 0); this.mineProg = 0;
      }
    } else { this.mineProg = 0; this.mineKey = ''; }
  }
  place() {
    const t = this.target; if (!t) return;
    const id = this.hotbar[this.sel];
    if (!(this.inv[id] > 0)) return;
    const [x, y, z] = t.prev;
    if (this.world.getBlock(x, y, z)) return;
    const p = this.pos, r = 0.3;
    if (x + 1 > p.x - r && x < p.x + r && z + 1 > p.z - r && z < p.z + r && y + 1 > p.y && y < p.y + 1.8) return;
    this.world.setBlock(x, y, z, id); this.inv[id]--;
  }
  drawHud() {
    this.hotbar.forEach((id, i) => {
      const d = DATA[id], el = this.slots[i], col = d.color.map(v => Math.round(v * 255)).join(',');
      const html = `<span class="sw" style="background:rgb(${col})"></span>${d.name} ${this.inv[id] || 0}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle('sel', i === this.sel);
    });
    this.mineEl.style.display = this.mineProg > 0 ? 'block' : 'none';
    this.mineEl.firstChild.style.width = (this.mineProg * 100) + '%';
  }
}
