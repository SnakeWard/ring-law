import { parseGeneratedSkin } from "../schema/biomes.ts";

/**
 * Procedural asset painter. Each `gen:<biome>/<asset>#<variant>` key
 * resolves to one cached canvas. Everything is seeded, so a placed prop
 * looks the same on every load and on every machine.
 *
 * Style rules (match the baked PNGs): true top-down, even overcast light,
 * soft self-shading only, no drop shadows (the renderer adds a sit shadow),
 * transparent outside the silhouette, subtle film grain on every surface.
 */

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
type Painter = (ctx: Ctx, w: number, h: number, rnd: Rnd, biome: string) => void;
type Spec = { w: number; h: number; paint: Painter; tile?: boolean };

const cache = new Map<string, HTMLCanvasElement | null>();
const urlCache = new Map<string, string>();

function mulberry(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lattice(seed: number, ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value noise in [0,1]. `period` makes it tile. */
function noise(seed: number, x: number, y: number, period = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const wrap = (v: number) => (period ? ((v % period) + period) % period : v);
  const a = lattice(seed, wrap(x0), wrap(y0));
  const b = lattice(seed, wrap(x0 + 1), wrap(y0));
  const c = lattice(seed, wrap(x0), wrap(y0 + 1));
  const d = lattice(seed, wrap(x0 + 1), wrap(y0 + 1));
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(seed: number, x: number, y: number, oct: number, period = 0): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise(seed + i * 17, x * f, y * f, period ? period * f : 0) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function rgb(r: number, g: number, b: number, a = 1) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

function mix(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Multiplies existing pixels by a seeded grain so flat fills read as surface. */
function grain(ctx: Ctx, w: number, h: number, seed: number, amount: number, scale = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const n = lattice(seed, Math.floor(x / scale), Math.floor(y / scale)) - 0.5;
      const k = 1 + n * amount;
      d[i] = Math.max(0, Math.min(255, d[i] * k));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * k));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * k));
    }
  }
  ctx.putImageData(img, 0, 0);
}

function blobPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rnd: Rnd,
  jitter = 0.18,
  n = 18,
) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + (rnd() - 0.5) * 2 * jitter;
    const x = cx + Math.cos(a) * rx * j;
    const y = cy + Math.sin(a) * ry * j;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function perPixel(ctx: Ctx, w: number, h: number, fn: (x: number, y: number) => number[] | null) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x, y);
      const i = (y * w + x) * 4;
      if (!p) continue;
      d[i] = p[0];
      d[i + 1] = p[1];
      d[i + 2] = p[2];
      d[i + 3] = p[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ── floors ───────────────────────────────────────────────────────────────────

const desertFloor: Painter = (ctx, w, h, _rnd, _b) => {
  const seed = 101;
  const P = 8;
  perPixel(ctx, w, h, (x, y) => {
    const u = (x / w) * P;
    const v = (y / h) * P;
    const base = fbm(seed, u, v, 4, P);
    const ripple =
      Math.sin((x * 0.55 + y * 0.28) * 0.22 + fbm(seed + 5, u * 0.5, v * 0.5, 2, P / 2) * 9) * 0.5 +
      0.5;
    const fine = lattice(seed + 9, x, y);
    const light = mix([214, 186, 138], [232, 208, 160], base) as number[];
    const c = mix(light, [196, 166, 118], ripple * 0.35 + fine * 0.15);
    return [c[0], c[1], c[2], 255];
  });
  const rnd = mulberry(77);
  for (let i = 0; i < 140; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle = rgb(150 + rnd() * 40, 125 + rnd() * 35, 90 + rnd() * 30, 0.7);
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
};

const forestFloor: Painter = (ctx, w, h) => {
  const seed = 202;
  const P = 8;
  perPixel(ctx, w, h, (x, y) => {
    const u = (x / w) * P;
    const v = (y / h) * P;
    const patch = fbm(seed, u, v, 4, P);
    const fine = fbm(seed + 3, u * 4, v * 4, 2, P * 4);
    const soil = [86, 70, 46];
    const moss = [74, 96, 48];
    const grass = [104, 122, 58];
    let c = mix(soil, moss, Math.min(1, patch * 1.4));
    c = mix(c, grass, Math.max(0, fine - 0.45) * 1.2);
    const k = 0.9 + lattice(seed + 7, x, y) * 0.2;
    return [c[0] * k, c[1] * k, c[2] * k, 255];
  });
  const rnd = mulberry(303);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const leaf = rnd() < 0.5;
    ctx.fillStyle = leaf
      ? rgb(150 + rnd() * 60, 90 + rnd() * 50, 30 + rnd() * 30, 0.75)
      : rgb(60 + rnd() * 30, 80 + rnd() * 40, 30 + rnd() * 20, 0.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.2 + rnd() * 2, 0.6 + rnd() * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(120,140,60,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 120; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 6, y - 3 - rnd() * 5);
    ctx.stroke();
  }
};

// ── props ────────────────────────────────────────────────────────────────────

const log: Painter = (ctx, w, h, rnd, biome) => {
  const cx = w / 2;
  const top = h * 0.06;
  const bot = h * 0.94;
  const r = w * 0.3;
  const bark = biome === "jungle" ? [72, 54, 36] : [96, 74, 50];
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, rgb(bark[0] * 0.55, bark[1] * 0.55, bark[2] * 0.55));
  g.addColorStop(0.35, rgb(bark[0] * 1.15, bark[1] * 1.15, bark[2] * 1.15));
  g.addColorStop(0.7, rgb(bark[0], bark[1], bark[2]));
  g.addColorStop(1, rgb(bark[0] * 0.5, bark[1] * 0.5, bark[2] * 0.5));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(cx - r, top, r * 2, bot - top, r * 0.5);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,20,10,0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x = cx - r + rnd() * r * 2;
    const y0 = top + rnd() * (bot - top);
    const len = 12 + rnd() * 40;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (rnd() - 0.5) * 3, Math.min(bot, y0 + len));
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = cx + (rnd() - 0.5) * r * 1.2;
    const y = top + 20 + rnd() * (bot - top - 40);
    ctx.fillStyle = "rgba(40,28,16,0.7)";
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + rnd() * 3, 4 + rnd() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ey of [top, bot]) {
    ctx.fillStyle = rgb(190, 160, 110);
    ctx.beginPath();
    ctx.ellipse(cx, ey, r * 0.92, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,60,30,0.6)";
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, ey, r * 0.2 * k, r * 0.09 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (biome === "snow") {
    ctx.fillStyle = "rgba(240,244,250,0.92)";
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.95, top + 6, r * 1.15, bot - top - 12, r * 0.4);
    ctx.fill();
  }
  if (biome === "jungle") {
    ctx.fillStyle = "rgba(96,140,60,0.55)";
    for (let i = 0; i < 9; i++) {
      blobPath(
        ctx,
        cx + (rnd() - 0.5) * r * 1.4,
        top + 12 + rnd() * (bot - top - 24),
        6 + rnd() * 8,
        5 + rnd() * 6,
        rnd,
        0.3,
        10,
      );
      ctx.fill();
    }
  }
  grain(ctx, w, h, 11, 0.22);
};

