import { z } from "zod";
import {
  BIOMES,
  BIOME_IDS,
  biomeAsset,
  skinWithVariant,
  type BiomeId,
} from "./biomes.ts";
import {
  coverOccludes,
  firstCoverHit,
  pointInCover,
  type Cover,
} from "./cover.ts";
import { LOS_LAW } from "./los.ts";
import {
  MAP_LAW,
  MAP_SIZES,
  WEATHER_KINDS,
  registerCustomMap,
  unregisterCustomMap,
  clearCustomMaps,
  type MapBlueprint,
  type MapSize,
  type Road,
  type Spawn,
} from "./maps.ts";
import {
  CROSSING_KINDS,
  RIVER_LAW,
  inUncrossableWater,
  riverLengthM,
  smoothPolyline,
  type River,
} from "./river.ts";
import { loadGarage, saveGarage } from "./xp.ts";

/**
 * LEVEL LAW v1 — a level is a document, not a scatter.
 *
 * The editor writes LevelDoc. compileLevel turns it into the same
 * MapBlueprint the baked theaters use, so the sim never learns about the
 * editor. validateLevel is the usability gate: a map ships only when both
 * spawns are inside the yard, neither sits in a wall or in water, and a
 * hull-sized path exists from one to the other across fords and bridges.
 */
export const LEVEL_LAW = {
  version: 2,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  docVersion: 1 as const,
  storageKey: "ring-levels-v1",
  /** Nav grid cell for the path check. */
  navCellM: 1,
  /** Hull clearance the path check and spawn checks assume. */
  hullRadiusM: 1.7,
  maxProps: 400,
  maxRivers: 6,
  maxRoads: 8,
  maxNameLen: 40,
  minSpawnGapM: 20,
  /** Per-account (and local cache) library size — many maps, not one or two. */
  maxSaved: 48,
  /** Reject a single document larger than this when writing to the cloud. */
  maxPayloadBytes: 800_000,
  deferred: ["Team spawns", "Objectives", "Elevation", "Public map workshop"],
} as const;

export class MapLibraryFullError extends Error {
  readonly max = LEVEL_LAW.maxSaved;
  constructor() {
    super(
      `Map library is full (${LEVEL_LAW.maxSaved}). Delete a map to save another.`,
    );
    this.name = "MapLibraryFullError";
  }
}

const pt = z.object({ x: z.number().finite(), y: z.number().finite() });

export const crossingSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(CROSSING_KINDS),
  atM: z.number().min(0),
  lengthM: z.number().min(RIVER_LAW.minCrossingM).max(RIVER_LAW.maxCrossingM),
  /** Twist off the river tangent, hull-basis degrees. Missing = 0. */
  yawDeg: z.number().finite().optional(),
});

export const riverDocSchema = z.object({
  id: z.string().min(1),
  points: z.array(pt).min(2).max(64),
  widthM: z.number().min(RIVER_LAW.minWidthM).max(RIVER_LAW.maxWidthM),
  crossings: z.array(crossingSchema).max(8),
});

export const roadDocSchema = z.object({
  id: z.string().min(1),
  points: z.array(pt).min(2).max(64),
  widthM: z.number().min(2).max(8),
});

export const propSchema = z.object({
  id: z.string().min(1),
  asset: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  halfW: z.number().min(0.3).max(24),
  halfL: z.number().min(0.3).max(24),
  variant: z.number().int().min(0).max(32).default(0),
  /** Hull-basis degrees. 0 faces +Y. Missing = unrotated. */
  yawDeg: z.number().finite().optional(),
});

export const spawnSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  yawDeg: z.number().finite(),
});

export const levelSchema = z.object({
  version: z.literal(LEVEL_LAW.docVersion),
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(LEVEL_LAW.maxNameLen),
  biome: z.enum(BIOME_IDS),
  size: z.enum(MAP_SIZES),
  weather: z.enum(WEATHER_KINDS).optional(),
  spawns: z.object({ player: spawnSchema, dummy: spawnSchema }),
  props: z.array(propSchema).max(LEVEL_LAW.maxProps),
  rivers: z.array(riverDocSchema).max(LEVEL_LAW.maxRivers),
  roads: z.array(roadDocSchema).max(LEVEL_LAW.maxRoads),
  updatedAt: z.number(),
});

