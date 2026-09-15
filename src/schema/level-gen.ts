import { BIOMES, type BiomeAsset, type BiomeId } from "./biomes.ts";
import { coverRules } from "./cover.ts";
import {
  LEVEL_LAW,
  newLevel,
  riverGeometry,
  validateLevel,
  type LevelDoc,
  type LevelProp,
  type LevelRiver,
} from "./level.ts";
import { MAP_LAW, type MapSize, type WeatherKind } from "./maps.ts";
import { PRESETS } from "./presets.ts";
import {
  RIVER_LAW,
  nearestOnRiver,
  polylineAt,
  type CrossingKind,
  type Pt,
} from "./river.ts";
import { wrapDeg } from "./rules.ts";

/**
 * YARD GEN v1 — a playable, mirrored scatter from the biome kit.
 *
 * Poisson-ish darts fill one half of the yard; each piece is copied through
 * the origin (x,y,yaw → −x,−y,yaw+180) so both spawns get the same lanes.
 * One noisy east–west river crosses at the origin with a ford or bridge on
 * that centreline. A north–south motion lane is kept clear so the path check
 * stays honest. Callers reroll the seed; the generator retries nearby seeds
 * until validateLevel is clean.
 */
export const YARD_GEN_LAW = {
  version: 1,
  frozenAt: "2026-09-14",
  evidence: "assumed" as const,
  maxAttempts: 12,
  spawnKeepoutM: 10,
  laneHalfM: 3.4,
  crossingKeepoutM: 7,
  targets: { small: 8, medium: 14, large: 22 } as Record<MapSize, number>,
  radiusM: { small: 9, medium: 8, large: 7.2 } as Record<MapSize, number>,
  widthM: { small: 4.5, medium: 6.5, large: 8 } as Record<MapSize, number>,
  skip: ["block", "dune", "bridge"] as const,
  deferred: ["Roads", "Second river", "WFC urban blocks"],
} as const;