const drift: Painter = (ctx, w, h, rnd) => {
  const g = ctx.createRadialGradient(w * 0.42, h * 0.38, 4, w / 2, h / 2, w * 0.55);
  g.addColorStop(0, "rgb(250,252,255)");
  g.addColorStop(0.6, "rgb(226,232,242)");
  g.addColorStop(1, "rgb(186,198,216)");
  ctx.fillStyle = g;
  blobPath(ctx, w / 2, h / 2, w * 0.47, h * 0.42, rnd, 0.08, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(160,176,200,0.5)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const y = h * 0.25 + i * (h * 0.08);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, y);
    ctx.quadraticCurveTo(w / 2, y + (rnd() - 0.5) * 8, w * 0.9, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  grain(ctx, w, h, 12, 0.08);
};

const cabin: Painter = (ctx, w, h, rnd, biome) => {
  const snow = biome === "snow";
  const inset = w * 0.06;
  const ridgeX = w / 2;
  const roofL = snow ? [210, 218, 230] : [118, 82, 52];
  const roofR = snow ? [176, 186, 202] : [88, 60, 38];
  ctx.fillStyle = rgb(roofL[0], roofL[1], roofL[2]);
  ctx.fillRect(inset, inset, ridgeX - inset, h - inset * 2);
  ctx.fillStyle = rgb(roofR[0], roofR[1], roofR[2]);
  ctx.fillRect(ridgeX, inset, w - inset - ridgeX, h - inset * 2);
  if (!snow) {
    ctx.strokeStyle = "rgba(40,24,12,0.45)";
    ctx.lineWidth = 1.5;
    for (let y = inset + 10; y < h - inset; y += 11) {
      ctx.beginPath();
      ctx.moveTo(inset, y);
      ctx.lineTo(w - inset, y + (rnd() - 0.5) * 2);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(150,160,180,0.35)";
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(inset + rnd() * (w - inset * 2), inset + rnd() * (h - inset * 2));
      ctx.lineTo(inset + rnd() * (w - inset * 2), inset + rnd() * (h - inset * 2));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = snow ? "rgb(120,90,60)" : "rgb(50,32,18)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ridgeX, inset);
  ctx.lineTo(ridgeX, h - inset);
  ctx.stroke();
  ctx.strokeStyle = "rgb(70,48,30)";
  ctx.lineWidth = 6;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.fillStyle = "rgb(110,70,60)";
  ctx.fillRect(ridgeX + 10, h * 0.28, 16, 16);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(ridgeX + 26, h * 0.3, 8, 16);
  grain(ctx, w, h, 13, 0.14);
};

const dune: Painter = (ctx, w, h, rnd) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgb(236,214,168)");
  g.addColorStop(0.42, "rgb(222,196,148)");
  g.addColorStop(0.5, "rgb(178,148,104)");
  g.addColorStop(1, "rgb(154,126,88)");
  ctx.fillStyle = g;
  blobPath(ctx, w / 2, h / 2, w * 0.48, h * 0.44, rnd, 0.06, 30);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,96,64,0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const y = h * 0.1 + i * h * 0.036;
    ctx.beginPath();
    ctx.moveTo(w * 0.05, y);
    for (let x = w * 0.05; x <= w * 0.95; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,240,210,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.47);
  ctx.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.94, h * 0.48);
  ctx.stroke();
  grain(ctx, w, h, 14, 0.1);
};

const rock: Painter = (ctx, w, h, rnd, biome) => {
  const warm = biome === "desert";
  const base = warm ? [176, 146, 104] : [132, 134, 130];
  const dark = warm ? [110, 86, 58] : [78, 80, 78];
  const g = ctx.createRadialGradient(w * 0.4, h * 0.36, 6, w / 2, h / 2, w * 0.58);
  g.addColorStop(0, rgb(base[0] * 1.15, base[1] * 1.15, base[2] * 1.15));
  g.addColorStop(0.55, rgb(base[0], base[1], base[2]));
  g.addColorStop(1, rgb(dark[0], dark[1], dark[2]));
  ctx.fillStyle = g;
  blobPath(ctx, w / 2, h / 2, w * 0.46, h * 0.45, rnd, 0.16, 14);
  ctx.fill();
  ctx.save();
  blobPath(ctx, w / 2, h / 2, w * 0.46, h * 0.45, mulberry(1), 0.16, 14);
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const x = w * 0.15 + rnd() * w * 0.7;
    const y = h * 0.15 + rnd() * h * 0.7;
    ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)";
    blobPath(ctx, x, y, 14 + rnd() * 30, 10 + rnd() * 22, rnd, 0.3, 7);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(20,20,20,0.5)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 8; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rnd() - 0.5) * 40;
      y += (rnd() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (biome === "jungle") {
    ctx.fillStyle = "rgba(90,130,60,0.6)";
    for (let i = 0; i < 10; i++) {
      blobPath(ctx, rnd() * w, rnd() * h, 8 + rnd() * 16, 6 + rnd() * 12, rnd, 0.35, 9);
      ctx.fill();
    }
  }
  ctx.restore();
  grain(ctx, w, h, 15, 0.2);
};

