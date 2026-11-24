import * as THREE from 'three';
import { B, DATA } from './blocks.js';
import { hash3, fbm2, noise3 } from './noise.js';

export const SIZE = 16, HEIGHT = 48;
const SAVE_KEY = 'horror_sandbox_edits_v1';
// n=normal, o=origin, u,v with u x v = n (counter-clockwise from outside), s=shade
const FACES = [
  { n: [0, 1, 0], o: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], s: 1.0 },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], s: 0.5 },
  { n: [1, 0, 0], o: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], s: 0.8 },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: 0.8 },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], s: 0.65 },
  { n: [0, 0, -1], o: [0, 0, 0], u: [0, 1, 0], v: [1, 0, 0], s: 0.65 },
];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.edits = {};          // chunkKey -> {index: id}
    this.editsDirty = false;
    this.dirty = [];
    this.radius = 4;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.loadEdits();
    setInterval(() => this.saveEdits(), 5000);
    addEventListener('beforeunload', () => this.saveEdits());
  }
  key(cx, cz) { return cx + ',' + cz; }
  idx(x, y, z) { return (y * SIZE + z) * SIZE + x; }

  getBlock(x, y, z) {
    if (y < 0) return B.STONE;
    if (y >= HEIGHT) return 0;
    const c = this.chunks.get(this.key(x >> 4, z >> 4));
    return c ? c.blocks[this.idx(x & 15, y, z & 15)] : 0;
  }
  // for collision: unloaded terrain counts as solid so the player can't fall through
  solidAt(x, y, z) {
    if (y < 0) return true;
    if (y >= HEIGHT) return false;
    const c = this.chunks.get(this.key(x >> 4, z >> 4));
    return c ? c.blocks[this.idx(x & 15, y, z & 15)] !== 0 : true;
  }
  surfaceHeight(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) if (this.getBlock(x, y, z)) return y;
    return 0;
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return;
    const cx = x >> 4, cz = z >> 4, k = this.key(cx, cz), c = this.chunks.get(k);
    if (!c) return;
    const lx = x & 15, lz = z & 15, i = this.idx(lx, y, lz);
    c.blocks[i] = id;
    (this.edits[k] ||= {})[i] = id;
    this.editsDirty = true;
    this.buildMesh(c);
    if (lx === 0) this.rebuildAt(cx - 1, cz);
    if (lx === 15) this.rebuildAt(cx + 1, cz);
    if (lz === 0) this.rebuildAt(cx, cz - 1);
    if (lz === 15) this.rebuildAt(cx, cz + 1);
  }
  rebuildAt(cx, cz) { const c = this.chunks.get(this.key(cx, cz)); if (c) this.buildMesh(c); }

  generate(c) {
    const b = c.blocks;
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      const wx = c.cx * SIZE + x, wz = c.cz * SIZE + z;
      const h = Math.max(4, Math.min(HEIGHT - 12, Math.floor(10 + fbm2(wx * 0.015, wz * 0.015, 1337) * 24)));
      const beach = h <= 17;
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y === h) id = beach ? B.SAND : B.GRASS;
        else if (y >= h - 3) id = beach ? B.SAND : B.DIRT;
        else {
          const r = Math.floor(hash3(wx, y, wz, 5) * 200);
          if (r < 4) id = B.COAL;
          else if (r === 4 && y < h - 8) id = B.IRON;
          else if (r === 5 && y < h - 10) id = B.COPPER;
          if (y > 2 && y < h - 4 && noise3(wx * 0.08, y * 0.08, wz * 0.08, 4242) > 0.7) id = B.AIR;
        }
        b[this.idx(x, y, z)] = id;
      }
      if (!beach && x >= 2 && x <= 13 && z >= 2 && z <= 13 && Math.floor(hash3(wx, 0, wz, 9) * 70) === 0) this.tree(b, x, h, z);
    }
    const e = this.edits[this.key(c.cx, c.cz)];
    if (e) for (const i in e) b[i] = e[i];
  }
  tree(b, x, h, z) {
    for (let t = 1; t <= 5; t++) b[this.idx(x, h + t, z)] = B.WOOD;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 4; dy <= 6; dy++) {
      if (dy === 6 && (Math.abs(dx) === 2 || Math.abs(dz) === 2)) continue;
      const i = this.idx(x + dx, h + dy, z + dz);
      if (b[i] === 0) b[i] = B.LEAVES;
    }
  }

  buildMesh(c) {
    const pos = [], nor = [], col = [], ind = [];
    const b = c.blocks;
    const nb = (x, y, z) => {
      if (y < 0) return 3;
      if (y >= HEIGHT) return 0;
      if (x >= 0 && x < SIZE && z >= 0 && z < SIZE) return b[(y * SIZE + z) * SIZE + x];
      return this.getBlock(c.cx * SIZE + x, y, c.cz * SIZE + z);
    };
    for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const id = b[(y * SIZE + z) * SIZE + x];
      if (!id) continue;
      const base = DATA[id].color;
      const jit = 0.9 + hash3(c.cx * SIZE + x, y, c.cz * SIZE + z, 7) * 0.16;
      for (const f of FACES) {
        if (nb(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
        const k = f.s * jit, i0 = pos.length / 3;
        const o = [x + f.o[0], y + f.o[1], z + f.o[2]];
        const vs = [o, [o[0] + f.u[0], o[1] + f.u[1], o[2] + f.u[2]],
          [o[0] + f.u[0] + f.v[0], o[1] + f.u[1] + f.v[1], o[2] + f.u[2] + f.v[2]],
          [o[0] + f.v[0], o[1] + f.v[1], o[2] + f.v[2]]];
        for (const v of vs) { pos.push(v[0], v[1], v[2]); nor.push(f.n[0], f.n[1], f.n[2]); col.push(base[0] * k, base[1] * k, base[2] * k); }
        ind.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
    }
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (!ind.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(ind);
    g.computeBoundingSphere();
    c.mesh = new THREE.Mesh(g, this.mat);
    c.mesh.position.set(c.cx * SIZE, 0, c.cz * SIZE);
    this.scene.add(c.mesh);
  }

  spawnChunk(cx, cz) {
    const c = { cx, cz, blocks: new Uint8Array(SIZE * HEIGHT * SIZE), mesh: null };
    this.chunks.set(this.key(cx, cz), c);
    this.generate(c);
    this.buildMesh(c);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = this.key(cx + dx, cz + dz);
      if (this.chunks.has(k) && !this.dirty.includes(k)) this.dirty.push(k);
    }
  }
  loadAround(px, pz, r) {
    const pcx = Math.floor(px / SIZE), pcz = Math.floor(pz / SIZE);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
      if (!this.chunks.has(this.key(pcx + dx, pcz + dz))) this.spawnChunk(pcx + dx, pcz + dz);
  }
  // call every frame: at most one chunk build per frame
  update(px, pz) {
    const pcx = Math.floor(px / SIZE), pcz = Math.floor(pz / SIZE), R = this.radius;
    if (this.dirty.length) {
      const c = this.chunks.get(this.dirty.shift());
      if (c) this.buildMesh(c);
      return;
    }
    let best = null, bd = 1e9;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const d = dx * dx + dz * dz;
      if (d <= R * R && d < bd && !this.chunks.has(this.key(pcx + dx, pcz + dz))) { bd = d; best = [pcx + dx, pcz + dz]; }
    }
    if (best) this.spawnChunk(best[0], best[1]);
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - pcx) > R + 2 || Math.abs(c.cz - pcz) > R + 2) {
        if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
  }

  // voxel DDA raycast -> {pos:[x,y,z], prev:[x,y,z]} or null
  raycast(o, d, maxDist) {
    let p = [Math.floor(o.x), Math.floor(o.y), Math.floor(o.z)], prev = p.slice();
    const dir = [d.x, d.y, d.z], org = [o.x, o.y, o.z];
    const step = dir.map(v => (v > 0 ? 1 : -1));
    const tDelta = dir.map(v => (v !== 0 ? Math.abs(1 / v) : Infinity));
    const tMax = dir.map((v, a) => (v === 0 ? Infinity : ((v > 0 ? p[a] + 1 - org[a] : org[a] - p[a]) * tDelta[a])));
    for (let i = 0; i < 100; i++) {
      if (this.getBlock(p[0], p[1], p[2])) return { pos: p, prev };
      prev = p.slice();
      let ax = 0;
      if (tMax[1] < tMax[ax]) ax = 1;
      if (tMax[2] < tMax[ax]) ax = 2;
      if (tMax[ax] > maxDist) break;
      p[ax] += step[ax];
      tMax[ax] += tDelta[ax];
    }
    return null;
  }

  saveEdits() {
    if (!this.editsDirty) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.edits)); this.editsDirty = false; } catch (e) { console.warn('save failed', e); }
  }
  loadEdits() {
    try { const s = localStorage.getItem(SAVE_KEY); if (s) this.edits = JSON.parse(s); } catch (e) { this.edits = {}; }
  }
}
