/**
 * RIVER LAW v1 — water is a motion wall, not a sight wall.
 *
 * A river is a polyline with a width. Hulls cannot enter the water.
 * Shots, ring, and hull sight all pass over it. Crossings are arclength
 * spans along the river: a FORD is passable but slow, a BRIDGE is passable
 * at full speed. Every playable map that splits the spawns needs at least
 * one crossing — the level validator enforces this by path search.
 */
export const RIVER_LAW = {
  version: 1,
  frozenAt: "2026-09-14",
  evidence: "assumed" as const,
  blocks: ["motion"] as const,
  passes: ["ring", "hull", "shot"] as const,
  fordSpeedMul: 0.55,
  bridgeSpeedMul: 1,
  minWidthM: 3,
  maxWidthM: 14,
  minCrossingM: 5,
  maxCrossingM: 16,
  /** Extra clearance a hull keeps from the water line. */
  bankPadM: 0.3,
  deferred: [
    "Destructible bridges",
    "Deep fords that drown engines",
    "Current push",
  ],
} as const;

export const CROSSING_KINDS = ["ford", "bridge"] as const;
export type CrossingKind = (typeof CROSSING_KINDS)[number];

export type Pt = { x: number; y: number };

export type RiverCrossing = {
  id: string;
  kind: CrossingKind;
  /** Arclength from the first point to the crossing centre, metres. */
  atM: number;
  /** Span along the river, metres. */
  lengthM: number;
  /** Twist off the river tangent, hull-basis degrees. Missing = 0. */
  yawDeg?: number;
};

export type River = {
  id: string;
  points: Pt[];
  widthM: number;
  crossings: RiverCrossing[];
};

export type RiverProbe = {
  river: River;
  /** Arclength of the nearest centreline point. */
  s: number;
  /** Distance from the query to the centreline. */
  dist: number;
  /** Nearest centreline point. */
  px: number;
  py: number;
  /** Unit push direction away from the centreline. */
  nx: number;
  ny: number;
  crossing: RiverCrossing | null;
};

export function polylineLength(points: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return len;
}

export function riverLengthM(r: Pick<River, "points">): number {
  return polylineLength(r.points);
}

/** Point and unit tangent at arclength s (clamped to the ends). */
export function polylineAt(
  points: readonly Pt[],
  s: number,
): { x: number; y: number; tx: number; ty: number } {
  if (points.length === 0) return { x: 0, y: 0, tx: 1, ty: 0 };
  if (points.length === 1)
    return { x: points[0].x, y: points[0].y, tx: 1, ty: 0 };
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    if (s <= acc + seg || i === points.length - 1) {
      const t = Math.max(0, Math.min(1, (s - acc) / seg));
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        tx: (b.x - a.x) / seg,
        ty: (b.y - a.y) / seg,
      };
    }
    acc += seg;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, tx: 1, ty: 0 };
}

/** Catmull–Rom resample so the drawn bank and the collision bank agree. */
export function smoothPolyline(points: readonly Pt[], subdiv = 6): Pt[] {
  if (points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Pt[] = [];
  const n = points.length;
  const P = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let k = 0; k < subdiv; k++) {
      const t = k / subdiv;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ x: points[n - 1].x, y: points[n - 1].y });
  return out;
}

export function crossingAt(
  r: Pick<River, "crossings">,
  s: number,
): RiverCrossing | null {
  for (const c of r.crossings) {
    if (Math.abs(s - c.atM) <= c.lengthM / 2) return c;
  }
  return null;
}

export function nearestOnRiver(
  r: River,
  x: number,
  y: number,
): Omit<RiverProbe, "crossing"> {
  let best = { s: 0, dist: Infinity, px: x, py: y, nx: 1, ny: 0 };
  let acc = 0;
  const pts = r.points;
  if (pts.length === 1) {
    const d = Math.hypot(x - pts[0].x, y - pts[0].y) || 1e-6;
    return {
      river: r,
      s: 0,
      dist: d,
      px: pts[0].x,
      py: pts[0].y,
      nx: (x - pts[0].x) / d,
      ny: (y - pts[0].y) / d,
    };
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg = Math.hypot(dx, dy);
    if (seg === 0) continue;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (seg * seg)),
    );
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.dist) {
      let nx = x - px;
      let ny = y - py;
      if (d < 1e-6) {
        nx = -dy / seg;
        ny = dx / seg;
      } else {
        nx /= d;
        ny /= d;
      }
      best = { s: acc + seg * t, dist: d, px, py, nx, ny };
    }
    acc += seg;
  }
  return { river: r, ...best };
}