export type LevelDoc = z.infer<typeof levelSchema>;
export type LevelProp = z.infer<typeof propSchema>;
export type LevelRiver = z.infer<typeof riverDocSchema>;
export type LevelRoad = z.infer<typeof roadDocSchema>;

export function newLevelId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function customMapId(doc: Pick<LevelDoc, "id">): string {
  return `${MAP_LAW.customPrefix}${doc.id}`;
}

/** Playable editor maps as a picker row for garage and lobby. */
export type CustomMapChoice = {
  id: string;
  name: string;
  arenaM: number;
  meta: string;
  playable: boolean;
};

export function customMapChoices(docs: LevelDoc[]): CustomMapChoice[] {
  return docs.map((doc) => ({
    id: customMapId(doc),
    name: doc.name,
    arenaM: MAP_LAW.sizes[doc.size]?.arenaM ?? MAP_LAW.sizes.medium.arenaM,
    meta: `${BIOMES[doc.biome]?.name ?? doc.biome} · ${doc.size}`,
    playable: levelIsPlayable(doc),
  }));
}

export function levelSizeSpec(doc: Pick<LevelDoc, "size">) {
  return MAP_LAW.sizes[doc.size];
}

function cloneLevel(doc: LevelDoc): LevelDoc {
  return JSON.parse(JSON.stringify(doc)) as LevelDoc;
}

/** Keep props and crossings inside a usable yard. Spawns clamp only on resize. */
export function repairLevelGeometry(
  doc: LevelDoc,
  mode: "save" | "scale" = "save",
): LevelDoc {
  const next = cloneLevel(doc);
  const spec = MAP_LAW.sizes[next.size] ?? MAP_LAW.sizes.medium;
  const arena = spec.arenaM;
  const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));
  for (const p of next.props) {
    p.x = clamp(p.x, arena);
    p.y = clamp(p.y, arena);
    p.halfW = Math.max(0.3, Math.min(24, p.halfW));
    p.halfL = Math.max(0.3, Math.min(24, p.halfL));
  }
  for (const rv of next.rivers) {
    const len = riverLengthM(riverGeometry(rv));
    for (const c of rv.crossings) {
      c.atM = Math.max(0, Math.min(c.atM, Math.max(0, len - 0.05)));
      c.lengthM = Math.max(
        RIVER_LAW.minCrossingM,
        Math.min(RIVER_LAW.maxCrossingM, c.lengthM),
      );
    }
  }
  if (mode === "scale") {
    const spawnLim = Math.max(4, arena - 2 - LEVEL_LAW.hullRadiusM);
    for (const key of ["player", "dummy"] as const) {
      next.spawns[key].x = clamp(next.spawns[key].x, spawnLim);
      next.spawns[key].y = clamp(next.spawns[key].y, spawnLim);
    }
  }
  return next;
}

/** Scale a document to another yard size. Prop metres stay; positions scale. */
export function scaleLevel(doc: LevelDoc, size: MapSize): LevelDoc {
  if (doc.size === size) return repairLevelGeometry(doc);
  const from = MAP_LAW.sizes[doc.size]?.arenaM ?? MAP_LAW.sizes.medium.arenaM;
  const to = MAP_LAW.sizes[size].arenaM;
  const k = to / from;
  const next = cloneLevel(doc);
  next.size = size;
  const T = (n: number) => Math.round(n * k * 100) / 100;
  for (const p of next.props) {
    p.x = T(p.x);
    p.y = T(p.y);
  }
  for (const rv of next.rivers) {
    for (const p of rv.points) {
      p.x = T(p.x);
      p.y = T(p.y);
    }
    for (const c of rv.crossings) c.atM = Math.round(c.atM * k * 10) / 10;
  }
  for (const rd of next.roads) {
    for (const p of rd.points) {
      p.x = T(p.x);
      p.y = T(p.y);
    }
  }
  for (const key of ["player", "dummy"] as const) {
    next.spawns[key].x = T(next.spawns[key].x);
    next.spawns[key].y = T(next.spawns[key].y);
  }
  return repairLevelGeometry(next, "scale");
}

