import { FLOOR_TILE_M } from "../schema/skin.ts";
import type { Cover } from "../schema/cover.ts";
import type { Road } from "../schema/maps.ts";
import type { RiverStyle, RoadStyle } from "../schema/biomes.ts";
import { polylineAt, type River, type RiverCrossing } from "../schema/river.ts";
import { skinImage } from "./atlas.ts";

/**
 * Shared scene painter: floor, roads, rivers, cover. The range renderer and
 * the level editor both draw through here so what you place is what you
 * fight on.
 */

export type View = { camX: number; camY: number; cx: number; cy: number; scale: number };

export const SCENE_COL = {
  bg: "#0a0b0a",
  yard: "#161916",
  line: "#2a2e2a",
  bush: "#243528",
  bushStroke: "#3d5a42",
  wreck: "#2a2622",
  wreckStroke: "#6a6258",
};

export function sx(v: View, x: number) {
  return v.cx + (x - v.camX) * v.scale;
}
export function sy(v: View, y: number) {
  return v.cy - (y - v.camY) * v.scale;
}

export function drawSitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  yawDeg: number,
  halfW: number,
  halfL: number,
  alpha = 0.4,
) {
  ctx.save();
  ctx.translate(x, y + Math.max(2, halfL * 0.05));
  ctx.rotate((-yawDeg * Math.PI) / 180);
  ctx.fillStyle = `rgba(22, 14, 8, ${alpha})`;
  ctx.shadowColor = `rgba(22, 14, 8, ${Math.min(0.55, alpha + 0.12)})`;
  ctx.shadowBlur = Math.max(8, halfW * 0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, halfW * 0.94, halfL * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  v: View,
  floorSrc: string,
  arenaM: number,
) {
  const left = sx(v, -arenaM);
  const top = sy(v, arenaM);
  const size = arenaM * 2 * v.scale;
  ctx.fillStyle = SCENE_COL.yard;
  ctx.fillRect(left, top, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.clip();
  const tile = skinImage(floorSrc);
  if (tile) {
    const tpx = FLOOR_TILE_M * v.scale;
    const viewHalfW = ctx.canvas.width / v.scale;
    const viewHalfH = ctx.canvas.height / v.scale;
    const gx0 = Math.max(-arenaM, Math.floor((v.camX - viewHalfW) / FLOOR_TILE_M) * FLOOR_TILE_M);
    const gx1 = Math.min(arenaM, v.camX + viewHalfW);
    const gy0 = Math.max(-arenaM, Math.floor((v.camY - viewHalfH) / FLOOR_TILE_M) * FLOOR_TILE_M);
    const gy1 = Math.min(arenaM, v.camY + viewHalfH);
    for (let gx = gx0; gx < gx1; gx += FLOOR_TILE_M) {
      for (let gy = gy0; gy < gy1; gy += FLOOR_TILE_M) {
        const x = sx(v, gx);
        const y = sy(v, gy + FLOOR_TILE_M);
        const ix = Math.round((gx + arenaM) / FLOOR_TILE_M);
        const iy = Math.round((gy + arenaM) / FLOOR_TILE_M);
        const rot = ((ix + iy * 3) & 3) * (Math.PI / 2);
        ctx.save();
        ctx.translate(x + tpx / 2, y + tpx / 2);
        ctx.rotate(rot);
        ctx.drawImage(tile, -tpx / 2, -tpx / 2, tpx + 0.5, tpx + 0.5);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle = SCENE_COL.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, size, size);
}

const ROAD_PALETTE: Record<RoadStyle, { fill: string; edge: string; rut: string }> = {
  packed: {
    fill: "rgba(196,200,208,0.55)",
    edge: "rgba(120,126,136,0.45)",
    rut: "rgba(90,96,104,0.35)",
  },
  sand: { fill: "rgba(170,140,96,0.6)", edge: "rgba(120,96,64,0.4)", rut: "rgba(110,88,58,0.4)" },
  mud: { fill: "rgba(96,72,46,0.7)", edge: "rgba(60,44,28,0.5)", rut: "rgba(48,34,20,0.5)" },
  dirt: { fill: "rgba(128,102,68,0.7)", edge: "rgba(80,62,40,0.5)", rut: "rgba(70,54,34,0.45)" },
  asphalt: {
    fill: "rgba(56,58,60,0.92)",
    edge: "rgba(120,122,124,0.6)",
    rut: "rgba(200,200,190,0.35)",
  },
};

function strokePath(
  ctx: CanvasRenderingContext2D,
  v: View,
  pts: readonly { x: number; y: number }[],
) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = sx(v, p.x);
    const y = sy(v, p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

export function drawRoads(
  ctx: CanvasRenderingContext2D,
  v: View,
  roads: readonly Road[],
  style: RoadStyle,
) {
  const pal = ROAD_PALETTE[style];
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const r of roads) {
    if (r.points.length < 2) continue;
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = (r.widthM + 0.8) * v.scale;
    ctx.stroke();
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.fill;
    ctx.lineWidth = r.widthM * v.scale;
    ctx.stroke();
    if (style === "asphalt") {
      strokePath(ctx, v, r.points);
      ctx.strokeStyle = pal.rut;
      ctx.lineWidth = Math.max(1, 0.18 * v.scale);
      ctx.setLineDash([2.2 * v.scale, 1.6 * v.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = pal.rut;
      ctx.lineWidth = Math.max(1, 0.28 * v.scale);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i < r.points.length; i++) {
          const p = r.points[i];
          const q = r.points[Math.min(r.points.length - 1, i + 1)];
          const o = r.points[Math.max(0, i - 1)];
          const tx = q.x - o.x;
          const ty = q.y - o.y;
          const len = Math.hypot(tx, ty) || 1;
          const nx = (-ty / len) * side * r.widthM * 0.28;
          const ny = (tx / len) * side * r.widthM * 0.28;
          const x = sx(v, p.x + nx);
          const y = sy(v, p.y + ny);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const RIVER_PALETTE: Record<
  RiverStyle,
  {
    bank: string;
    bed: string;
    water: string;
    shimmer: string;
    ford: string;
    deck: string;
    rail: string;
    square: boolean;
  }
> = {
  ice: {
    bank: "rgba(190,204,220,0.9)",
    bed: "rgb(170,196,222)",
    water: "rgb(196,220,238)",
    shimmer: "rgba(255,255,255,0.55)",
    ford: "rgba(150,180,210,0.7)",
    deck: "rgb(110,80,50)",
    rail: "rgb(60,42,26)",
    square: false,
  },
  wadi: {
    bank: "rgba(150,124,86,0.95)",
    bed: "rgb(176,150,110)",
    water: "rgb(96,118,110)",
    shimmer: "rgba(180,200,190,0.35)",
    ford: "rgba(190,170,130,0.75)",
    deck: "rgb(160,140,110)",
    rail: "rgb(100,84,60)",
    square: false,
  },
  jungle: {
    bank: "rgba(78,62,38,0.95)",
    bed: "rgb(92,80,52)",
    water: "rgb(96,92,58)",
    shimmer: "rgba(190,180,120,0.3)",
    ford: "rgba(150,140,96,0.7)",
    deck: "rgb(120,96,56)",
    rail: "rgb(70,54,30)",
    square: false,
  },
  stream: {
    bank: "rgba(86,92,60,0.95)",
    bed: "rgb(70,84,78)",
    water: "rgb(58,96,110)",
    shimmer: "rgba(200,230,240,0.42)",
    ford: "rgba(140,150,130,0.7)",
    deck: "rgb(118,86,50)",
    rail: "rgb(64,44,26)",
    square: false,
  },
  canal: {
    bank: "rgba(96,98,96,1)",
    bed: "rgb(40,58,62)",
    water: "rgb(36,64,70)",
    shimmer: "rgba(170,200,210,0.32)",
    ford: "rgba(120,130,120,0.7)",
    deck: "rgb(128,124,116)",
    rail: "rgb(70,68,64)",
    square: true,
  },
};

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function drawCrossing(
  ctx: CanvasRenderingContext2D,
  v: View,
  r: River,
  c: RiverCrossing,
  style: RiverStyle,
) {
  const pal = RIVER_PALETTE[style];
  const p = polylineAt(r.points, c.atM);
  const x = sx(v, p.x);
  const y = sy(v, p.y);
  const ang = Math.atan2(-p.ty, p.tx) + (-(c.yawDeg ?? 0) * Math.PI) / 180;
  const along = c.lengthM * v.scale;
  const across = (r.widthM + (c.kind === "bridge" ? 2.4 : 1)) * v.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (c.kind === "ford") {
    ctx.fillStyle = pal.ford;
    ctx.beginPath();
    ctx.roundRect(-along / 2, -across / 2, along, across, Math.min(along, across) * 0.3);
    ctx.fill();
    let h = hashId(c.id);
    const n = Math.max(6, Math.round(c.lengthM * r.widthM * 0.35));
    for (let i = 0; i < n; i++) {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      const ux = ((h & 0xffff) / 0xffff - 0.5) * along * 0.9;
      const uy = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * across * 0.8;
      ctx.fillStyle = (i & 1) === 0 ? "rgba(120,120,116,0.85)" : "rgba(160,158,150,0.85)";
      ctx.beginPath();
      ctx.ellipse(ux, uy, 0.28 * v.scale, 0.2 * v.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-along / 2 + 2, -across / 2 + 3, along, across);
    ctx.fillStyle = pal.deck;
    ctx.fillRect(-along / 2, -across / 2, along, across);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    const plank = (pal.square ? 1.1 : 0.42) * v.scale;
    for (let px = -along / 2 + plank; px < along / 2; px += plank) {
      ctx.beginPath();
      ctx.moveTo(px, -across / 2);
      ctx.lineTo(px, across / 2);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.rail;
    ctx.lineWidth = Math.max(1.5, 0.22 * v.scale);
    ctx.beginPath();
    ctx.moveTo(-along / 2, -across / 2 + 1);
    ctx.lineTo(along / 2, -across / 2 + 1);
    ctx.moveTo(-along / 2, across / 2 - 1);
    ctx.lineTo(along / 2, across / 2 - 1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRivers(
  ctx: CanvasRenderingContext2D,
  v: View,
  rivers: readonly River[],
  style: RiverStyle,
  time: number,
) {
  const pal = RIVER_PALETTE[style];
  ctx.save();
  ctx.lineJoin = pal.square ? "miter" : "round";
  ctx.lineCap = pal.square ? "butt" : "round";
  for (const r of rivers) {
    if (r.points.length < 2) continue;
    const w = r.widthM * v.scale;
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.bank;
    ctx.lineWidth = w + 2.2 * v.scale;
    ctx.stroke();
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.bed;
    ctx.lineWidth = w;
    ctx.stroke();
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.water;
    ctx.lineWidth = style === "wadi" ? w * 0.36 : w * 0.82;
    ctx.stroke();
    strokePath(ctx, v, r.points);
    ctx.strokeStyle = pal.shimmer;
    ctx.lineWidth = Math.max(1, (style === "wadi" ? 0.12 : 0.22) * v.scale);
    if (style === "ice") {
      ctx.setLineDash([3 * v.scale, 5 * v.scale]);
      ctx.lineDashOffset = 0;
    } else {
      ctx.setLineDash([1.6 * v.scale, 2.8 * v.scale]);
      ctx.lineDashOffset = -time * 1.4 * v.scale;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (pal.square) {
      strokePath(ctx, v, r.points);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = w + 0.3 * v.scale;
      ctx.setLineDash([]);
      ctx.stroke();
      strokePath(ctx, v, r.points);
      ctx.strokeStyle = pal.water;
      ctx.lineWidth = w - 0.4 * v.scale;
      ctx.stroke();
    }
    for (const c of r.crossings) drawCrossing(ctx, v, r, c, style);
  }
  ctx.restore();
}

export function drawCoverSprite(
  ctx: CanvasRenderingContext2D,
  v: View,
  c: Cover,
  bushSkin: string,
  wreckSkin: string,
) {
  const x = sx(v, c.x);
  const y = sy(v, c.y);
  const wpx = c.halfW * 2 * v.scale;
  const hpx = c.halfL * 2 * v.scale;
  const yaw = c.yawDeg ?? 0;
  drawSitShadow(ctx, x, y, yaw, wpx / 2, hpx / 2, c.kind === "wreck" ? 0.42 : 0.22);
  const src = c.skin ?? (c.kind === "bush" ? bushSkin : wreckSkin);
  const img = skinImage(src);
  ctx.save();
  ctx.translate(x, y);
  if (yaw) ctx.rotate((-yaw * Math.PI) / 180);
  if (img) {
    ctx.drawImage(img, -wpx / 2, -hpx / 2, wpx, hpx);
  } else if (c.kind === "bush") {
    ctx.fillStyle = SCENE_COL.bush;
    ctx.strokeStyle = SCENE_COL.bushStroke;
    ctx.beginPath();
    ctx.ellipse(0, 0, wpx / 2, hpx / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.fillStyle = SCENE_COL.wreck;
    ctx.strokeStyle = SCENE_COL.wreckStroke;
    ctx.beginPath();
    ctx.roundRect(-wpx / 2, -hpx / 2, wpx, hpx, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SCENE_COL.line;
    ctx.fillRect(-wpx * 0.15, -hpx / 2 - 3, wpx * 0.3, 5);
  }
  ctx.restore();
}