const scrub: Painter = (ctx, w, h, rnd) => {
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = "rgb(96,76,52)";
  ctx.lineWidth = 2;
  const branches: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2;
    const len = w * 0.22 + rnd() * w * 0.24;
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.4) * len * 0.5,
      cy + Math.sin(a + 0.4) * len * 0.5,
      ex,
      ey,
    );
    ctx.stroke();
    branches.push([ex, ey, a]);
  }
  for (const [ex, ey] of branches) {
    for (let k = 0; k < 14; k++) {
      const t = rnd();
      const x = cx + (ex - cx) * t + (rnd() - 0.5) * 14;
      const y = cy + (ey - cy) * t + (rnd() - 0.5) * 14;
      ctx.fillStyle = rgb(96 + rnd() * 40, 110 + rnd() * 30, 50 + rnd() * 20, 0.9);
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + rnd() * 3, 1.2 + rnd() * 2, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(60,44,28,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
};

const palms: Painter = (ctx, w, h, rnd, biome) => {
  const dull = biome === "desert";
  const n = 2 + Math.floor(rnd() * 2);
  for (let p = 0; p < n; p++) {
    const cx = w * 0.3 + rnd() * w * 0.4;
    const cy = h * 0.3 + rnd() * h * 0.4;
    const fr = 7 + Math.floor(rnd() * 3);
    const base = rnd() * Math.PI;
    for (let i = 0; i < fr; i++) {
      const a = base + (i / fr) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      const len = w * 0.26 + rnd() * w * 0.16;
      const gl = dull ? 0.8 : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = rgb(70 * gl + rnd() * 20, 120 * gl + rnd() * 30, 50 * gl, 0.92);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -len * 0.26, len, 0);
      ctx.quadraticCurveTo(len * 0.5, len * 0.26, 0, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(30,60,20,0.5)";
      ctx.lineWidth = 1;
      for (let k = 6; k < len; k += 7) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + 4, -len * 0.24 * (1 - k / len));
        ctx.moveTo(k, 0);
        ctx.lineTo(k + 4, len * 0.24 * (1 - k / len));
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = "rgb(88,64,40)";
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, w, h, 16, 0.15);
};

const adobe: Painter = (ctx, w, h, rnd) => {
  const inset = w * 0.05;
  ctx.fillStyle = "rgb(196,164,120)";
  ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.fillStyle = "rgb(178,146,104)";
  ctx.fillRect(inset + 12, inset + 12, w - inset * 2 - 24, h - inset * 2 - 24);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(inset + 12, inset + 12, w - inset * 2 - 24, 8);
  ctx.fillRect(inset + 12, inset + 12, 8, h - inset * 2 - 24);
  ctx.fillStyle = "rgb(120,90,60)";
  for (let i = 0; i < 7; i++) {
    const y = inset + 22 + i * ((h - inset * 2 - 44) / 6);
    ctx.fillRect(inset - 4, y - 2, 12, 5);
    ctx.fillRect(w - inset - 8, y - 2, 12, 5);
  }
  ctx.fillStyle = "rgb(150,120,84)";
  ctx.fillRect(w * 0.58, h * 0.2, w * 0.24, h * 0.22);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(w * 0.58, h * 0.2, w * 0.24, 6);
  ctx.strokeStyle = "rgba(90,66,40,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = "rgba(90,66,40,0.25)";
    blobPath(ctx, rnd() * w, rnd() * h, 6 + rnd() * 10, 4 + rnd() * 8, rnd, 0.3, 8);
    ctx.fill();
  }
  grain(ctx, w, h, 17, 0.14);
};

const berm: Painter = (ctx, w, h, rnd) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgb(206,178,130)");
  g.addColorStop(0.45, "rgb(228,204,158)");
  g.addColorStop(0.55, "rgb(190,160,116)");
  g.addColorStop(1, "rgb(160,132,94)");
  ctx.fillStyle = g;
  blobPath(ctx, w / 2, h / 2, w * 0.48, h * 0.42, rnd, 0.1, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(110,88,60,0.35)";
  ctx.lineWidth = 2;
  for (let x = w * 0.08; x < w * 0.92; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.62);
    ctx.lineTo(x + 3, h * 0.9);
    ctx.stroke();
  }
  grain(ctx, w, h, 18, 0.12);
};