export function newLevel(
  biome: BiomeId,
  size: MapSize,
  name?: string,
): LevelDoc {
  const spec = MAP_LAW.sizes[size];
  return {
    version: LEVEL_LAW.docVersion,
    id: newLevelId(),
    name: name ?? `${BIOMES[biome].name} ${size}`,
    biome,
    size,
    spawns: {
      player: { x: 0, y: -spec.spawnY, yawDeg: 0 },
      dummy: { x: 0, y: spec.spawnY, yawDeg: 180 },
    },
    props: [],
    rivers: [],
    roads: [],
    updatedAt: Date.now(),
  };
}

/** Smoothed geometry the sim, renderer, and editor all agree on. */
export function riverGeometry(r: LevelRiver): River {
  return {
    id: r.id,
    points: smoothPolyline(r.points),
    widthM: r.widthM,
    crossings: r.crossings,
  };
}

export function roadGeometry(r: LevelRoad): Road {
  return { id: r.id, points: smoothPolyline(r.points), widthM: r.widthM };
}

export function propToCover(
  doc: Pick<LevelDoc, "biome">,
  p: LevelProp,
): Cover | null {
  const a = biomeAsset(doc.biome, p.asset);
  if (!a) return null;
  const c: Cover = {
    id: p.id,
    kind: a.kind,
    x: p.x,
    y: p.y,
    halfW: p.halfW,
    halfL: p.halfL,
    skin: skinWithVariant(a.skin, p.variant),
    label: a.name,
  };
  if (p.yawDeg) c.yawDeg = p.yawDeg;
  if (a.rules) c.rules = { ...a.rules };
  if (a.hp) {
    c.hp = a.hp;
    c.hpMax = a.hp;
    c.destructible = true;
  }
  return c;
}

export function compileLevel(doc: LevelDoc): MapBlueprint {
  const biome = BIOMES[doc.biome];
  const spec = MAP_LAW.sizes[doc.size];
  const weather = doc.weather ?? biome.weather;
  const cover: Cover[] = [];
  for (const p of doc.props) {
    const c = propToCover(doc, p);
    if (c) cover.push(c);
  }
  return {
    id: customMapId(doc),
    name: doc.name,
    arenaM: spec.arenaM,
    viewM: spec.viewM,
    spawnY: spec.spawnY,
    floor: biome.floor,
    bushSkin: biome.bushSkin,
    wreckSkin: biome.wreckSkin,
    weather,
    visMul: weather === "clear" ? 1 : biome.visMul,
    cover,
    biome: doc.biome,
    rivers: doc.rivers.map(riverGeometry),
    roads: doc.roads.map(roadGeometry),
    spawns: {
      player: { ...doc.spawns.player },
      dummy: { ...doc.spawns.dummy },
    },
  };
}

// ── validation ───────────────────────────────────────────────────────────────

export type IssueLevel = "error" | "warn";
export type IssueRef = {
  type: "prop" | "river" | "road" | "spawn";
  id: string;
};
export type LevelIssue = {
  level: IssueLevel;
  code: string;
  message: string;
  /** What to do. Shown under the message in the editor. */
  hint?: string;
  ref?: IssueRef;
};

function issue(
  level: IssueLevel,
  code: string,
  message: string,
  hint?: string,
  ref?: IssueRef,
): LevelIssue {
  return hint ? { level, code, message, hint, ref } : { level, code, message, ref };
}

