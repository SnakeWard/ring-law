import type { Cover } from "../schema/cover.ts";
import type { LayoutPoint } from "./quarry.ts";

// Cosmetic only. The approved map data owns all footprints and road widths.
// Light comes from screen northwest. Static detail is baked once, never per frame.
type Road = { points: readonly LayoutPoint[]; width: number };
const RES = 16;
const AREA = { left: -64, top: 64, width: 128, height: 128 };
let ground: HTMLCanvasElement | null = null;
let groundKey = '';
const objects = new Map<string, HTMLCanvasElement>();

function rng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x: number, y: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let u = x - ix,
    v = y - iy;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return (
    (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
  );
}
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}
function path(ctx: CanvasRenderingContext2D, points: readonly LayoutPoint[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}
function nearestRoad(x: number, y: number, roads: readonly Road[]) {
  let edge = Infinity;
  for (const road of roads)
    for (let i = 1; i < road.points.length; i++) {
      const [ax, ay] = road.points[i - 1],
        [bx, by] = road.points[i];
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      edge = Math.min(edge, Math.hypot(x - ax - t * dx, y - ay - t * dy) - road.width / 2);
    }
  return edge;
}
function inSolid(x: number, y: number, cover: readonly Cover[], pad = 0) {
  return cover.some(
    (c) =>
      c.kind === "wreck" && Math.abs(x - c.x) < c.halfW + pad && Math.abs(y - c.y) < c.halfL + pad,
  );
}

function bakeGround(roads: readonly Road[], cover: readonly Cover[]) {
  const c = canvas(AREA.width * RES, AREA.height * RES),
    ctx = c.getContext("2d")!;
  const pixels = ctx.createImageData(c.width, c.height);
  const random = rng(73921);
  // Coherent soil/grass patches, with fine grain subordinate to the large forms.
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      const x = AREA.left + px / RES,
        y = AREA.top - py / RES;
      const n = noise(x * 0.14, y * 0.14),
        n2 = noise(x * 0.7, y * 0.7);
      const grit = (random() - 0.5) * 11;
      const woodland = Math.max(0, Math.min(1, (x - 20) / 22));
      const quarry = Math.max(0, Math.min(1, (-x - 23) / 25));
      const i = (py * c.width + px) * 4;
      pixels.data[i] = 65 + n * 25 + n2 * 7 + grit - woodland * 18 + quarry * 10;
      pixels.data[i + 1] = 73 + n * 24 + n2 * 7 + grit - woodland * 8 + quarry * 5;
      pixels.data[i + 2] = 49 + n * 15 + n2 * 6 + grit + quarry * 12;
      pixels.data[i + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  ctx.save();
  ctx.translate(-AREA.left * RES, AREA.top * RES);
  ctx.scale(RES, -RES);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const stroke = (road: Road, width: number, color: string) => {
    path(ctx, road.points);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  // Blended gravel verges; every drivable road retains its authored width.
  for (const road of roads) {
    stroke(road, road.width + 4, "rgba(120,114,88,0.18)");
    stroke(road, road.width + 2, "rgba(144,134,102,0.28)");
    stroke(road, road.width, "#89816b");
    stroke(road, road.width - 1, "#807863");
    stroke(road, Math.max(1, road.width - 4), "rgba(95,90,74,0.15)");
  }
  for (const b of cover.filter((b) => b.kind === "wreck")) {
    // Scuffed foundations/aprons are flat ground, not extra obstacles.
    ctx.fillStyle = b.id.startsWith("house") ? "#777664" : "#969382";
    ctx.fillRect(b.x - b.halfW - 0.8, b.y - b.halfL - 0.8, b.halfW * 2 + 1.6, b.halfL * 2 + 1.6);
  }
  // Small aggregate and grass break the road edge without narrowing a passage.
  for (let i = 0; i < 26000; i++) {
    const x = AREA.left + random() * AREA.width,
      y = AREA.top - random() * AREA.height;
    if (inSolid(x, y, cover)) continue;
    const edge = nearestRoad(x, y, roads);
    if (edge < 1.4) {
      const r = 0.025 + random() * (edge > 0 ? 0.11 : 0.07);
      ctx.fillStyle = random() > 0.55 ? "rgba(209,201,170,0.32)" : "rgba(51,50,40,0.25)";
      ctx.fillRect(x, y, r * 1.8, r);
    } else {
      ctx.strokeStyle = random() > 0.5 ? "rgba(139,146,93,0.38)" : "rgba(38,52,35,0.4)";
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.22);
      ctx.stroke();
    }
  }
  // Village paving connects to the same road graph instead of floating under props.
  for (let y = -31; y < 31; y += 0.55)
    for (let x = -22; x < 24; x += 0.8) {
      const ox = x + (Math.round(y / 0.55) % 2) * 0.35;
      if (nearestRoad(ox, y, roads) > -0.25 || inSolid(ox, y, cover, 0.3)) continue;
      const shade = Math.floor(99 + random() * 31);
      ctx.fillStyle = `rgb(${shade + 8},${shade + 6},${shade - 5})`;
      ctx.fillRect(ox + 0.04, y + 0.04, 0.7, 0.44);
    }
  // Twin worn track lines, kept quiet so they do not resemble lane markers.
  for (const road of roads)
    for (let i = 1; i < road.points.length; i++) {
      const [ax, ay] = road.points[i - 1],
        [bx, by] = road.points[i];
      const length = Math.hypot(bx - ax, by - ay),
        nx = -(by - ay) / length,
        ny = (bx - ax) / length;
      for (const side of [-1, 1]) {
        ctx.strokeStyle = "rgba(63,59,47,0.17)";
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(ax + nx * side, ay + ny * side);
        ctx.lineTo(bx + nx * side, by + ny * side);
        ctx.stroke();
      }
    }
  // Low scrub belongs to verges and patches, never to an unmarked solid prop.
  for (let i = 0; i < 1000; i++) {
    const x = -62 + random() * 124,
      y = -62 + random() * 124;
    if (nearestRoad(x, y, roads) < 1.8 || inSolid(x, y, cover, 1.2)) continue;
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j % 2 ? "#586944" : "#718055";
      ctx.beginPath();
      ctx.ellipse(
        x + random() * 0.65,
        y + random() * 0.65,
        0.22 + random() * 0.2,
        0.15,
        random() * 6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  for (const b of cover.filter((b) => b.kind === "wreck")) {
    // Short consistent cast shadows, not a generic ellipse under every object.
    ctx.fillStyle = "rgba(22,27,23,0.32)";
    ctx.fillRect(b.x - b.halfW + 0.65, b.y - b.halfL - 0.75, b.halfW * 2, b.halfL * 2);
    if (b.id.startsWith("quarry"))
      for (let i = 0; i < 85; i++) {
        const a = random() * Math.PI * 2;
        const x = b.x + Math.cos(a) * (b.halfW + 0.3 + random()),
          y = b.y + Math.sin(a) * (b.halfL + 0.3 + random());
        if (inSolid(x, y, cover)) continue;
        ctx.fillStyle = i % 2 ? "#b6b3a0" : "#66695e";
        ctx.fillRect(x, y, 0.1 + random() * 0.24, 0.1 + random() * 0.15);
      }
  }
  ctx.restore();
  return c;
}

export function drawQuarryArtGround(
  ctx: CanvasRenderingContext2D,
  roads: readonly Road[],
  cover: readonly Cover[],
  key = 'classic',
) {
  if (!ground || key !== groundKey) {
    ground = bakeGround(roads, cover);
    groundKey = key;
  }
  ctx.save();
  ctx.translate(AREA.left, AREA.top);
  ctx.scale(1, -1);
  ctx.drawImage(ground, 0, 0, AREA.width, AREA.height);
  ctx.restore();
}

function polygon(ctx: CanvasRenderingContext2D, pts: number[][], fill: string) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function rockSprite(b: Cover) {
  const w = b.halfW * 2 * 24,
    h = b.halfL * 2 * 24,
    c = canvas(w, h),
    ctx = c.getContext("2d")!;
  const random = rng(Math.round(b.x * b.y) + 173);
  ctx.fillStyle = "#60645a";
  ctx.fillRect(0, 0, w, h);
  const cols = 4,
    rows = Math.ceil(h / 52);
  const grid = Array.from({ length: rows + 1 }, (_, y) =>
    Array.from({ length: cols + 1 }, (_, x) => [
      x === 0 ? 0 : x === cols ? w : (x * w) / cols + (((random() - 0.5) * w) / cols) * 0.65,
      y === 0 ? 0 : y === rows ? h : (y * h) / rows + (((random() - 0.5) * h) / rows) * 0.5,
    ]),
  );
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const pts = [grid[row][col], grid[row][col + 1], grid[row + 1][col + 1], grid[row + 1][col]];
      const shade = Math.floor(119 + random() * 40);
      polygon(ctx, pts, `rgb(${shade + 11},${shade + 12},${shade})`);
      const center = [
        pts.reduce((sum, p) => sum + p[0], 0) / 4 - 8,
        pts.reduce((sum, p) => sum + p[1], 0) / 4 - 6,
      ];
      polygon(ctx, [pts[0], pts[1], center], "rgba(223,222,197,0.27)");
      polygon(ctx, [pts[2], pts[3], center], "rgba(40,48,40,0.3)");
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = "rgba(39,45,37,0.7)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + 2, pts[0][1] + 2);
      ctx.lineTo(pts[1][0] - 2, pts[1][1] + 2);
      ctx.strokeStyle = "rgba(224,223,201,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  // Fine strata and cracks stay inside the collision footprint.
  for (let i = 0; i < 600; i++) {
    const x = random() * w,
      y = random() * h;
    ctx.fillStyle = i % 2 ? "rgba(240,234,204,0.16)" : "rgba(30,37,29,0.17)";
    ctx.fillRect(x, y, 1 + random() * 7, 0.6 + random());
  }
  ctx.strokeStyle = "#4c5246";
  ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, w, h);
  return c;
}
function houseSprite(b: Cover) {
  const w = b.halfW * 2 * 24,
    h = b.halfL * 2 * 24,
    c = canvas(w, h),
    ctx = c.getContext("2d")!;
  const random = rng(Math.round(b.x * b.y) + 713);
  ctx.fillStyle = "#403e34";
  ctx.fillRect(0, 0, w, h);
  // Masonry perimeter occupies the full approved foundation rectangle.
  for (let y = 0; y < h; y += 9)
    for (let x = 0; x < w; x += 17) {
      const light = Math.floor(125 + random() * 30);
      ctx.fillStyle = `rgb(${light + 10},${light + 5},${light - 17})`;
      ctx.fillRect(x + 1 + (y % 18 ? 6 : 0), y + 1, 15, 7);
    }
  const inset = 7,
    mid = w * 0.5;
  ctx.fillStyle = "#252e2b";
  ctx.fillRect(inset - 2, inset - 2, w - inset * 2 + 4, h - inset * 2 + 4);
  const slate = b.id === "house-sw" || b.id === "house-east";
  ctx.fillStyle = slate ? "#697975" : "#957861";
  ctx.fillRect(inset, inset, mid - inset, h - inset * 2);
  ctx.fillStyle = slate ? "#4c5a59" : "#6f5647";
  ctx.fillRect(mid, inset, w - mid - inset, h - inset * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.clip();
  for (let y = inset; y < h - inset; y += 9)
    for (let x = inset - 5; x < w - inset; x += 13) {
      const ox = x + (Math.round(y / 9) % 2 ? 6 : 0);
      ctx.fillStyle = `rgba(${slate ? "174,184,175" : "218,183,140"},${0.03 + random() * 0.18})`;
      ctx.fillRect(ox, y, 11, 7);
      ctx.strokeStyle = "rgba(26,30,26,0.45)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(ox, y + 8);
      ctx.lineTo(ox + 12, y + 8);
      ctx.moveTo(ox + 12, y);
      ctx.lineTo(ox + 12, y + 8);
      ctx.stroke();
    }
  ctx.restore();
  ctx.fillStyle = slate ? "#9da79a" : "#ba9c77";
  ctx.fillRect(mid - 2, inset, 4, h - inset * 2);
  ctx.fillStyle = "rgba(24,31,28,0.55)";
  ctx.fillRect(mid + 2, inset, 2, h - inset * 2);
  // One chimney, sharing the northwest light direction of stone and tank art.
  const chimneyX = mid + w * 0.2,
    chimneyY = h * 0.25;
  ctx.fillStyle = "rgba(21,26,23,0.45)";
  ctx.fillRect(chimneyX + 5, chimneyY + 7, 16, 20);
  ctx.fillStyle = "#b1a48c";
  ctx.fillRect(chimneyX, chimneyY, 15, 19);
  ctx.fillStyle = "#716758";
  ctx.fillRect(chimneyX + 3, chimneyY + 3, 10, 13);
  ctx.fillStyle = "#252a24";
  ctx.fillRect(chimneyX + 5, chimneyY + 5, 6, 9);
  return c;
}
function groveSprite(b: Cover) {
  const w = b.halfW * 48,
    h = b.halfL * 48;
  const c = canvas(w, h),
    ctx = c.getContext("2d")!;
  const random = rng(Math.round(b.x * b.y) + 291);
  // A continuous low understory identifies the whole soft-cover footprint.
  ctx.fillStyle = "#344d35";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < Math.ceil((w * h) / 260); i++) {
    const x = random() * w,
      y = random() * h,
      r = 8 + random() * 15;
    ctx.fillStyle = "rgba(16,30,23,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let j = 0; j < 5; j++) {
      const angle = (j * Math.PI * 2) / 5;
      ctx.fillStyle = ["#496642", "#57754a", "#668253", "#425f3d", "#3e5839"][j];
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(angle) * r * 0.38,
        y + Math.sin(angle) * r * 0.38,
        r * 0.65,
        r * 0.5,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  return c;
}
export function drawQuarryArtCover(
  ctx: CanvasRenderingContext2D,
  b: Cover,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const key = `${b.id}:${b.kind}:${b.halfW}:${b.halfL}`;
  let sprite = objects.get(key);
  if (!sprite) {
    sprite =
      b.hp === 0 ? rockSprite(b) : b.kind === "bush"
        ? groveSprite(b)
        : b.id.startsWith("house")
          ? houseSprite(b)
          : rockSprite(b);
    if (objects.size > 160) objects.clear();
    objects.set(key, sprite);
  }
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
  if (b.hp === 0 && b.id.startsWith('house')) {
    ctx.fillStyle = '#625d51';
    ctx.fillRect(x - w * 0.38, y - h * 0.38, w * 0.76, h * 0.76);
    ctx.strokeStyle = '#aaa18b';
    ctx.lineWidth = Math.max(1, w * 0.045);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.33 + w * i * 0.1, y - h * 0.3);
      ctx.lineTo(x + w * 0.3 - w * i * 0.08, y + h * 0.3);
      ctx.stroke();
    }
  } else if (b.destructible && (b.hp ?? 160) < (b.hpMax ?? 160)) {
    ctx.fillStyle = 'rgba(32,24,18,0.48)';
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.24, h * 0.3, 0.4, 0, Math.PI * 2); ctx.fill();
  }
}