const hut: Painter = (ctx, w, h, rnd) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.46;
  const ry = h * 0.46;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
  g.addColorStop(0, "rgb(176,140,84)");
  g.addColorStop(1, "rgb(120,92,52)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(cx - rx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(70,50,24,0.45)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = 6 + rnd() * rx * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(
      cx + Math.cos(a) * (r0 + 14 + rnd() * 20),
      cy + Math.sin(a) * (r0 + 14 + rnd() * 20),
    );
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgb(80,56,30)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx, cy + ry);
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx + rx, cy);
  ctx.stroke();
  grain(ctx, w, h, 19, 0.16);
};

const canopy: Painter = (ctx, w, h, rnd) => {
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "rgb(40,62,30)";
  blobPath(ctx, cx, cy, w * 0.47, h * 0.47, rnd, 0.12, 24);
  ctx.fill();
  const clusters = 26;
  for (let i = 0; i < clusters; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * w * 0.34;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const r = 18 + rnd() * 30;
    const lit = 1 - Math.min(1, Math.hypot(x - cx * 0.86, y - cy * 0.86) / (w * 0.6));
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, rgb(90 + lit * 60, 130 + lit * 50, 50 + lit * 20));
    g.addColorStop(1, rgb(38 + lit * 20, 66 + lit * 20, 30));
    ctx.fillStyle = g;
    blobPath(ctx, x, y, r, r * 0.9, rnd, 0.28, 12);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(200,220,120,0.35)";
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * w * 0.4;
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * d,
      cy + Math.sin(a) * d,
      2 + rnd() * 3,
      1 + rnd() * 2,
      rnd() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  grain(ctx, w, h, 20, 0.18);
};

const hedge: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = "rgb(44,70,34)";
  blobPath(ctx, w / 2, h / 2, w * 0.48, h * 0.44, rnd, 0.06, 30);
  ctx.fill();
  for (let i = 0; i < 60; i++) {
    const x = w * 0.06 + rnd() * w * 0.88;
    const y = h * 0.2 + rnd() * h * 0.6;
    const r = 6 + rnd() * 10;
    ctx.fillStyle = rgb(60 + rnd() * 50, 100 + rnd() * 50, 40 + rnd() * 20);
    blobPath(ctx, x, y, r, r * 0.8, rnd, 0.3, 9);
    ctx.fill();
  }
  grain(ctx, w, h, 21, 0.16);
};