function schemaIssue(path: string, raw: string): LevelIssue {
  if (path === "size") {
    return issue(
      "error",
      "schema-size",
      "Yard size is not recognized.",
      "In Theater, pick small, medium, large, or extra-large, then Save.",
    );
  }
  if (path === "biome") {
    return issue(
      "error",
      "schema-biome",
      "Theater is not recognized.",
      "Pick a kit in Theater (snow, desert, jungle, forest, urban, marsh, steppe, coast, industrial).",
    );
  }
  if (path === "name") {
    return issue("error", "schema-name", "The map needs a name.", "Type a name at the top of the panel.");
  }
  if (/\.halfW$|\.halfL$/.test(path)) {
    return issue(
      "error",
      "schema-prop-size",
      "A piece is outside the allowed size (0.3–24 m).",
      "Select the piece and shrink Width / Length, or delete it.",
    );
  }
  if (/\.widthM$/.test(path) && path.startsWith("rivers")) {
    return issue(
      "error",
      "schema-river-width",
      "A river is too narrow or too wide.",
      "Select the river and set width between 3 and 14 m.",
    );
  }
  if (/\.widthM$/.test(path) && path.startsWith("roads")) {
    return issue(
      "error",
      "schema-road-width",
      "A road is too narrow or too wide.",
      "Select the road and set width between 2 and 8 m.",
    );
  }
  return issue("error", "schema", `${path}: ${raw}`, "Fix the highlighted field, or Delete the broken piece.");
}

export type NavGrid = {
  cellM: number;
  n: number;
  originM: number;
  blocked: Uint8Array;
};

function hullCanStand(
  cover: readonly Cover[],
  rivers: readonly River[],
  x: number,
  y: number,
  r: number,
): boolean {
  for (const c of cover) {
    if (!coverOccludes(c, "motion")) continue;
    if (pointInCover(c, x, y, r)) return false;
  }
  return !inUncrossableWater(rivers, x, y, r);
}

/** Cells a hull may occupy. Blocked where tracks would stop. */
export function passabilityGrid(
  doc: LevelDoc,
  cellM: number = LEVEL_LAW.navCellM,
): NavGrid {
  const spec = MAP_LAW.sizes[doc.size];
  const bp = compileLevel(doc);
  const rivers = bp.rivers ?? [];
  const cover = bp.cover;
  const r = LEVEL_LAW.hullRadiusM;
  const bound = spec.arenaM - 2;
  const n = Math.ceil((bound * 2) / cellM);
  const originM = -bound;
  const blocked = new Uint8Array(n * n);
  const hard = cover.filter((c) => coverOccludes(c, "motion"));
  for (let j = 0; j < n; j++) {
    const y = originM + (j + 0.5) * cellM;
    for (let i = 0; i < n; i++) {
      const x = originM + (i + 0.5) * cellM;
      let b = 0;
      for (const c of hard) {
        if (pointInCover(c, x, y, r)) {
          b = 1;
          break;
        }
      }
      if (!b && rivers.length && inUncrossableWater(rivers, x, y, r)) b = 1;
      blocked[j * n + i] = b;
    }
  }
  return { cellM, n, originM, blocked };
}

export function gridCell(
  grid: NavGrid,
  x: number,
  y: number,
): { i: number; j: number } {
  const i = Math.max(
    0,
    Math.min(grid.n - 1, Math.floor((x - grid.originM) / grid.cellM)),
  );
  const j = Math.max(
    0,
    Math.min(grid.n - 1, Math.floor((y - grid.originM) / grid.cellM)),
  );
  return { i, j };
}

export function gridReachable(
  grid: NavGrid,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  const a = gridCell(grid, from.x, from.y);
  const b = gridCell(grid, to.x, to.y);
  const n = grid.n;
  const start = a.j * n + a.i;
  const goal = b.j * n + b.i;
  if (grid.blocked[start] || grid.blocked[goal]) return false;
  const seen = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) return true;
    const ci = cur % n;
    const cj = (cur - ci) / n;
    const push = (i: number, j: number) => {
      if (i < 0 || j < 0 || i >= n || j >= n) return;
      const k = j * n + i;
      if (seen[k] || grid.blocked[k]) return;
      seen[k] = 1;
      queue[tail++] = k;
    };
    push(ci + 1, cj);
    push(ci - 1, cj);
    push(ci, cj + 1);
    push(ci, cj - 1);
  }
  return false;
}

