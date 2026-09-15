import type { Cover } from "../schema/cover.ts";
import type { QuarryLayout } from '../schema/quarry-generator.ts';
import { drawQuarryArtGround, drawQuarryArtCover } from "./quarry-art.ts";
import {
  QUARRY_ROUTES,
  QUARRY_COVER,
  QUARRY_CONNECTORS,
  type LayoutPoint,
} from "../schema/quarry-layout.ts";
export * from "../schema/quarry-layout.ts";
export type QuarryView = { x: number; y: number; cx: number; cy: number; scale: number };
const ART_ROADS = [...QUARRY_ROUTES, ...QUARRY_CONNECTORS.map((points) => ({ points, width: 7 }))];
export function quarryGround(
  ctx: CanvasRenderingContext2D,
  v: QuarryView,
  routes: boolean,
  art = false,
  layout?: QuarryLayout,
) {
  const activeRoutes = layout?.routes ?? QUARRY_ROUTES;
  const activeConnectors = layout?.connectors ?? QUARRY_CONNECTORS;
  ctx.save();
  ctx.translate(v.cx - v.x * v.scale, v.cy + v.y * v.scale);
  ctx.scale(v.scale, -v.scale);
  ctx.fillStyle = "#303a30";
  ctx.fillRect(-64, -64, 128, 128);
  ctx.strokeStyle = "#3c473b";
  ctx.lineWidth = 0.12;
  for (let n = -60; n <= 60; n += 10) {
    ctx.beginPath();
    ctx.moveTo(n, -64);
    ctx.lineTo(n, 64);
    ctx.moveTo(-64, n);
    ctx.lineTo(64, n);
    ctx.stroke();
  }
  // Large, quiet land-use masses; no noisy texture or misleading elevation.
  ctx.fillStyle = "#44483f";
  ctx.fillRect(-61, -35, 40, 72);
  ctx.fillStyle = "#4b4940";
  ctx.fillRect(-22, -29, 49, 58);
  ctx.fillStyle = "#273d32";
  ctx.fillRect(26, -34, 35, 71);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const road = (pts: readonly LayoutPoint[], width: number, color: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  for (const route of activeRoutes) {
    road(route.points, route.width + 2, "#55594c");
    road(route.points, route.width, "#777362");
  }
  for (const connector of activeConnectors) road(connector, 7, "#777362");
  if (art) drawQuarryArtGround(ctx, layout ? [...activeRoutes, ...activeConnectors.map(points => ({points, width: 7}))] : ART_ROADS, layout?.cover ?? QUARRY_COVER, layout ? `${layout.complexity}:${layout.seed}` : 'classic');
  if (routes)
    for (const route of activeRoutes) {
      ctx.setLineDash([1, 2]);
      road(route.points, 0.35, "#d4c398");
      ctx.setLineDash([]);
    }
  for (const y of [-50, 50]) {
    ctx.beginPath();
    ctx.arc(0, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#b5c4ae";
    ctx.lineWidth = 0.3;
    ctx.stroke();
  }
  ctx.restore();
}

export function quarryCover(
  ctx: CanvasRenderingContext2D,
  cover: Cover[],
  v: QuarryView,
  collision: boolean,
  art = false,
) {
  for (const c of cover) {
    if (c.sourceId) continue;
    const x = v.cx + (c.x - v.x) * v.scale,
      y = v.cy - (c.y - v.y) * v.scale;
    const w = c.halfW * 2 * v.scale,
      h = c.halfL * 2 * v.scale;
    if (art) {
      drawQuarryArtCover(ctx, c, x, y, w, h);
    } else {
      ctx.fillStyle =
        c.kind === "bush" ? "#466750" : c.id.startsWith("house") ? "#ada18a" : "#787b70";
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = c.kind === "bush" ? "#6e9674" : "#c0bbaa";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4);
      if (c.id.startsWith("house")) {
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2 + 3);
        ctx.lineTo(x, y + h / 2 - 3);
        ctx.stroke();
      }
    }
    if (collision) {
      ctx.save();
      ctx.strokeStyle = c.kind === "bush" ? "#87dab0" : "#f0bc76";
      ctx.lineWidth = 1.5;
      ctx.setLineDash(c.kind === "bush" ? [4, 3] : []);
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      // Hull-center exclusion boundary used by the existing 1.7m collision rule.
      if (c.kind === "wreck") {
        const p = 1.7 * v.scale;
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([2, 4]);
        ctx.strokeRect(x - w / 2 - p, y - h / 2 - p, w + 2 * p, h + 2 * p);
      }
      ctx.restore();
    }
  }
}