const stoneWall: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = "rgb(70,68,62)";
  ctx.fillRect(0, h * 0.08, w, h * 0.84);
  let x = 2;
  let row = 0;
  while (x < w) {
    const sw = 10 + rnd() * 16;
    const shade = 120 + rnd() * 50;
    ctx.fillStyle = rgb(shade, shade - 4, shade - 12);
    const y0 = h * 0.1 + (row % 2) * 2;
    ctx.fillRect(x, y0, sw - 2, h * 0.38);
    const sh2 = 120 + rnd() * 50;
    ctx.fillStyle = rgb(sh2, sh2 - 4, sh2 - 12);
    ctx.fillRect(x + 6, h * 0.5, sw - 2, h * 0.38);
    x += sw;
    row++;
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, h * 0.08, w, 3);
  grain(ctx, w, h, 22, 0.2);
};

const barn: Painter = (ctx, w, h, rnd) => {
  const inset = w * 0.05;
  const ridge = w / 2;
  ctx.fillStyle = "rgb(128,52,40)";
  ctx.fillRect(inset, inset, ridge - inset, h - inset * 2);
  ctx.fillStyle = "rgb(96,38,30)";
  ctx.fillRect(ridge, inset, w - inset - ridge, h - inset * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  for (let x = inset + 8; x < w - inset; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, inset);
    ctx.lineTo(x, h - inset);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = "rgba(160,110,60,0.35)";
    blobPath(
      ctx,
      inset + rnd() * (w - inset * 2),
      inset + rnd() * (h - inset * 2),
      8 + rnd() * 14,
      20 + rnd() * 40,
      rnd,
      0.3,
      8,
    );
    ctx.fill();
  }
  ctx.fillStyle = "rgb(60,30,24)";
  ctx.fillRect(ridge - 3, inset, 6, h - inset * 2);
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(ridge - 8, h * 0.2, 16, 12);
  ctx.strokeStyle = "rgb(60,30,24)";
  ctx.lineWidth = 5;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  grain(ctx, w, h, 23, 0.16);
};

const sandbags: Painter = (ctx, w, h, rnd) => {
  const rows = 3;
  const bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 14;
    for (let x = -14 + off; x < w + 14; x += 28) {
      const t = 150 + rnd() * 40;
      ctx.fillStyle = rgb(t, t - 20, t - 60);
      ctx.beginPath();
      ctx.ellipse(x + 14, r * bh + bh / 2, 15, bh * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(70,50,30,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, r * bh + bh / 2);
      ctx.lineTo(x + 24, r * bh + bh / 2);
      ctx.stroke();
    }
  }
  grain(ctx, w, h, 24, 0.14);
};

const hedgehog: Painter = (ctx, w, h, rnd) => {
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI) / 3 + 0.2);
    ctx.fillStyle = "rgb(58,56,54)";
    ctx.fillRect(-w * 0.42, -6, w * 0.84, 12);
    ctx.fillStyle = "rgb(120,70,40)";
    for (let k = 0; k < 5; k++) ctx.fillRect(-w * 0.4 + rnd() * w * 0.8, -6 + rnd() * 8, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(-w * 0.42, -6, w * 0.84, 3);
    ctx.restore();
  }
  ctx.fillStyle = "rgb(40,40,40)";
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
};

const crater: Painter = (ctx, w, h, rnd) => {
  const cx = w / 2;
  const cy = h / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.48);
  g.addColorStop(0, "rgba(30,26,22,0.95)");
  g.addColorStop(0.45, "rgba(70,60,48,0.85)");
  g.addColorStop(0.62, "rgba(110,96,74,0.7)");
  g.addColorStop(0.72, "rgba(90,78,60,0.35)");
  g.addColorStop(1, "rgba(80,70,54,0)");
  ctx.fillStyle = g;
  blobPath(ctx, cx, cy, w * 0.48, h * 0.48, rnd, 0.1, 22);
  ctx.fill();
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const d = w * 0.3 + rnd() * w * 0.2;
    ctx.fillStyle = rgb(50 + rnd() * 40, 44 + rnd() * 30, 34 + rnd() * 20, 0.8);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