export function validateLevel(doc: LevelDoc): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const parsed = levelSchema.safeParse(doc);
  if (!parsed.success) {
    for (const e of parsed.error.issues.slice(0, 6)) {
      issues.push(schemaIssue(e.path.join("."), e.message));
    }
    return issues;
  }
  const spec = MAP_LAW.sizes[doc.size];
  const bound = spec.arenaM - 2;
  const bp = compileLevel(doc);
  const rivers = bp.rivers ?? [];
  const r = LEVEL_LAW.hullRadiusM;

  for (const key of ["player", "dummy"] as const) {
    const s = doc.spawns[key];
    const who = key === "player" ? "Player" : "Enemy";
    if (Math.abs(s.x) > bound - r || Math.abs(s.y) > bound - r) {
      issues.push(
        issue(
          "error",
          "spawn-bounds",
          `${who} spawn is outside the yard.`,
          `Drag the ${key === "player" ? "green" : "tan"} spawn flag back inside the dashed bound.`,
          { type: "spawn", id: key },
        ),
      );
    } else if (!hullCanStand(bp.cover, rivers, s.x, s.y, r)) {
      issues.push(
        issue(
          "error",
          "spawn-blocked",
          `${who} spawn sits in a wall or in water.`,
          `Drag the ${key === "player" ? "green" : "tan"} flag onto dry ground, or put a ford under it.`,
          { type: "spawn", id: key },
        ),
      );
    }
  }
  const gap = Math.hypot(
    doc.spawns.player.x - doc.spawns.dummy.x,
    doc.spawns.player.y - doc.spawns.dummy.y,
  );
  if (gap < LEVEL_LAW.minSpawnGapM) {
    issues.push(
      issue(
        "warn",
        "spawn-gap",
        `Spawns are ${Math.round(gap)} m apart; ${LEVEL_LAW.minSpawnGapM} m or more keeps the opener honest.`,
        "Drag the flags farther apart along the north–south line.",
      ),
    );
  }

  for (const p of doc.props) {
    const a = biomeAsset(doc.biome, p.asset);
    if (!a) {
      issues.push(
        issue(
          "error",
          "prop-asset",
          `Unknown ${doc.biome} asset "${p.asset}".`,
          "Select that piece and Delete it, or switch Theater so the kit includes it.",
          { type: "prop", id: p.id },
        ),
      );
      continue;
    }
    if (Math.abs(p.x) > spec.arenaM || Math.abs(p.y) > spec.arenaM) {
      issues.push(
        issue(
          "error",
          "prop-bounds",
          `${a.name} is outside the yard.`,
          "Click this error to select it, then drag it inside the dashed bound or Delete it.",
          { type: "prop", id: p.id },
        ),
      );
    }
  }

  for (const rv of doc.rivers) {
    const geo = riverGeometry(rv);
    const len = riverLengthM(geo);
    if (len < rv.widthM) {
      issues.push(
        issue(
          "error",
          "river-short",
          "River is shorter than it is wide.",
          "Extend the river with the River tool, or select it and lower Width.",
          { type: "river", id: rv.id },
        ),
      );
    }
    for (const c of rv.crossings) {
      if (c.atM > len) {
        issues.push(
          issue(
            "error",
            "crossing-off",
            "A ford or bridge sits past the end of the river.",
            "Select the river and place the crossing on the line, or Save again to snap it back.",
            { type: "river", id: rv.id },
          ),
        );
      }
    }
    if (!rv.crossings.length) {
      issues.push(
        issue(
          "warn",
          "river-no-crossing",
          "River has no ford or bridge.",
          "Select the river and add a Ford or Bridge so hulls can cross.",
          { type: "river", id: rv.id },
        ),
      );
    }
  }

  if (!issues.some((i) => i.level === "error")) {
    const grid = passabilityGrid(doc);
    if (!gridReachable(grid, doc.spawns.player, doc.spawns.dummy)) {
      issues.push(
        issue(
          "error",
          "unreachable",
          "No hull-wide path from the player spawn to the enemy spawn.",
          "Add a Ford or Bridge on the river, delete a wall across the yard, or turn on Passability (N) to see the blocked cells.",
        ),
      );
    }
  }

  if (!bp.cover.length && !rivers.length) {
    issues.push(
      issue(
        "warn",
        "empty",
        "Nothing on the map yet. An open yard is a coin flip.",
        "Place kit pieces, or hit Reroll for a mirrored scatter.",
      ),
    );
  }
  const p = doc.spawns.player;
  const d = doc.spawns.dummy;
  if (
    gap <= LOS_LAW.ringRangeM &&
    !firstCoverHit(p.x, p.y, d.x, d.y, bp.cover, "ring")
  ) {
    issues.push(
      issue(
        "warn",
        "spawn-los",
        "Spawns have a clear ring line to each other at the start.",
        "Drop a bush, hedge, or building on the line between the flags.",
      ),
    );
  }
  return issues;
}

