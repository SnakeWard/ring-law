import { coverBounds, coverOccludes, pointInCover, type Cover } from "./cover.ts";
import { inUncrossableWater, riverSpeedMul, type River } from "./river.ts";

/**
 * NAV LAW v1 — bots drive grid paths around anything that stops tracks.
 * Same passability as the editor's playability check (cover that blocks
 * "motion", uncrossable water), rebuilt when hard cover changes. Fords cost
 * more than dry ground; bridges cost the same.
 */
export const NAV_LAW = {
  version: 1,
  frozenAt: "2026-09-22",
  evidence: "assumed" as const,
  cellM: 1,
  /** Hull clearance. Matches LEVEL_LAW.hullRadiusM. */
  hullRadiusM: 1.7,
  /** A bot re-plans at least this often, or when its goal moves this far. */
  replanS: 0.6,
  replanGoalM: 2.5,
  /** Waypoint counts as reached inside this radius. */
  reachM: 1.6,
  /** No progress for this long while driving = stuck. */
  stuckS: 1.2,
  stuckMoveM: 0.5,
  /** Back off this long when stuck. */
  unstickS: 0.7,
  /** Search budget (cells expanded) so a huge yard never stalls a frame. */
  maxExpand: 80_000,
} as const;

export type NavPt = { x: number; y: number };

export type NavField = {
  cellM: number;
  n: number;
  originM: number;
  /** 1 = a hull cannot stand here. */
  blocked: Uint8Array;
  /** Step cost multiplier (1 dry / bridge, higher in fords). */
  cost: Float32Array;
  /** Fingerprint of the hard cover the field was built from. */
  key: string;
};

/** Cover that stops tracks and is not a shoveable hull wreck. */
function isHard(c: Cover): boolean {
  return !c.pushable && coverOccludes(c, "motion");
}

/** Cheap fingerprint: changes when hard cover appears, moves or falls. */
export function navKey(cover: readonly Cover[]): string {
  let n = 0;
  let h = 0;
  for (const c of cover) {
    if (!isHard(c)) continue;
    n++;
    h = (h * 31 + Math.round(c.x * 4) * 7 + Math.round(c.y * 4) * 13 + Math.round(c.halfW * 8)) | 0;
  }
  return `${n}:${h}`;
}

/** Water layer only; rivers never change during a match, so this is cached. */
export function buildWaterField(rivers: readonly River[], arenaM: number, cellM: number = NAV_LAW.cellM) {
  const bound = arenaM - 2;
  const n = Math.max(1, Math.ceil((bound * 2) / cellM));
  const originM = -bound;
  const blocked = new Uint8Array(n * n);
  const cost = new Float32Array(n * n).fill(1);
  if (rivers.length) {
    const r = NAV_LAW.hullRadiusM;
    for (let j = 0; j < n; j++) {
      const y = originM + (j + 0.5) * cellM;
      for (let i = 0; i < n; i++) {
        const x = originM + (i + 0.5) * cellM;
        const k = j * n + i;
        if (inUncrossableWater(rivers, x, y, r)) blocked[k] = 1;
        else {
          const mul = riverSpeedMul(rivers, x, y);
          if (mul < 1) cost[k] = 1 / mul;
        }
      }
    }
  }
  return { cellM, n, originM, blocked, cost };
}

/** Full field: water layer plus hard cover rasterised over each footprint. */
export function buildNavField(
  cover: readonly Cover[],
  water: Pick<NavField, "cellM" | "n" | "originM" | "blocked" | "cost">,
): NavField {
  const { cellM, n, originM } = water;
  const blocked = water.blocked.slice();
  const r = NAV_LAW.hullRadiusM;
  for (const c of cover) {
    if (!isHard(c)) continue;
    const b = coverBounds(c);
    const i0 = Math.max(0, Math.floor((b.minX - r - originM) / cellM));
    const i1 = Math.min(n - 1, Math.floor((b.maxX + r - originM) / cellM));
    const j0 = Math.max(0, Math.floor((b.minY - r - originM) / cellM));
    const j1 = Math.min(n - 1, Math.floor((b.maxY + r - originM) / cellM));
    for (let j = j0; j <= j1; j++) {
      const y = originM + (j + 0.5) * cellM;
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        if (blocked[k]) continue;
        if (pointInCover(c, originM + (i + 0.5) * cellM, y, r)) blocked[k] = 1;
      }
    }
  }
  return { cellM, n, originM, blocked, cost: water.cost, key: navKey(cover) };
}