const bridge: Painter = (ctx, w, h, rnd, biome) => {
  const stone = biome === "urban";
  const pale = biome === "desert";
  const snow = biome === "snow";
  const deck = stone
    ? [142, 138, 128]
    : pale
      ? [176, 148, 108]
      : biome === "jungle"
        ? [92, 70, 46]
        : [138, 108, 72];
  const rail = stone ? [70, 68, 64] : [64, 46, 28];
  const inset = w * 0.08;
  ctx.fillStyle = rgb(deck[0] * 0.45, deck[1] * 0.45, deck[2] * 0.45, 0.55);
  ctx.fillRect(inset + 4, 6, w - inset * 2 - 8, h - 12);
  ctx.fillStyle = rgb(deck[0], deck[1], deck[2]);
  ctx.fillRect(inset, 4, w - inset * 2, h - 8);
  ctx.strokeStyle = "rgba(20,16,10,0.4)";
  ctx.lineWidth = 1.2;
  const plank = stone ? 18 : 11;
  for (let y = 8; y < h - 8; y += plank) {
    ctx.beginPath();
    ctx.moveTo(inset + 1, y + (rnd() - 0.5) * 1.4);
    ctx.lineTo(w - inset - 1, y + (rnd() - 0.5) * 1.4);
    ctx.stroke();
  }
  if (stone) {
    let y = 8;
    while (y < h - 10) {
      const bh = 10 + rnd() * 12;
      ctx.fillStyle = rgb(120 + rnd() * 40, 116 + rnd() * 36, 108 + rnd() * 28);
      ctx.fillRect(inset + 2, y, w - inset * 2 - 4, bh - 1);
      y += bh;
    }
  }
  ctx.fillStyle = rgb(rail[0], rail[1], rail[2]);
  ctx.fillRect(inset - 3, 2, 7, h - 4);
  ctx.fillRect(w - inset - 4, 2, 7, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(inset - 3, 2, 7, 3);
  ctx.fillRect(w - inset - 4, 2, 7, 3);
  if (snow) {
    ctx.fillStyle = "rgba(236,242,250,0.88)";
    ctx.fillRect(inset + 2, 10, w - inset * 2 - 4, h - 20);
  }
  grain(ctx, w, h, 31, 0.16);
};

const fence: Painter = (ctx, w, h, rnd, biome) => {
  const bamboo = biome === "jungle";
  const post = bamboo ? [150, 148, 88] : [118, 88, 52];
  const rail = bamboo ? [132, 128, 70] : [96, 70, 42];
  const postW = bamboo ? 7 : 8;
  for (let x = 6; x < w - 4; x += 22 + rnd() * 6) {
    ctx.fillStyle = rgb(post[0] * 0.7 + rnd() * 20, post[1] * 0.7 + rnd() * 16, post[2] * 0.7);
    ctx.fillRect(x, h * 0.08, postW, h * 0.84);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, h * 0.08, 2, h * 0.84);
  }
  for (const yy of [h * 0.28, h * 0.62]) {
    ctx.fillStyle = rgb(rail[0], rail[1], rail[2]);
    ctx.fillRect(2, yy, w - 4, bamboo ? 5 : 6);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(2, yy + (bamboo ? 4 : 5), w - 4, 2);
  }
  grain(ctx, w, h, 32, 0.18);
};

const tent: Painter = (ctx, w, h, rnd, biome) => {
  const snow = biome === "snow";
  const desert = biome === "desert";
  const canvas = snow
    ? [214, 218, 222]
    : desert
      ? [196, 168, 118]
      : biome === "urban"
        ? [86, 96, 78]
        : [176, 158, 118];
  const dark = canvas.map((c) => c * 0.62);
  const cx = w / 2;
  const inset = w * 0.08;
  ctx.fillStyle = rgb(canvas[0], canvas[1], canvas[2]);
  ctx.beginPath();
  ctx.moveTo(cx, inset);
  ctx.lineTo(w - inset, h / 2);
  ctx.lineTo(cx, h - inset);
  ctx.lineTo(inset, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(dark[0], dark[1], dark[2]);
  ctx.beginPath();
  ctx.moveTo(cx, inset);
  ctx.lineTo(w - inset, h / 2);
  ctx.lineTo(cx, h - inset);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(40,30,18,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, inset);
  ctx.lineTo(cx, h - inset);
  ctx.stroke();
  ctx.strokeStyle = "rgba(40,30,18,0.4)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const t = 0.18 + i * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx, inset + (h - inset * 2) * t);
    ctx.lineTo(inset + (w - inset * 2) * (0.5 - t * 0.42), h / 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(40,30,18,0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(inset, h / 2);
  ctx.lineTo(4, h * 0.18);
  ctx.moveTo(inset, h / 2);
  ctx.lineTo(4, h * 0.82);
  ctx.moveTo(w - inset, h / 2);
  ctx.lineTo(w - 4, h * 0.18);
  ctx.moveTo(w - inset, h / 2);
  ctx.lineTo(w - 4, h * 0.82);
  ctx.stroke();
  ctx.fillStyle = "rgb(70,52,34)";
  ctx.beginPath();
  ctx.arc(cx, h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  grain(ctx, w, h, 33, 0.12);
};

const crate: Painter = (ctx, w, h, rnd) => {
  const inset = w * 0.08;
  ctx.fillStyle = "rgb(150,112,64)";
  ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.fillStyle = "rgb(118,86,48)";
  ctx.fillRect(inset + 6, inset + 6, w - inset * 2 - 12, h - inset * 2 - 12);
  ctx.strokeStyle = "rgba(50,34,16,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.lineWidth = 2;
  for (let x = inset + 10; x < w - inset; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, inset);
    ctx.lineTo(x, h - inset);
    ctx.stroke();
  }
  ctx.fillStyle = "rgb(90,90,88)";
  ctx.fillRect(inset - 2, h * 0.32, w - inset * 2 + 4, 8);
  ctx.fillRect(inset - 2, h * 0.62, w - inset * 2 + 4, 8);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(w * 0.36, h * 0.4, w * 0.28, h * 0.2);
  grain(ctx, w, h, 34, 0.18);
};

const well: Painter = (ctx, w, h, rnd, biome) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.46;
  const ry = h * 0.46;
  const stone = biome === "desert" ? [186, 156, 114] : [148, 146, 138];
  ctx.fillStyle = rgb(stone[0] * 0.7, stone[1] * 0.7, stone[2] * 0.7);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.1;
    const t = 150 + rnd() * 40;
    ctx.fillStyle = biome === "desert" ? rgb(t, t - 28, t - 70) : rgb(t, t - 4, t - 14);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.78,
      cy + Math.sin(a) * ry * 0.78,
      10 + rnd() * 6,
      8 + rnd() * 5,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const water = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, rx * 0.55);
  water.addColorStop(0, "rgb(90,130,148)");
  water.addColorStop(1, "rgb(28,48,62)");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.52, ry * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,38,34,0.6)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();
  grain(ctx, w, h, 35, 0.16);
};

