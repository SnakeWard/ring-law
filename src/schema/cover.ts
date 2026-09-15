export const COVER_KINDS = ["bush", "wreck"] as const;
export type CoverKind = (typeof COVER_KINDS)[number];
export const COVER_CHANNELS = ["ring", "hull", "shot", "motion"] as const;
export type CoverChannel = (typeof COVER_CHANNELS)[number];

/**
 * Per-piece collision rules. Every cover resolves to one of these.
 * `kind` picks the default profile; `rules` on a piece overrides fields.
 * Invariant: anything that stops a shot also stops a hull — a passable
 * shot-blocker would be an invulnerability pocket.
 */
export type CoverRules = {
  /** Hull cannot drive through. */
  motion: boolean;
  /** Tracers and HE stop on it. */
  shot: boolean;
  /** Breaks main-ring line of sight. */
  ring: boolean;
  /** Breaks hull (short, all-round) line of sight. */
  hull: boolean;
  /** A hull sitting inside it fades to camo. */
  conceal: boolean;
};

export const RULES_BY_KIND: Record<CoverKind, CoverRules> = {
  bush: { motion: false, shot: false, ring: true, hull: false, conceal: true },
  wreck: { motion: true, shot: true, ring: true, hull: true, conceal: false },
};

/**
 * COVER LAW v4 — occupy vegetation to hide from the ring.
 * Wrecks still stop ring, hull, shot, and tracks.
 * v3 added per-piece rule overrides (a log stops tracks and shells but not
 * the ring; a tank trap stops tracks only; a crater stops nothing).
 * v4 orients footprints: yawDeg rotates the box in the hull basis (yaw 0
 * faces +Y). Collision is an OBB; yaw 0 is the old AABB bit-for-bit.
 * Destructible buildings fall from hits, not from a timer.
 * Muzzle flash ignores cover.
 */
export const COVER_LAW = {
  version: 4,
  frozenAt: "2026-09-14",
  evidence: "assumed" as const,
  bushBlocks: ["ring"] as const,
  wreckBlocks: ["ring", "hull", "shot", "motion"] as const,
  shotImpliesMotion: true,
  occupyHidesRing: true,
  destructibleFromHits: true,
  muzzleIgnoresCover: true,
  concealAlpha: 0.38,
  concealFadeS: 0.28,
  oriented: true,
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
  /** Overrides the kind default. Missing fields fall back to the kind. */
  rules?: Partial<CoverRules>;
  /** Editor label (asset name). Not used by the sim. */
  label?: string;
  /** Degrees. 0 faces +Y (north). +yaw is CCW. Missing = unrotated AABB. */
  yawDeg?: number;
  /** Hull wrecks yield to a shove. Authored map wrecks stay planted. */
  pushable?: boolean;
  /** Catalog hull this wreck was. Renderer draws the plate, not the generic wreck skin. */
  hullId?: string;
  /** Live HullInstance.id this wreck was laid from. */
  sourceId?: string;
  /** Rings that left the hull on death. */
  tossedTurretIds?: string[];
};

export type CoverPose = {
  x: number;
  y: number;
  yawDeg?: number;
};

export type CoverFootprint = CoverPose & {
  halfW: number;
  halfL: number;
};

export function coverYaw(c: CoverPose): number {
  return c.yawDeg ?? 0;
}