function cellOf(f: NavField, x: number, y: number) {
  const i = Math.max(0, Math.min(f.n - 1, Math.floor((x - f.originM) / f.cellM)));
  const j = Math.max(0, Math.min(f.n - 1, Math.floor((y - f.originM) / f.cellM)));
  return j * f.n + i;
}

function centre(f: NavField, k: number): NavPt {
  const i = k % f.n;
  const j = (k - i) / f.n;
  return { x: f.originM + (i + 0.5) * f.cellM, y: f.originM + (j + 0.5) * f.cellM };
}

/** Nearest open cell to k (ring search), or -1. */
function nearestOpen(f: NavField, k: number, maxRing = 12): number {
  if (!f.blocked[k]) return k;
  const i0 = k % f.n;
  const j0 = (k - i0) / f.n;
  for (let ring = 1; ring <= maxRing; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = i0 + di;
        const j = j0 + dj;
        if (i < 0 || j < 0 || i >= f.n || j >= f.n) continue;
        const kk = j * f.n + i;
        if (f.blocked[kk]) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = kk;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** True when a hull-wide straight run between two points stays on open cells. */
export function navClear(f: NavField, a: NavPt, b: NavPt): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / (f.cellM * 0.5)));
  const skip = len > 0 ? f.cellM / len : 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    // The hull may sit on the padded edge of cover; ignore its own cell.
    if (t < skip) continue;
    const k = cellOf(f, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    if (f.blocked[k]) return false;
    if (f.cost[k] > 1.01) return false; // keep fords as explicit legs
  }
  return true;
}

/** Binary min-heap on (cell, f-score). */
class Heap {
  k: number[] = [];
  f: number[] = [];
  get size() {
    return this.k.length;
  }
  push(k: number, f: number) {
    this.k.push(k);
    this.f.push(f);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.k[0];
    const lastK = this.k.pop()!;
    const lastF = this.f.pop()!;
    if (this.k.length) {
      this.k[0] = lastK;
      this.f[0] = lastF;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && this.f[l] < this.f[m]) m = l;
        if (r < this.k.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
  }
}

const DIRS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * A* from `from` to `to` over the field (8-way, no corner cutting), then
 * string-pulled into as few straight legs as possible. Returns waypoints
 * after the start (last one is the goal), or null when no route exists.
 * A blocked goal snaps to the nearest open cell.
 */
export function findNavPath(f: NavField, from: NavPt, to: NavPt): NavPt[] | null {
  const start = nearestOpen(f, cellOf(f, from.x, from.y));
  const goal = nearestOpen(f, cellOf(f, to.x, to.y));
  if (start < 0 || goal < 0) return null;
  const goalPt = f.blocked[cellOf(f, to.x, to.y)] ? centre(f, goal) : { x: to.x, y: to.y };
  if (start === goal) return [goalPt];
  const n = f.n;
  const g = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const gi = goal % n;
  const gj = (goal - gi) / n;
  const h = (k: number) => {
    const i = k % n;
    const j = (k - i) / n;
    const dx = Math.abs(i - gi);
    const dy = Math.abs(j - gj);
    return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * f.cellM;
  };
  const open = new Heap();
  g[start] = 0;
  open.push(start, h(start));
  let expanded = 0;
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    if (cur === goal) {
      found = true;
      break;
    }
    closed[cur] = 1;
    if (++expanded > NAV_LAW.maxExpand) break;
    const ci = cur % n;
    const cj = (cur - ci) / n;
    for (const [di, dj, step] of DIRS) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const k = j * n + i;
      if (f.blocked[k] || closed[k]) continue;
      // No squeezing diagonally between two blocked cells.
      if (di && dj && (f.blocked[cj * n + i] || f.blocked[j * n + ci])) continue;
      const cand = g[cur] + step * f.cellM * f.cost[k];
      if (cand < g[k]) {
        g[k] = cand;
        came[k] = cur;
        open.push(k, cand + h(k));
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let k = goal; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const raw = cells.map((k) => centre(f, k));
  raw[raw.length - 1] = goalPt;
  // String-pull: from each anchor, jump to the furthest point still in clear sight.
  const out: NavPt[] = [];
  let anchor: NavPt = { x: from.x, y: from.y };
  let idx = 0;
  while (idx < raw.length - 1) {
    let next = idx + 1;
    for (let t = raw.length - 1; t > idx; t--) {
      if (navClear(f, anchor, raw[t])) {
        next = t;
        break;
      }
    }
    out.push(raw[next]);
    anchor = raw[next];
    idx = next;
  }
  if (!out.length) out.push(goalPt);
  return out;
}