export function levelIsPlayable(doc: LevelDoc): boolean {
  return !validateLevel(doc).some((i) => i.level === "error");
}

// ── persistence ──────────────────────────────────────────────────────────────

export function parseLevel(raw: unknown): LevelDoc | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    const parsed = levelSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function capLevelLibrary(levels: LevelDoc[]): LevelDoc[] {
  return [...levels]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, LEVEL_LAW.maxSaved);
}

/** Union two libraries; same id keeps the newer `updatedAt`. Capped. */
export function mergeLevelLibraries(
  local: LevelDoc[],
  remote: LevelDoc[],
): LevelDoc[] {
  const byId = new Map<string, LevelDoc>();
  for (const doc of local) byId.set(doc.id, doc);
  for (const doc of remote) {
    const prev = byId.get(doc.id);
    if (!prev || doc.updatedAt >= prev.updatedAt) byId.set(doc.id, doc);
  }
  return capLevelLibrary([...byId.values()]);
}

export function loadLevels(): LevelDoc[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEVEL_LAW.storageKey);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: LevelDoc[] = [];
    for (const item of arr) {
      const parsed = parseLevel(item);
      if (parsed) out.push(parsed);
    }
    return capLevelLibrary(out);
  } catch {
    return [];
  }
}

function writeLevels(levels: LevelDoc[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    LEVEL_LAW.storageKey,
    JSON.stringify(capLevelLibrary(levels)),
  );
}

export function saveLevel(doc: LevelDoc): LevelDoc {
  const stamped = repairLevelGeometry({ ...doc, updatedAt: Date.now() });
  const existing = loadLevels();
  const had = existing.some((l) => l.id === doc.id);
  const levels = existing.filter((l) => l.id !== doc.id);
  if (!had && levels.length >= LEVEL_LAW.maxSaved) {
    throw new MapLibraryFullError();
  }
  levels.unshift(stamped);
  writeLevels(levels);
  if (levelIsPlayable(stamped)) registerLevel(stamped);
  else unregisterCustomMap(customMapId(stamped));
  return stamped;
}

/** Replace the local cache (used after a cloud hydrate). */
export function replaceStoredLevels(levels: LevelDoc[]): LevelDoc[] {
  writeLevels(levels);
  return registerStoredLevels();
}

/** Merge a remote library into this device, then register playable maps. */
export function hydrateStoredLevels(remote: LevelDoc[]): LevelDoc[] {
  return replaceStoredLevels(mergeLevelLibraries(loadLevels(), remote));
}

export function deleteLevel(id: string): void {
  writeLevels(loadLevels().filter((l) => l.id !== id));
  const mapId = customMapId({ id });
  unregisterCustomMap(mapId);
  const garage = loadGarage();
  if (garage.mapId === mapId)
    saveGarage({ ...garage, mapId: MAP_LAW.defaultMap });
}

export function exportLevel(doc: LevelDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function importLevel(json: string): LevelDoc {
  const parsed = levelSchema.parse(JSON.parse(json));
  return { ...parsed, updatedAt: Date.now() };
}

export function registerLevel(doc: LevelDoc): MapBlueprint {
  if (!levelIsPlayable(doc)) {
    unregisterCustomMap(customMapId(doc));
    throw new Error("Fix the map's validation errors before playing it.");
  }
  const bp = compileLevel(doc);
  registerCustomMap(bp);
  return bp;
}

/** Reconcile playable maps with storage; drafts stay available in the editor. */
export function registerStoredLevels(): LevelDoc[] {
  const levels = loadLevels().filter(levelIsPlayable);
  clearCustomMaps();
  for (const l of levels) registerLevel(l);
  return levels;
}

export function spawnOf(doc: LevelDoc, key: "player" | "dummy"): Spawn {
  return doc.spawns[key];
}
