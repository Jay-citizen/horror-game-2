export function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2147483629);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sm = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
export function noise2(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = sm(x - xi), zf = sm(z - zi);
  return lerp(lerp(hash3(xi, 0, zi, s), hash3(xi + 1, 0, zi, s), xf),
              lerp(hash3(xi, 0, zi + 1, s), hash3(xi + 1, 0, zi + 1, s), xf), zf);
}
export function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const f = (dy) => lerp(lerp(hash3(xi, yi + dy, zi, s), hash3(xi + 1, yi + dy, zi, s), xf),
                         lerp(hash3(xi, yi + dy, zi + 1, s), hash3(xi + 1, yi + dy, zi + 1, s), xf), zf);
  return lerp(f(0), f(1), yf);
}
export function fbm2(x, z, s) {
  return (noise2(x, z, s) * 0.6 + noise2(x * 2, z * 2, s + 1) * 0.3 + noise2(x * 4, z * 4, s + 2) * 0.1);
}