export type YardGenInput = {
  biome: BiomeId;
  size: MapSize;
  seed: number;
  id?: string;
  name?: string;
  weather?: WeatherKind;
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function T(n: number, p = 100) {
  return Math.round(n * p) / p;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function tangentYaw(tx: number, ty: number) {
  return (Math.atan2(-tx, ty) * 180) / Math.PI;
}

function maybeYaw(deg: number): number | undefined {
  const w = wrapDeg(deg);
  return w === 0 ? undefined : w;
}

type Role = "conceal" | "hard" | "low" | "trap" | "decor" | "landmark";

function roleOf(a: BiomeAsset): Role | "skip" {
  if ((YARD_GEN_LAW.skip as readonly string[]).includes(a.id)) return "skip";
  const long = Math.max(a.halfW, a.halfL);
  if (long >= 5.2) return "landmark";
  const r = coverRules(a);
  if (r.conceal) return "conceal";
  if (r.motion && r.shot && !r.ring) return "low";
  if (r.motion && r.shot) return "hard";
  if (r.motion) return "trap";
  return "decor";
}

function noisyRiver(rng: () => number, arena: number): Pt[] {
  const overshoot = arena + 8;
  const n = 5;
  const half: Pt[] = [{ x: 0, y: 0 }];
  let y = 0;
  for (let i = 1; i <= n; i++) {
    const x = (i / n) * overshoot;
    y += (rng() - 0.5) * arena * 0.2;
    y *= 0.82;
    y = Math.max(-arena * 0.32, Math.min(arena * 0.32, y));
    half.push({ x: T(x), y: T(y) });
  }
  const left = half
    .slice(1)
    .reverse()
    .map((p) => ({ x: T(-p.x), y: T(-p.y) }));
  return [...left, ...half];
}

function scatter(
  rng: () => number,
  bound: number,
  radius: number,
  limit: number,
  ok: (x: number, y: number) => boolean,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 5000 && out.length < limit; i++) {
    const x = (rng() * 2 - 1) * bound;
    const y = rng() * bound;
    if (y < radius * 0.45) continue;
    if (!ok(x, y)) continue;
    if (Math.hypot(2 * x, 2 * y) < radius) continue;
    let good = true;
    for (const p of out) {
      if (Math.hypot(x - p.x, y - p.y) < radius) {
        good = false;
        break;
      }
      if (Math.hypot(x + p.x, y + p.y) < radius) {
        good = false;
        break;
      }
    }
    if (!good) continue;
    out.push({ x: T(x), y: T(y) });
  }
  return out;
}

function yawFor(
  a: BiomeAsset,
  x: number,
  y: number,
  river: LevelRiver,
  rng: () => number,
): number | undefined {
  const geo = riverGeometry(river);
  const near = nearestOnRiver(geo, x, y);
  const at = polylineAt(geo.points, near.s);
  const follow = tangentYaw(at.tx, at.ty);
  const longY = a.halfL >= a.halfW * 1.35;
  const longX = a.halfW >= a.halfL * 1.35;
  let yaw = 0;
  if (near.dist < 14 && (longX || longY)) {
    yaw = longY ? follow : follow + 90;
  } else if (longX || longY) {
    yaw = pick(rng, [0, 90, -90, 45, -45]);
  } else if (rng() < 0.35) {
    yaw = pick(rng, [0, 15, -15, 30, -30]);
  }
  return maybeYaw(yaw);
}

function generatedName(biome: BiomeId, seed: number) {
  return `${BIOMES[biome].name} ${seed.toString(36)}`.slice(
    0,
    LEVEL_LAW.maxNameLen,
  );
}

function shouldReplaceName(
  current: string | undefined,
  biome: BiomeId,
  size: MapSize,
): boolean {
  if (!current) return true;
  const n = BIOMES[biome].name;
  if (current === `${n} ${size}` || current === n) return true;
  if (PRESETS.some((p) => p.name === current)) return true;
  return new RegExp(`^${n} [a-z0-9]+$`, "i").test(current);
}

function buildOnce(input: YardGenInput, seed: number): LevelDoc {
  const rng = mulberry(seed);
  const biome = input.biome;
  const size = input.size;
  const spec = MAP_LAW.sizes[size];
  const arena = spec.arenaM;
  const bound = arena - 3;
  const kit = BIOMES[biome];
  const widthM = Math.max(
    RIVER_LAW.minWidthM,
    Math.min(RIVER_LAW.maxWidthM, YARD_GEN_LAW.widthM[size]),
  );
  const river: LevelRiver = {
    id: "river-0",
    points: noisyRiver(rng, arena),
    widthM,
    crossings: [],
  };
  const geo = riverGeometry(river);
  const hit = nearestOnRiver(geo, 0, 0);
  const urban = biome === "urban";
  const kind: CrossingKind =
    rng() < (urban ? 0.75 : 0.45) ? "bridge" : "ford";
  const lengthM = Math.max(
    RIVER_LAW.minCrossingM,
    Math.min(RIVER_LAW.maxCrossingM, T(widthM + 2.5, 10)),
  );
  river.crossings = [
    { id: "x-0", kind, atM: T(hit.s, 10), lengthM },
  ];
  const cross = polylineAt(geo.points, river.crossings[0].atM);

  const byRole: Record<Role, BiomeAsset[]> = {
    conceal: [],
    hard: [],
    low: [],
    trap: [],
    decor: [],
    landmark: [],
  };
  for (const a of kit.assets) {
    const role = roleOf(a);
    if (role === "skip") continue;
    byRole[role].push(a);
  }
  const bag: BiomeAsset[] = [];
  const pushN = (list: BiomeAsset[], n: number) => {
    if (!list.length) return;
    for (let i = 0; i < n; i++) bag.push(pick(rng, list));
  };
  pushN(byRole.conceal, 5);
  pushN(byRole.hard, 4);
  pushN(byRole.low, 3);
  pushN(byRole.trap, 1);
  pushN(byRole.decor, 1);
  if (!bag.length) bag.push(...kit.assets.filter((a) => roleOf(a) !== "skip"));

  const reachOf = (a: BiomeAsset) => Math.max(a.halfW, a.halfL);
  const motionOf = (a: BiomeAsset) => coverRules(a).motion;

  function fits(x: number, y: number, reach: number, motion: boolean): boolean {
    if (Math.abs(x) + reach > bound || Math.abs(y) + reach > bound) return false;
    if (Math.hypot(x, y - spec.spawnY) < YARD_GEN_LAW.spawnKeepoutM + reach)
      return false;
    if (Math.hypot(x, y + spec.spawnY) < YARD_GEN_LAW.spawnKeepoutM + reach)
      return false;
    if (
      Math.hypot(x - cross.x, y - cross.y) <
      YARD_GEN_LAW.crossingKeepoutM + reach
    )
      return false;
    const n = nearestOnRiver(geo, x, y);
    const bank = motion ? widthM / 2 + reach + 1.3 : widthM / 2 + 0.5;
    if (n.dist < bank) return false;
    if (motion && Math.abs(x) < YARD_GEN_LAW.laneHalfM + reach) return false;
    return true;
  }

  const points = scatter(
    rng,
    bound,
    YARD_GEN_LAW.radiusM[size],
    YARD_GEN_LAW.targets[size],
    (x, y) => fits(x, y, 2.2, true),
  );

  const unique: LevelProp[] = [];
  let landmarks = 0;
  const landmarkCap = size === "small" ? 0 : 1;
  for (const p of points) {
    let asset: BiomeAsset | undefined;
    if (
      landmarks < landmarkCap &&
      byRole.landmark.length &&
      rng() < 0.35
    ) {
      const cand = pick(rng, byRole.landmark);
      if (fits(p.x, p.y, reachOf(cand), motionOf(cand))) {
        asset = cand;
        landmarks++;
      }
    }
    if (!asset) {
      for (let t = 0; t < 8 && !asset; t++) {
        const cand = pick(rng, bag);
        if (fits(p.x, p.y, reachOf(cand), motionOf(cand))) asset = cand;
      }
    }
    if (!asset) continue;
    const variant = Math.floor(rng() * Math.max(1, asset.variants));
    unique.push({
      id: `${asset.id}-${unique.length}`,
      asset: asset.id,
      x: p.x,
      y: p.y,
      halfW: asset.halfW,
      halfL: asset.halfL,
      variant,
      yawDeg: yawFor(asset, p.x, p.y, river, rng),
    });
  }

  const props: LevelProp[] = [];
  for (const p of unique) {
    props.push({ ...p, id: `${p.asset}-${props.length}` });
    props.push({
      ...p,
      id: `${p.asset}-${props.length}`,
      x: T(-p.x),
      y: T(-p.y),
      yawDeg: maybeYaw(wrapDeg((p.yawDeg ?? 0) + 180)),
      variant:
        (p.variant + 1) %
        Math.max(1, biomeAssetSafe(biome, p.asset)?.variants ?? 1),
    });
  }

  const name = shouldReplaceName(input.name, biome, size)
    ? generatedName(biome, seed)
    : (input.name as string);
  const doc = newLevel(biome, size, name);
  if (input.id) doc.id = input.id;
  if (input.weather) doc.weather = input.weather;
  doc.rivers = [river];
  doc.props = props;
  doc.updatedAt = Date.now();
  return doc;
}

function biomeAssetSafe(biome: BiomeId, id: string): BiomeAsset | undefined {
  return BIOMES[biome].assets.find((a) => a.id === id);
}

/** One playable (or last-attempt) yard. Same seed → same props/river. */
export function generateYard(input: YardGenInput): LevelDoc {
  const base = input.seed >>> 0;
  let last = buildOnce(input, base);
  if (!validateLevel(last).some((i) => i.level === "error")) return last;
  for (let k = 1; k < YARD_GEN_LAW.maxAttempts; k++) {
    const next = buildOnce(input, (base + k * 17) >>> 0);
    last = next;
    if (!validateLevel(next).some((i) => i.level === "error")) return next;
  }
  return last;
}
