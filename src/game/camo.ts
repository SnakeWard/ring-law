import {
  CAMO_LAW,
  camoScheme,
  type CamoEnv,
  type CamoRgb,
  type CamoScheme,
  type CamoStyle,
  type NationId,
} from "../schema/index.ts";
type SkinSource = HTMLImageElement | HTMLCanvasElement;

const patternCache = new Map<string, ImageData>();
const skinCache = new Map<string, HTMLCanvasElement>();

function lattice(seed: number, ix: number, iy: number) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function noise(seed: number, x: number, y: number, period: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const wrap = (v: number) => ((v % period) + period) % period;
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const a = lattice(seed, wrap(x0), wrap(y0));
  const b = lattice(seed, wrap(x0 + 1), wrap(y0));
  const c = lattice(seed, wrap(x0), wrap(y0 + 1));
  const d = lattice(seed, wrap(x0 + 1), wrap(y0 + 1));
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(seed: number, x: number, y: number, period: number, oct = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise(seed + i * 19, x * f, y * f, period * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function hash2(seed: number, ix: number, iy: number) {
  return lattice(seed, ix, iy);
}

function mixRgb(a: CamoRgb, b: CamoRgb, t: number): CamoRgb {
  const u = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
}

function pick(colors: readonly CamoRgb[], n: number): CamoRgb {
  const i = ((n % colors.length) + colors.length) % colors.length;
  return colors[i]!;
}

function paintAmbush(data: Uint8ClampedArray, size: number, scheme: CamoScheme, seed: number) {
  const colors = scheme.colors;
  const period = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * period;
      const ny = (y / size) * period;
      let col = colors[0]!;
      const b1 = fbm(seed, nx * 0.85, ny * 0.85, period, 3);
      const b2 = fbm(seed + 31, nx * 1.05 + 1.7, ny * 1.05, period, 3);
      if (b1 > 0.5) col = colors[1] ?? col;
      if (b2 > 0.62) col = colors[2] ?? col;
      const cell = 36;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const jx = (hash2(seed + 3, cx, cy) - 0.5) * 10;
      const jy = (hash2(seed + 5, cy, cx) - 0.5) * 10;
      const dx = x - (cx + 0.5) * cell - jx;
      const dy = y - (cy + 0.5) * cell - jy;
      const disk = hash2(seed + 9, cx, cy);
      if (disk > 0.78 && b1 > 0.46 && dx * dx + dy * dy < 16) {
        col = colors[colors.length - 1]!;
      }
      const i = (y * size + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
  }
}

function paintBlock(data: Uint8ClampedArray, size: number, scheme: CamoScheme, seed: number) {
  const colors = scheme.colors;
  const cells = 4;
  const period = cells;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * period;
      const ny = (y / size) * period;
      const warp = fbm(seed, nx, ny, period) * 0.55;
      const px = nx + warp;
      const py = ny + fbm(seed + 11, nx + 3, ny, period) * 0.55;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      let best = 99;
      let bestId = 0;
      let second = 99;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = ix + ox;
          const cy = iy + oy;
          const jx = hash2(seed, cx, cy) - 0.5;
          const jy = hash2(seed + 7, cy, cx) - 0.5;
          const dx = px - (cx + 0.5 + jx * 0.7);
          const dy = py - (cy + 0.5 + jy * 0.7);
          const d = Math.abs(dx) + Math.abs(dy);
          const id = Math.floor(hash2(seed + 13, cx, cy) * colors.length);
          if (d < best) {
            second = best;
            best = d;
            bestId = id;
          } else if (d < second) second = d;
        }
      }
      const edge = Math.max(0, 1 - (second - best) * 3.2);
      const col = mixRgb(pick(colors, bestId), pick(colors, bestId + 1), edge * 0.35);
      const i = (y * size + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
  }
}

function paintAmoeba(data: Uint8ClampedArray, size: number, scheme: CamoScheme, seed: number) {
  const colors = scheme.colors;
  const period = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * period;
      const ny = (y / size) * period * 0.72;
      const wx = nx + fbm(seed, nx, ny, period) * 1.6;
      const wy = ny + fbm(seed + 23, nx + 2, ny, period) * 1.4;
      const v = fbm(seed + 41, wx * 1.05, wy * 1.05, period);
      let col = colors[0]!;
      if (v > 0.46) col = colors[1] ?? col;
      if (v > 0.64) col = colors[2] ?? col;
      if (colors[3] && v > 0.78) col = colors[3];
      const i = (y * size + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = 255;
    }
  }
}

const PAINT: Record<CamoStyle, typeof paintAmbush> = {
  ambush: paintAmbush,
  block: paintBlock,
  amoeba: paintAmoeba,
};

function patternFor(scheme: CamoScheme): ImageData | null {
  if (typeof document === "undefined") return null;
  const key = `${scheme.nation}:${scheme.env}`;
  const hit = patternCache.get(key);
  if (hit) return hit;
  const size = CAMO_LAW.tilePx;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const seed = scheme.nation === "germany" ? 11 : scheme.nation === "usa" ? 29 : 47;
  PAINT[scheme.style](img.data, size, scheme, seed + scheme.env.length * 13);
  patternCache.set(key, img);
  return img;
}

function sample(pat: ImageData, x: number, y: number): CamoRgb {
  const w = pat.width;
  const h = pat.height;
  const px = ((x % w) + w) % w | 0;
  const py = ((y % h) + h) % h | 0;
  const i = (py * w + px) * 4;
  return [pat.data[i]!, pat.data[i + 1]!, pat.data[i + 2]!];
}

function sourceSize(img: SkinSource): { w: number; h: number } {
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  return { w: img.naturalWidth, h: img.naturalHeight };
}

function ready(img: SkinSource): boolean {
  if (img instanceof HTMLCanvasElement) return img.width > 0;
  return img.complete && img.naturalWidth > 0;
}

export function camoSkin(
  img: SkinSource | null,
  src: string,
  nation: NationId,
  env: CamoEnv,
): SkinSource | null {
  if (!img || !ready(img)) return img;
  if (typeof document === "undefined") return img;
  const key = `${src}|${nation}|${env}`;
  const cached = skinCache.get(key);
  if (cached) return cached;
  const scheme = camoScheme(nation, env);
  const pat = patternFor(scheme);
  if (!pat) return img;
  const { w, h } = sourceSize(img);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0);
  const pix = ctx.getImageData(0, 0, w, h);
  const d = pix.data;
  const strength = CAMO_LAW.strength;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a < 8) continue;
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const luma = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    if (luma < 0.14) continue;
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);
    const cam = sample(pat, x, y);
    const shade = 0.38 + luma * 1.15;
    const keep = luma < 0.22 ? 0.35 : strength;
    d[i] = r + (cam[0] * shade - r) * keep;
    d[i + 1] = g + (cam[1] * shade - g) * keep;
    d[i + 2] = b + (cam[2] * shade - b) * keep;
  }
  ctx.putImageData(pix, 0, 0);
  skinCache.set(key, canvas);
  return canvas;
}