const bunker: Painter = (ctx, w, h, rnd, biome) => {
  const sand = biome === "desert";
  const inset = w * 0.08;
  ctx.fillStyle = sand ? "rgb(176,154,114)" : "rgb(118,120,112)";
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, 18);
  ctx.fill();
  ctx.fillStyle = sand ? "rgb(150,128,92)" : "rgb(92,94,88)";
  ctx.beginPath();
  ctx.roundRect(inset + 10, inset + 10, w - inset * 2 - 20, h - inset * 2 - 20, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(w * 0.22, h * 0.38, w * 0.56, h * 0.16);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(inset, inset, w - inset * 2, 6);
  ctx.strokeStyle = sand ? "rgba(90,70,40,0.4)" : "rgba(40,40,36,0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(inset + 8 + rnd() * (w - inset * 2), inset + 8);
    ctx.lineTo(inset + 8 + rnd() * (w - inset * 2), h - inset - 8);
    ctx.stroke();
  }
  grain(ctx, w, h, 36, 0.14);
};

const barricade: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = "rgb(70,68,62)";
  ctx.fillRect(0, h * 0.18, w, h * 0.64);
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.translate(w * (0.08 + rnd() * 0.84), h * (0.28 + rnd() * 0.44));
    ctx.rotate((rnd() - 0.5) * 0.8);
    const bw = 28 + rnd() * 40;
    const bh = 8 + rnd() * 10;
    ctx.fillStyle = rnd() < 0.4 ? rgb(140, 108, 70) : rgb(96 + rnd() * 30, 94, 88);
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) {
    const t = 140 + rnd() * 30;
    ctx.fillStyle = rgb(t, t - 22, t - 64);
    ctx.beginPath();
    ctx.ellipse(w * (0.1 + rnd() * 0.8), h * (0.3 + rnd() * 0.4), 14, 8, rnd(), 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, w, h, 37, 0.16);
};

