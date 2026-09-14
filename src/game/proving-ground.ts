import { forward, clamp, stepDeg, worldAngleTo } from "./math.ts";

// Shared simulation/render authority. Metres; +Y north. Renderer maps (x,y) to (x,0,-y).
export type Point = { x: number; y: number };
export type AssetKind = "tree" | "building" | "fence" | "rock";
export type MapAsset = Point & {
  id: string;
  kind: AssetKind;
  variant: number;
  halfW: number;
  halfL: number;
  hp: number;
  maxHp: number;
  fallYaw: number;
  fallenAt: number;
};
export type SurfacePatch = Point & { rx: number; ry: number; kind: "mud" | "rubble" };
export type Route = { name: string; width: number; points: Point[] };
export type GroundLayout = {
  id: "crossroads" | "offset";
  name: string;
  halfSize: number;
  assets: MapAsset[];
  surfaces: SurfacePatch[];
  routes: Route[];
  starts: (Point & { name: string; yaw: number })[];
  checkpoints: (Point & { name: string })[];
};
export const KIT = {
  tree: { hp: 40, halfW: 0.5, halfL: 0.5 },
  building: { hp: 120, halfW: 4, halfL: 5 },
  fence: { hp: 40, halfW: 3, halfL: 0.25 },
  rock: { hp: Infinity, halfW: 2.4, halfL: 2.2 },
} as const;
export const VEHICLE_RADIUS = 1.7;
export function makeLayout(id: GroundLayout["id"] = "crossroads"): GroundLayout {
  const shift = id === "offset" ? 10 : 0;
  const assets: MapAsset[] = [];
  const add = (kind: AssetKind, x: number, y: number, variant = 0, hw?: number, hl?: number) => {
    const kit = KIT[kind];
    assets.push({
      id: `${kind}-${assets.length}`,
      kind,
      x,
      y,
      variant,
      halfW: hw ?? kit.halfW,
      halfL: hl ?? kit.halfL,
      hp: kit.hp,
      maxHp: kit.hp,
      fallYaw: 0,
      fallenAt: -1,
    });
  };
  [
    [-12, -20],
    [12, -17],
    [-13, 4],
    [13, 9],
    [-10, 27],
    [15, 31],
  ].forEach(([x, y], i) => add("building", x + shift, y, i % 3, 3.6 + (i % 2), 4.4 + (i % 3)));
  add("fence", shift, 8, 0, 4.8, 0.25);
  add("fence", 20 + shift, -7, 1, 3, 0.25);
  [
    [-46, -9],
    [-25, 18],
    [-48, 32],
  ].forEach(([x, y], i) => add("rock", x, y, i));
  // Irregular groves, with an authored 10m corridor through their centres.
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 4; col++) {
      const x = 24 + col * 9 + Math.sin(row * 3.1 + col) * 2;
      const y = -32 + row * 8 + Math.cos(col * 2.4 + row) * 2;
      if (Math.abs(x - 39) < 5 || Math.abs(y + 8) < 4 || Math.abs(y - 20) < 4) continue;
      add("tree", x, y, (row + col) % 3);
    }
  // A deliberate ram specimen beside the grove entry, reachable from the quick start.
  add("tree", 39, -27, 2);
  [
    [-29, -36],
    [-49, 45],
    [-20, 42],
    [-53, -29],
    [-30, 35],
  ].forEach(([x, y], i) => add("tree", x, y, i % 3));
  const p = (x: number, y: number): Point => ({ x, y });
  const routes: Route[] = [
    {
      name: "Open flank",
      width: 10,
      points: [p(0, -49), p(-35, -35), p(-38, 4), p(-34, 37), p(0, 49)],
    },
    {
      name: "Village street",
      width: 10,
      points: [p(0, -49), p(shift, -32), p(shift, 0), p(shift, 37), p(0, 49)],
    },
    { name: "Woodland flank", width: 9, points: [p(0, -49), p(39, -38), p(39, 30), p(0, 49)] },
    { name: "South crossing", width: 7, points: [p(-37, -8), p(shift, -8), p(39, -8)] },
    { name: "North crossing", width: 7, points: [p(-36, 20), p(shift, 20), p(39, 20)] },
  ];
  return {
    id,
    name: id === "offset" ? "Offset village" : "Three-way crossing",
    halfSize: 60,
    assets,
    routes,
    surfaces: [
      { x: -35, y: 4, rx: 9, ry: 13, kind: "mud" },
      { x: 39, y: 13, rx: 6, ry: 7, kind: "mud" },
    ],
    starts: [
      { name: "South staging", x: 0, y: -49, yaw: 0 },
      { name: "Open flank", x: -35, y: -30, yaw: 0 },
      { name: "Village breach", x: shift, y: -4, yaw: 0 },
      { name: "Tree trial", x: 39, y: -36, yaw: 0 },
    ],
    checkpoints: [
      { name: "Open flank", x: -36, y: 24 },
      { name: "Village", x: shift, y: 26 },
      { name: "Woodland", x: 39, y: 29 },
    ],
  };
}
export type GroundState = {
  layout: GroundLayout;
  player: Point & { yaw: number; turret: number };
  speed: number;
  time: number;
  reload: number;
  shots: { a: Point; b: Point; ttl: number }[];
  visited: string[];
  message: string;
  target: Point;
  distance: number;
  surface: string;
  screened: boolean;
};
export function createGround(id: GroundLayout["id"] = "crossroads", start = 0): GroundState {
  const layout = makeLayout(id),
    s = layout.starts[start] ?? layout.starts[0];
  return {
    layout,
    player: { x: s.x, y: s.y, yaw: s.yaw, turret: s.yaw },
    speed: 0,
    time: 0,
    reload: 0,
    shots: [],
    visited: [],
    message: "Explore the three approaches. Ram trees; fire to breach structures.",
    target: { x: s.x, y: s.y + 25 },
    distance: 0,
    surface: "Firm ground",
    screened: false,
  };
}
export function isSolid(a: MapAsset) {
  return a.hp > 0;
}
export function overlaps(a: MapAsset, p: Point, padding = 0) {
  return Math.abs(a.x - p.x) < a.halfW + padding && Math.abs(a.y - p.y) < a.halfL + padding;
}
// Exact segment entry distance: nearest blocking face wins, not nearest object centre.
export function segmentEntry(a: Point, b: Point, c: Point, hw: number, hl: number): number | null {
  let lo = 0,
    hi = 1;
  for (const [origin, delta, min, max] of [
    [a.x, b.x - a.x, c.x - hw, c.x + hw],
    [a.y, b.y - a.y, c.y - hl, c.y + hl],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return null;
    } else {
      let t0 = (min - origin) / delta,
        t1 = (max - origin) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return null;
    }
  }
  return lo;
}
export function fallenCanopy(a: MapAsset): Point {
  const f = forward(a.fallYaw);
  return { x: a.x + f.x * 4, y: a.y + f.y * 4 };
}
export function screenedFrom(s: GroundState, observer: Point): boolean {
  return s.layout.assets.some((a) => {
    if (a.kind === "building" || a.kind === "rock")
      return isSolid(a) && segmentEntry(s.player, observer, a, a.halfW, a.halfL) !== null;
    if (a.kind !== "tree") return false;
    const c = a.hp > 0 ? a : fallenCanopy(a);
    return segmentEntry(s.player, observer, c, 2.7, 2.7) !== null;
  });
}
export function surfaceAt(s: GroundState, p: Point): { name: string; factor: number } {
  for (const a of s.layout.assets)
    if (a.kind === "building" && a.hp <= 0 && overlaps(a, p))
      return { name: "Rubble", factor: 0.6 };
  for (const a of s.layout.assets)
    if (a.kind === "tree" && a.hp <= 0) {
      const c = fallenCanopy(a);
      if (Math.hypot(p.x - c.x, p.y - c.y) < 3.2) return { name: "Fallen branches", factor: 0.7 };
    }
  for (const patch of s.layout.surfaces)
    if (((p.x - patch.x) / patch.rx) ** 2 + ((p.y - patch.y) / patch.ry) ** 2 < 1)
      return { name: "Mud", factor: 0.45 };
  return { name: "Firm ground", factor: 1 };
}
function damage(s: GroundState, a: MapAsset, amount: number, yaw: number) {
  if (a.kind === "rock") {
    s.message = "Rock stops the shell.";
    return;
  }
  a.hp = Math.max(0, a.hp - amount);
  if (a.hp === 0) {
    a.fallenAt = s.time;
    a.fallYaw = yaw;
    s.message =
      a.kind === "tree"
        ? "Tree down — branches conceal, but do not stop shells."
        : a.kind === "building"
          ? "Building breached — rubble is traversable at reduced speed."
          : "Fence breached — passage open.";
  } else s.message = `${a.kind === "building" ? "Building" : "Tree"} damaged — ${a.hp}/${a.maxHp}`;
}
export function fireGround(s: GroundState) {
  if (s.reload > 0) return;
  const f = forward(s.player.turret),
    a = { x: s.player.x, y: s.player.y };
  const b = { x: a.x + f.x * 95, y: a.y + f.y * 95 };
  let closest = 1,
    hit: MapAsset | undefined;
  for (const c of s.layout.assets)
    if (isSolid(c)) {
      const t = segmentEntry(a, b, c, c.halfW, c.halfL);
      if (t !== null && t < closest) {
        closest = t;
        hit = c;
      }
    }
  const end = { x: a.x + (b.x - a.x) * closest, y: a.y + (b.y - a.y) * closest };
  if (hit) damage(s, hit, 40, s.player.turret);
  else s.message = "Shot clear — no solid cover in the firing line.";
  s.shots.push({ a, b: end, ttl: 0.18 });
  s.reload = 1.1;
}
export type GroundActions = { throttle: number; steer: number; fire: boolean; aim?: Point };
export function stepGround(s: GroundState, input: GroundActions, dtRaw: number) {
  const dt = clamp(dtRaw, 0, 1 / 30);
  s.time += dt;
  s.reload = Math.max(0, s.reload - dt);
  s.shots = s.shots.filter((t) => (t.ttl -= dt) > 0);
  const surface = surfaceAt(s, s.player);
  s.surface = surface.name;
  const want = input.throttle * 9 * surface.factor;
  s.speed += clamp(want - s.speed, -18 * dt, 12 * dt);
  const steerFactor = Math.max(0.45, Math.min(1, Math.abs(s.speed) / 7));
  s.player.yaw += input.steer * 90 * steerFactor * (s.speed >= 0 ? 1 : -1) * dt;
  const f = forward(s.player.yaw),
    old = { x: s.player.x, y: s.player.y };
  const next = {
    x: clamp(old.x + f.x * s.speed * dt, -58, 58),
    y: clamp(old.y + f.y * s.speed * dt, -58, 58),
  };
  let blocked = false;
  for (const a of s.layout.assets)
    if (isSolid(a) && overlaps(a, next, VEHICLE_RADIUS)) {
      if ((a.kind === "tree" || a.kind === "fence") && Math.abs(s.speed) >= 2) {
        damage(s, a, a.hp, s.player.yaw + (s.speed < 0 ? 180 : 0));
        s.speed *= 0.65;
      } else blocked = true;
    }
  if (blocked) s.speed = 0;
  else {
    s.player.x = next.x;
    s.player.y = next.y;
    s.distance += Math.hypot(next.x - old.x, next.y - old.y);
  }
  if (input.aim) s.target = input.aim;
  const desired = input.aim
    ? worldAngleTo(s.player.x, s.player.y, s.target.x, s.target.y)
    : s.player.yaw;
  s.player.turret = stepDeg(s.player.turret, desired, 110 * dt);
  if (input.fire) fireGround(s);
  s.screened = screenedFrom(s, { x: 0, y: 54 });
  for (const c of s.layout.checkpoints)
    if (!s.visited.includes(c.name) && Math.hypot(c.x - s.player.x, c.y - s.player.y) < 5) {
      s.visited.push(c.name);
      s.message =
        s.visited.length === 3
          ? "All approaches visited. Reset or try the alternate layout."
          : `${c.name} reached — ${s.visited.length}/3 approaches visited.`;
    }
}