/** The river whose water (plus pad) contains the point, or null. */
export function riverProbe(
  rivers: readonly River[],
  x: number,
  y: number,
  pad = 0,
): RiverProbe | null {
  let best: RiverProbe | null = null;
  for (const r of rivers) {
    if (r.points.length < 2) continue;
    const n = nearestOnRiver(r, x, y);
    if (n.dist > r.widthM / 2 + pad) continue;
    if (!best || n.dist < best.dist)
      best = { ...n, crossing: crossingAt(r, n.s) };
  }
  return best;
}

/** True when the point is in water that a hull may not enter. */
export function inUncrossableWater(
  rivers: readonly River[],
  x: number,
  y: number,
  pad = 0,
): boolean {
  return rivers.some((r) => {
    const p = riverProbe([r], x, y, pad);
    return !!p && !p.crossing;
  });
}

/** Pushes a hull out of uncrossable water. Returns true when it moved. */
export function pushOutRivers(
  pos: { x: number; y: number },
  rivers: readonly River[],
  radius = 1.6,
): boolean {
  let moved = false;
  for (let iter = 0; iter < 3; iter++) {
    const pad = radius + RIVER_LAW.bankPadM;
    let pushed = false;
    for (const r of rivers) {
      const p = riverProbe([r], pos.x, pos.y, pad);
      if (!p || p.crossing || p.dist >= r.widthM / 2 + pad) continue;
      const want = r.widthM / 2 + pad;
      pos.x = p.px + p.nx * want;
      pos.y = p.py + p.ny * want;
      moved = pushed = true;
    }
    if (!pushed) break;
  }
  return moved;
}

/** Speed multiplier for a hull at this point: fords are slow, bridges are dry. */
export function riverSpeedMul(
  rivers: readonly River[],
  x: number,
  y: number,
): number {
  let mul = 1;
  for (const r of rivers) {
    const p = riverProbe([r], x, y, 0);
    if (p?.crossing?.kind === "ford") mul = RIVER_LAW.fordSpeedMul;
  }
  return mul;
}

/** True when the straight run from A to B enters uncrossable water. Sampled every metre. */
export function riverBlocksSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rivers: readonly River[],
  stepM = 1,
): boolean {
  if (!rivers.length) return false;
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(len / stepM));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (inUncrossableWater(rivers, ax + (bx - ax) * t, ay + (by - ay) * t, 0))
      return true;
  }
  return false;
}

export function crossingCenter(r: River, c: RiverCrossing): Pt {
  const p = polylineAt(r.points, c.atM);
  return { x: p.x, y: p.y };
}

/** The dry-land point just past a crossing on the side facing (bx, by). */
export function crossingExit(
  r: River,
  c: RiverCrossing,
  bx: number,
  by: number,
  clearM = 2.5,
): Pt {
  const p = polylineAt(r.points, c.atM);
  let nx = -p.ty;
  let ny = p.tx;
  if ((bx - p.x) * nx + (by - p.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const d = r.widthM / 2 + clearM;
  return { x: p.x + nx * d, y: p.y + ny * d };
}

/**
 * Best crossing to route through from A toward B (shortest detour), or null.
 * Returns the far-bank exit so a hull drives straight over and comes off dry.
 */
export function nearestCrossingPoint(
  rivers: readonly River[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Pt | null {
  let best: Pt | null = null;
  let bestCost = Infinity;
  for (const r of rivers) {
    for (const c of r.crossings) {
      const p = crossingCenter(r, c);
      const cost =
        Math.hypot(p.x - ax, p.y - ay) + Math.hypot(bx - p.x, by - p.y);
      if (cost < bestCost) {
        bestCost = cost;
        best = crossingExit(r, c, bx, by);
      }
    }
  }
  return best;
}

/** Point-in-polyline-band test used by the editor for hit testing. */
export function pointOnRiver(r: River, x: number, y: number, pad = 0): boolean {
  if (r.points.length < 2) return false;
  return nearestOnRiver(r, x, y).dist <= r.widthM / 2 + pad;
}