const boat: Painter = (ctx, w, h, rnd, biome) => {
  const barge = biome === "urban";
  const cx = w / 2;
  const hull = barge ? [92, 96, 102] : biome === "jungle" ? [86, 64, 40] : [120, 96, 64];
  ctx.fillStyle = rgb(hull[0] * 0.55, hull[1] * 0.55, hull[2] * 0.55);
  ctx.beginPath();
  if (barge) {
    ctx.roundRect(w * 0.16, h * 0.04, w * 0.68, h * 0.92, 10);
  } else {
    ctx.moveTo(cx, h * 0.04);
    ctx.quadraticCurveTo(w * 0.92, h * 0.3, w * 0.86, h * 0.92);
    ctx.lineTo(w * 0.14, h * 0.92);
    ctx.quadraticCurveTo(w * 0.08, h * 0.3, cx, h * 0.04);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(hull[0], hull[1], hull[2]);
  ctx.beginPath();
  if (barge) {
    ctx.roundRect(w * 0.2, h * 0.08, w * 0.6, h * 0.84, 8);
  } else {
    ctx.moveTo(cx, h * 0.1);
    ctx.quadraticCurveTo(w * 0.82, h * 0.32, w * 0.78, h * 0.86);
    ctx.lineTo(w * 0.22, h * 0.86);
    ctx.quadraticCurveTo(w * 0.18, h * 0.32, cx, h * 0.1);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,22,14,0.45)";
  ctx.lineWidth = 2;
  for (let y = h * 0.28; y < h * 0.8; y += h * 0.16) {
    ctx.beginPath();
    ctx.moveTo(w * 0.26, y);
    ctx.lineTo(w * 0.74, y);
    ctx.stroke();
  }
  ctx.fillStyle = barge ? "rgb(70,74,80)" : "rgb(70,52,32)";
  ctx.fillRect(w * 0.42, h * 0.36, w * 0.16, h * 0.22);
  grain(ctx, w, h, 38, 0.16);
};

const SPECS: Record<string, Spec> = {
  "desert/floor": { w: 256, h: 256, paint: desertFloor, tile: true },
  "forest/floor": { w: 256, h: 256, paint: forestFloor, tile: true },
  "snow/log": { w: 96, h: 256, paint: log },
  "jungle/log": { w: 96, h: 256, paint: log },
  "forest/log": { w: 96, h: 256, paint: log },
  "snow/drift": { w: 256, h: 108, paint: drift },
  "snow/cabin": { w: 224, h: 256, paint: cabin },
  "forest/cabin": { w: 224, h: 256, paint: cabin },
  "desert/dune": { w: 256, h: 96, paint: dune },
  "desert/outcrop": { w: 256, h: 224, paint: rock },
  "jungle/boulder": { w: 256, h: 232, paint: rock },
  "desert/scrub": { w: 256, h: 232, paint: scrub },
  "desert/palms": { w: 256, h: 256, paint: palms },
  "jungle/palms": { w: 256, h: 256, paint: palms },
  "desert/adobe": { w: 256, h: 224, paint: adobe },
  "desert/berm": { w: 256, h: 90, paint: berm },
  "jungle/hut": { w: 256, h: 256, paint: hut },
  "forest/oak": { w: 256, h: 256, paint: canopy },
  "forest/hedge": { w: 256, h: 68, paint: hedge },
  "forest/wall": { w: 256, h: 46, paint: stoneWall },
  "forest/barn": { w: 208, h: 256, paint: barn },
  "urban/sandbags": { w: 256, h: 78, paint: sandbags },
  "urban/hedgehog": { w: 128, h: 128, paint: hedgehog },
  "urban/crater": { w: 256, h: 256, paint: crater },
  "snow/bridge": { w: 90, h: 256, paint: bridge },
  "desert/bridge": { w: 90, h: 256, paint: bridge },
  "jungle/bridge": { w: 90, h: 256, paint: bridge },
  "forest/bridge": { w: 90, h: 256, paint: bridge },
  "urban/bridge": { w: 90, h: 256, paint: bridge },
  "snow/fence": { w: 256, h: 36, paint: fence },
  "jungle/fence": { w: 256, h: 36, paint: fence },
  "forest/fence": { w: 256, h: 36, paint: fence },
  "snow/tent": { w: 200, h: 256, paint: tent },
  "desert/tent": { w: 200, h: 256, paint: tent },
  "jungle/tent": { w: 200, h: 256, paint: tent },
  "forest/tent": { w: 200, h: 256, paint: tent },
  "urban/tent": { w: 200, h: 256, paint: tent },
  "snow/crate": { w: 128, h: 128, paint: crate },
  "desert/crate": { w: 128, h: 128, paint: crate },
  "jungle/crate": { w: 128, h: 128, paint: crate },
  "forest/crate": { w: 128, h: 128, paint: crate },
  "urban/crate": { w: 128, h: 128, paint: crate },
  "snow/well": { w: 160, h: 160, paint: well },
  "desert/well": { w: 160, h: 160, paint: well },
  "forest/well": { w: 160, h: 160, paint: well },
  "desert/bunker": { w: 256, h: 214, paint: bunker },
  "urban/bunker": { w: 256, h: 214, paint: bunker },
  "desert/barricade": { w: 256, h: 96, paint: barricade },
  "urban/barricade": { w: 256, h: 96, paint: barricade },
  "jungle/boat": { w: 102, h: 256, paint: boat },
  "forest/boat": { w: 102, h: 256, paint: boat },
  "urban/boat": { w: 102, h: 256, paint: boat },
};

export function hasGenerator(key: string): boolean {
  return key in SPECS;
}

export function generatorKeys(): string[] {
  return Object.keys(SPECS);
}

/** Paints (once) and returns the canvas for a `gen:` skin, or null off-DOM. */
export function generatedSkin(src: string): HTMLCanvasElement | null {
  if (cache.has(src)) return cache.get(src) ?? null;
  const parsed = parseGeneratedSkin(src);
  if (!parsed) return null;
  const spec = SPECS[parsed.key];
  if (!spec) {
    cache.set(src, null);
    return null;
  }
  const canvas = makeCanvas(spec.w, spec.h);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const biome = parsed.key.split("/")[0];
  const rnd = mulberry(hashStr(parsed.key) + parsed.variant * 7919);
  spec.paint(ctx, spec.w, spec.h, rnd, biome);
  cache.set(src, canvas);
  return canvas;
}

/** Data URL for palette thumbnails. */
export function generatedDataUrl(src: string): string | null {
  const hit = urlCache.get(src);
  if (hit) return hit;
  const c = generatedSkin(src);
  if (!c) return null;
  const url = c.toDataURL("image/png");
  urlCache.set(src, url);
  return url;
}
