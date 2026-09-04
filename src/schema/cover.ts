export const COVER_KINDS = ["bush", "wreck"] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

/**
 * COVER LAW v2 — occupy vegetation to hide from the ring.
 * Wrecks still stop ring, hull, shot, and tracks.
 * Destructible buildings fall from hits, not from a timer.
 * Muzzle flash ignores cover.
 */
export const COVER_LAW = {
  version: 2,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  bushBlocks: ["ring"] as const,
  wreckBlocks: ["ring", "hull", "shot", "motion"] as const,
  occupyHidesRing: true,
  destructibleFromHits: true,
  muzzleIgnoresCover: true,
  concealAlpha: 0.38,
  concealFadeS: 0.28,
  deferred: ["Elevation", "Smoke"],
} as const;

export type Cover = {
  id: string;
  kind: CoverKind;
  x: number;
  y: number;
  halfW: number;
  halfL: number;
  skin?: string;
  hp?: number;
  hpMax?: number;
  destructible?: boolean;
};

export const RANGE_COVER: Cover[] = [
  { id: "bush-w", kind: "bush", x: -8.5, y: 0, halfW: 2.4, halfL: 2.2 },
  { id: "bush-e", kind: "bush", x: 9, y: 4, halfW: 2.2, halfL: 2.4 },
  { id: "bush-s", kind: "bush", x: 6, y: -9, halfW: 2, halfL: 1.8 },
  { id: "wreck-nw", kind: "wreck", x: -14, y: 11, halfW: 1.5, halfL: 3.1 },
  { id: "wreck-se", kind: "wreck", x: 14, y: -11, halfW: 1.5, halfL: 3.1 },
];

export function coverBounds(c: Cover) {
  return {
    minX: c.x - c.halfW,
    maxX: c.x + c.halfW,
    minY: c.y - c.halfL,
    maxY: c.y + c.halfL,
  };
}

export function pointInCover(c: Cover, x: number, y: number, pad = 0): boolean {
  const b = coverBounds(c);
  return x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad;
}

/** Liang–Barsky. True if the open segment crosses the AABB. */
export function segmentHitsAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, ax - minX)) return false;
  if (!clip(dx, maxX - ax)) return false;
  if (!clip(-dy, ay - minY)) return false;
  if (!clip(dy, maxY - ay)) return false;
  return t1 >= t0 && t1 > 0.03 && t0 < 0.97;
}

export function segmentHitsCover(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  c: Cover,
): boolean {
  if (pointInCover(c, ax, ay)) return false;
  const b = coverBounds(c);
  return segmentHitsAabb(ax, ay, bx, by, b.minX, b.minY, b.maxX, b.maxY);
}

export function occludesChannel(
  kind: CoverKind,
  channel: "ring" | "hull" | "shot" | "motion",
): boolean {
  if (kind === "bush") return channel === "ring";
  return true;
}

export function firstCoverHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cover: readonly Cover[],
  channel: "ring" | "hull" | "shot",
): Cover | null {
  let best: Cover | null = null;
  let bestT = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  for (const c of cover) {
    if (!occludesChannel(c.kind, channel)) continue;
    if (channel === "shot" && pointInCover(c, ax, ay, 0.05)) return c;
    if (!segmentHitsCover(ax, ay, bx, by, c)) continue;
    const t = Math.hypot(c.x - ax, c.y - ay) / len;
    if (t < bestT) {
      bestT = t;
      best = c;
    }
  }
  return best;
}

export function pushOutWrecks(
  pos: { x: number; y: number },
  cover: readonly Cover[],
  radius = 1.6,
): void {
  for (const c of cover) {
    if (c.kind !== "wreck") continue;
    if (!pointInCover(c, pos.x, pos.y, radius)) continue;
    const b = coverBounds(c);
    const left = pos.x - (b.minX - radius);
    const right = b.maxX + radius - pos.x;
    const down = pos.y - (b.minY - radius);
    const up = b.maxY + radius - pos.y;
    const m = Math.min(left, right, down, up);
    if (m === left) pos.x = b.minX - radius;
    else if (m === right) pos.x = b.maxX + radius;
    else if (m === down) pos.y = b.minY - radius;
    else pos.y = b.maxY + radius;
  }
}

export function occupyBush(
  x: number,
  y: number,
  cover: readonly Cover[],
): Cover | null {
  for (const c of cover) {
    if (c.kind !== "bush") continue;
    if (pointInCover(c, x, y)) return c;
  }
  return null;
}

export function stepConceal(current: number, hidden: boolean, dt: number): number {
  const want = hidden ? 1 : 0;
  const k = 1 - Math.exp(-dt / COVER_LAW.concealFadeS);
  return current + (want - current) * k;
}

export function concealDrawAlpha(conceal: number): number {
  return 1 - conceal * (1 - COVER_LAW.concealAlpha);
}

export function hitDestructible(
  cover: Cover[],
  x: number,
  y: number,
  damage: number,
): Cover | null {
  for (const c of cover) {
    if (!c.destructible || c.kind !== "wreck") continue;
    if (!pointInCover(c, x, y, 0.6)) continue;
    const max = c.hpMax ?? c.hp ?? 0;
    c.hp = Math.max(0, (c.hp ?? max) - damage);
    if (c.hp <= 0) {
      c.kind = "bush";
      c.destructible = false;
      c.hp = 0;
    }
    return c;
  }
  return null;
}
