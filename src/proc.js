// JS tarafı prosedürel gürültü — geometri yer değiştirmesi için (GLSL'in JS eşi).
// Harici varlık yok; her şey hash tabanlı.

function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  const a = c(0, 0, 0) * (1 - ux) + c(1, 0, 0) * ux;
  const b = c(0, 1, 0) * (1 - ux) + c(1, 1, 0) * ux;
  const d = c(0, 0, 1) * (1 - ux) + c(1, 0, 1) * ux;
  const e = c(0, 1, 1) * (1 - ux) + c(1, 1, 1) * ux;
  const ab = a * (1 - uy) + b * uy;
  const de = d * (1 - uy) + e * uy;
  return ab * (1 - uz) + de * uz;
}

export function fbm3(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x * f, y * f, z * f);
    f *= 2.03; a *= 0.5;
  }
  return s;
}

export function ridged3(x, y, z, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    const n = vnoise3(x * f + i * 1.7, y * f + i * 9.2, z * f + i * 3.1);
    const r = 1 - Math.abs(n * 2 - 1);
    s += a * r * r;
    f *= 2.03; a *= 0.5;
  }
  return s;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