/** World → local. Local +X is right, local +Y is forward (hull basis). */
export function toCoverLocal(c: CoverPose, x: number, y: number): { lx: number; ly: number } {
  const dx = x - c.x;
  const dy = y - c.y;
  const r = (coverYaw(c) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { lx: dx * cos + dy * sin, ly: -dx * sin + dy * cos };
}

/** Local → world. */
export function fromCoverLocal(c: CoverPose, lx: number, ly: number): { x: number; y: number } {
  const r = (coverYaw(c) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos };
}

export function normalizeRules(r: CoverRules): CoverRules {
  if (r.shot && !r.motion) return { ...r, motion: true };
  return r;
}

export function coverRules(c: Pick<Cover, "kind" | "rules">): CoverRules {
  const base = RULES_BY_KIND[c.kind];
  if (!c.rules) return base;
  return normalizeRules({ ...base, ...c.rules });
}

export function coverOccludes(c: Pick<Cover, "kind" | "rules">, channel: CoverChannel): boolean {
  return coverRules(c)[channel];
}

export function describeRules(r: CoverRules): string[] {
  const out: string[] = [];
  if (r.motion) out.push("stops tracks");
  if (r.shot) out.push("stops shells");
  if (r.ring) out.push("blocks ring");
  if (r.hull) out.push("blocks hull");
  if (r.conceal) out.push("hides occupant");
  if (!out.length) out.push("decoration");
  return out;
}

export const RANGE_COVER: Cover[] = [
  { id: "bush-w", kind: "bush", x: -8.5, y: 0, halfW: 2.4, halfL: 2.2 },
  { id: "bush-e", kind: "bush", x: 9, y: 4, halfW: 2.2, halfL: 2.4 },
  { id: "bush-s", kind: "bush", x: 6, y: -9, halfW: 2, halfL: 1.8 },
  { id: "wreck-nw", kind: "wreck", x: -14, y: 11, halfW: 1.5, halfL: 3.1 },
  { id: "wreck-se", kind: "wreck", x: 14, y: -11, halfW: 1.5, halfL: 3.1 },
];

/** Axis-aligned bounds of the (possibly rotated) footprint. */
export function coverBounds(c: CoverFootprint) {
  if (!coverYaw(c)) {
    return {
      minX: c.x - c.halfW,
      maxX: c.x + c.halfW,
      minY: c.y - c.halfL,
      maxY: c.y + c.halfL,
    };
  }
  const corners = [
    fromCoverLocal(c, -c.halfW, -c.halfL),
    fromCoverLocal(c, c.halfW, -c.halfL),
    fromCoverLocal(c, c.halfW, c.halfL),
    fromCoverLocal(c, -c.halfW, c.halfL),
  ];
  let minX = corners[0].x;
  let maxX = corners[0].x;
  let minY = corners[0].y;
  let maxY = corners[0].y;
  for (let i = 1; i < 4; i++) {
    const p = corners[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

export function pointInCover(c: CoverFootprint, x: number, y: number, pad = 0): boolean {
  const { lx, ly } = toCoverLocal(c, x, y);
  return Math.abs(lx) <= c.halfW + pad && Math.abs(ly) <= c.halfL + pad;
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
  c: CoverFootprint,
): boolean {
  if (pointInCover(c, ax, ay)) return false;
  const a = toCoverLocal(c, ax, ay);
  const b = toCoverLocal(c, bx, by);
  return segmentHitsAabb(a.lx, a.ly, b.lx, b.ly, -c.halfW, -c.halfL, c.halfW, c.halfL);
}

export function occludesChannel(kind: CoverKind, channel: CoverChannel): boolean {
  return RULES_BY_KIND[kind][channel];
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
    if (!coverOccludes(c, channel)) continue;
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
    if (!coverOccludes(c, "motion")) continue;
    if (c.pushable) continue;
    if (!pointInCover(c, pos.x, pos.y, radius)) continue;
    const loc = toCoverLocal(c, pos.x, pos.y);
    const left = loc.lx + c.halfW + radius;
    const right = c.halfW + radius - loc.lx;
    const down = loc.ly + c.halfL + radius;
    const up = c.halfL + radius - loc.ly;
    const m = Math.min(left, right, down, up);
    let nlx = loc.lx;
    let nly = loc.ly;
    if (m === left) nlx = -(c.halfW + radius);
    else if (m === right) nlx = c.halfW + radius;
    else if (m === down) nly = -(c.halfL + radius);
    else nly = c.halfL + radius;
    const w = fromCoverLocal(c, nlx, nly);
    pos.x = w.x;
    pos.y = w.y;
  }
}

export function occupyBush(
  x: number,
  y: number,
  cover: readonly Cover[],
): Cover | null {
  for (const c of cover) {
    if (!coverRules(c).conceal) continue;
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
    if (!c.destructible || !coverOccludes(c, "shot")) continue;
    if (!pointInCover(c, x, y, 0.6)) continue;
    const max = c.hpMax ?? c.hp ?? 0;
    c.hp = Math.max(0, (c.hp ?? max) - damage);
    if (c.hp <= 0) {
      c.kind = "bush";
      c.destructible = false;
      c.hp = 0;
      delete c.rules;
    }
    return c;
  }
  return null;
}
