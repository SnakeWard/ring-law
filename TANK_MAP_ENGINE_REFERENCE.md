# Tank Map Engine Reference

Source snapshot from D:/Tanks-grok-workspace. Code below is copied directly from the current files. Full files are included unless a section is explicitly marked as an excerpt. This is a reference snapshot; the source files remain authoritative.

## src/schema/maps.ts

Complete file.

```typescript
import { RANGE_COVER, type Cover } from "./cover.ts";
import { COVER_SKINS, FLOOR_SKIN } from "./skin.ts";
import { QUARRY_COVER } from "./quarry-layout.ts";

export const MAP_IDS = ["range", "snow", "urban", "tropical", "mountains", "quarry"] as const;
export type MapId = (typeof MAP_IDS)[number];
export const WEATHER_KINDS = ["clear", "snow", "rain", "fog"] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/**
 * MAP LAW — bigger biomes, hard wrecks + soft bushes, weather vis.
 * Range stays 36 m. The four theaters are 64 m half-extent.
 * Weather only scales LOS; it does not move plates or change pen.
 */
export const MAP_LAW = {
  version: 1,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  defaultMap: "range" as MapId,
  theaterArenaM: 64,
  deferred: ["Destructible buildings", "Day/night cycle", "Elevation"],
} as const;

export const WEATHER_LAW = {
  version: 1,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  start: "clear" as WeatherKind,
  homeVis: 1,
  firstShiftS: 8,
  holdS: 14,
} as const;

const S = (folder: string, file: string) => `/skins/maps/${folder}/${file}.png`;

function C(
  id: string,
  kind: Cover["kind"],
  x: number,
  y: number,
  halfW: number,
  halfL: number,
  skin: string,
  extra: Partial<Cover> = {},
): Cover {
  return { id, kind, x, y, halfW, halfL, skin, ...extra };
}

function B(id: string, x: number, y: number, halfW: number, halfL: number, house = false): Cover {
  return C(id, "wreck", x, y, halfW, halfL, S("urban", house ? "house" : "block"), {
    hp: 180,
    hpMax: 180,
    destructible: true,
  });
}

function R(id: string, x: number, y: number, halfW: number, halfL: number): Cover {
  return C(id, "wreck", x, y, halfW, halfL, S("mountains", "ridge"));
}

export type MapBlueprint = {
  id: MapId;
  name: string;
  arenaM: number;
  spawnY: number;
  floor: string;
  bushSkin: string;
  wreckSkin: string;
  weather: WeatherKind;
  visMul: number;
  cover: Cover[];
};

export const MAPS: Record<MapId, MapBlueprint> = {
  quarry: {
    id: "quarry",
    name: "Quarry & village",
    arenaM: 64,
    spawnY: 50,
    floor: FLOOR_SKIN,
    bushSkin: COVER_SKINS.bush,
    wreckSkin: COVER_SKINS.wreck,
    weather: "clear",
    visMul: 1,
    cover: QUARRY_COVER,
  },
  range: {
    id: "range",
    name: "Dirt range",
    arenaM: 36,
    spawnY: 14,
    floor: FLOOR_SKIN,
    bushSkin: COVER_SKINS.bush,
    wreckSkin: COVER_SKINS.wreck,
    weather: "rain",
    visMul: 0.82,
    cover: RANGE_COVER,
  },
  snow: {
    id: "snow",
    name: "Snow valley",
    arenaM: 64,
    spawnY: 28,
    floor: S("snow", "floor"),
    bushSkin: S("snow", "pine"),
    wreckSkin: S("snow", "rock"),
    weather: "snow",
    visMul: 0.72,
    cover: [
      C("pine-a", "bush", -16, 6, 2.4, 2.4, S("snow", "pine")),
      C("pine-b", "bush", 18, 12, 2.6, 2.6, S("snow", "pine")),
      C("pine-c", "bush", -12, -18, 2.2, 2.2, S("snow", "pine")),
      C("pine-d", "bush", 14, -10, 2.3, 2.3, S("snow", "pine")),
      C("pine-e", "bush", 4, 22, 2.1, 2.1, S("snow", "pine")),
      C("pine-f", "bush", -22, -8, 2.5, 2.5, S("snow", "pine")),
      C("rock-a", "wreck", -30, 20, 2.2, 2.4, S("snow", "rock")),
      C("rock-b", "wreck", 30, -20, 2.2, 2.4, S("snow", "rock")),
      C("rock-c", "wreck", -20, -30, 2.4, 2.2, S("snow", "rock")),
      C("rock-d", "wreck", 22, 28, 2.3, 2.3, S("snow", "rock")),
    ],
  },
  urban: {
    id: "urban",
    name: "Urban block",
    arenaM: 64,
    spawnY: 28,
    floor: S("urban", "floor"),
    bushSkin: S("urban", "wall"),
    wreckSkin: S("urban", "truck"),
    weather: "rain",
    visMul: 0.84,
    cover: [
      B("b-nw", -18, 14, 11, 7),
      B("b-ne", 18, 14, 11, 7),
      B("b-sw", -18, -14, 11, 7),
      B("b-se", 18, -14, 11, 7),
      B("b-nnw", -16, 24, 9, 4),
      B("b-nne", 16, 24, 9, 4),
      B("b-ssw", -16, -24, 9, 4),
      B("b-sse", 16, -24, 9, 4),
      B("h-w", -28, 2, 3.2, 8, true),
      B("h-e", 28, -2, 3.2, 8, true),
      C("rubble-a", "bush", -8, 8, 2.2, 1.8, S("urban", "wall")),
      C("rubble-b", "bush", 8, -8, 2.2, 1.8, S("urban", "wall")),
      C("rubble-c", "bush", -7, -6, 2, 1.6, S("urban", "wall")),
      C("truck-a", "wreck", -6, 18, 1.5, 3, S("urban", "truck")),
      C("truck-b", "wreck", 6, -18, 1.5, 3, S("urban", "truck")),
    ],
  },
  tropical: {
    id: "tropical",
    name: "Tropical draw",
    arenaM: 64,
    spawnY: 28,
    floor: S("tropical", "floor"),
    bushSkin: S("tropical", "bush"),
    wreckSkin: S("tropical", "ruin"),
    weather: "rain",
    visMul: 0.88,
    cover: [
      C("jung-a", "bush", -14, 8, 2.8, 2.6, S("tropical", "bush")),
      C("jung-b", "bush", 16, 10, 2.6, 2.6, S("tropical", "bush")),
      C("jung-c", "bush", -10, -16, 2.5, 2.5, S("tropical", "bush")),
      C("jung-d", "bush", 12, -8, 2.7, 2.4, S("tropical", "bush")),
      C("jung-e", "bush", 4, 20, 2.4, 2.4, S("tropical", "bush")),
      C("jung-f", "bush", -20, -6, 2.6, 2.6, S("tropical", "bush")),
      C("jung-g", "bush", 22, 18, 2.3, 2.3, S("tropical", "bush")),
      C("jung-h", "bush", -6, 14, 2.8, 2.6, S("tropical", "bush")),
      C("jung-i", "bush", 8, -18, 2.7, 2.5, S("tropical", "bush")),
      C("jung-j", "bush", -24, 4, 2.4, 2.4, S("tropical", "bush")),
      C("jung-k", "bush", 26, -4, 2.5, 2.4, S("tropical", "bush")),
      C("ruin-a", "wreck", -28, 22, 2.8, 2.2, S("tropical", "ruin")),
      C("ruin-b", "wreck", 28, -18, 2.8, 2.2, S("tropical", "ruin")),
      C("ruin-c", "wreck", 8, -28, 2.6, 2.4, S("tropical", "ruin")),
    ],
  },
  mountains: {
    id: "mountains",
    name: "Mountain pass",
    arenaM: 64,
    spawnY: 28,
    floor: S("mountains", "floor"),
    bushSkin: S("mountains", "pine"),
    wreckSkin: S("mountains", "rock"),
    weather: "fog",
    visMul: 0.64,
    cover: [
      C("scrub-a", "bush", -8, 6, 2.2, 2.2, S("mountains", "pine")),
      C("scrub-b", "bush", 8, -6, 2.1, 2.1, S("mountains", "pine")),
      C("scrub-c", "bush", -6, -16, 2.3, 2.3, S("mountains", "pine")),
      C("scrub-d", "bush", 6, 16, 2.2, 2.2, S("mountains", "pine")),
      R("ridge-ws", -16, -22, 11, 14),
      R("ridge-wn", -16, 22, 11, 14),
      R("ridge-es", 16, -20, 11, 13),
      R("ridge-en", 16, 20, 11, 13),
      C("rock-pocket", "wreck", 0, 38, 4, 2.2, S("mountains", "rock")),
      C("rock-south", "wreck", 0, -38, 4, 2.2, S("mountains", "rock")),
    ],
  },
};

export function mapById(id: string | undefined | null): MapBlueprint {
  if (id && id in MAPS) return MAPS[id as MapId];
  return MAPS[MAP_LAW.defaultMap];
}

export function coverSprite(c: Cover, map: MapBlueprint): string {
  if (c.skin) return c.skin;
  return c.kind === "bush" ? map.bushSkin : map.wreckSkin;
}

export function weatherPulse(time: number, weather: WeatherKind): number {
  if (weather === "clear") return 1;
  const wave = 0.5 + 0.5 * Math.sin(time * 0.32);
  if (weather === "fog") return 0.72 + 0.18 * wave;
  if (weather === "snow") return 0.78 + 0.16 * wave;
  return 0.82 + 0.14 * wave;
}

export type WeatherHost = {
  time: number;
  weather: WeatherKind;
  visMul: number;
  weatherUntil: number;
  mapId: MapId;
};

export function tickWeather(host: WeatherHost): "squall" | "clear" | null {
  if (host.time < host.weatherUntil) return null;
  const map = mapById(host.mapId);
  const squall = map.weather;
  if (squall === "clear") {
    host.weatherUntil = host.time + WEATHER_LAW.holdS;
    return null;
  }
  if (host.weather === "clear") {
    host.weather = squall;
    host.visMul = map.visMul;
    host.weatherUntil = host.time + WEATHER_LAW.holdS;
    return "squall";
  }
  host.weather = "clear";
  host.visMul = WEATHER_LAW.homeVis;
  host.weatherUntil = host.time + WEATHER_LAW.holdS;
  return "clear";
}
```

## src/schema/quarry-layout.ts

Complete file.

```typescript
import type { Cover } from "./cover.ts";
// Layout authority: meters, +Y north. Artwork and collision share these footprints.
export type LayoutPoint = readonly [number, number];
export const QUARRY_ROUTES = [
  {
    id: "quarry",
    name: "Quarry approach",
    note: "Sheltered turns · short sightlines",
    width: 9,
    points: [
      [0, -50],
      [-32, -40],
      [-42, -24],
      [-42, 16],
      [-34, 38],
      [0, 50],
    ],
  },
  {
    id: "village",
    name: "Village street",
    note: "Direct route · contested junctions",
    width: 10,
    points: [
      [0, -50],
      [0, -28],
      [-4, -14],
      [0, 0],
      [5, 16],
      [0, 32],
      [0, 50],
    ],
  },
  {
    id: "flank",
    name: "Woodland flank",
    note: "Long approach · exposed crossings",
    width: 9,
    points: [
      [0, -50],
      [30, -40],
      [43, -20],
      [40, 6],
      [44, 27],
      [27, 42],
      [0, 50],
    ],
  },
] as const;

function solid(id: string, x: number, y: number, halfW: number, halfL: number): Cover {
  return { id, kind: "wreck", x, y, halfW, halfL };
}
function grove(id: string, x: number, y: number, halfW: number, halfL: number): Cover {
  return { id, kind: "bush", x, y, halfW, halfL };
}
export const QUARRY_COVER: Cover[] = [
  solid("quarry-outer-a", -55, -24, 4, 12),
  solid("quarry-outer-b", -55, 3, 4, 11),
  solid("quarry-outer-c", -52, 26, 5, 7),
  solid("quarry-inner-a", -28, -22, 6, 9),
  solid("quarry-inner-b", -27, 6, 7, 8),
  solid("quarry-inner-c", -27, 26, 5, 7),
  solid("house-sw", -15, -17, 5, 7),
  solid("house-se", 14, -17, 6, 6),
  solid("house-nw", -12, 15, 6, 6),
  solid("house-ne", 20, 17, 5, 8),
  solid("house-west", -13, -1, 4, 3),
  solid("house-east", 17, 0, 4, 3),
  solid("rock-flank-s", 28, -22, 3, 5),
  solid("rock-flank-n", 28, 28, 3, 5),
  grove("grove-s", 31, -7, 5, 7),
  grove("grove-n", 30, 14, 4, 5),
  grove("grove-east-a", 54, -22, 4, 8),
  grove("grove-east-b", 53, 3, 5, 9),
  grove("grove-east-c", 55, 30, 4, 7),
  grove("scrub-north", -12, 39, 4, 3),
];

export const QUARRY_STARTS = [
  { name: "South approach", x: 0, y: -50, yaw: 0 },
  { name: "Quarry entrance", x: -32, y: -40, yaw: 32 },
  { name: "Flank entrance", x: 30, y: -40, yaw: -33 },
  { name: "North approach", x: 0, y: 50, yaw: 180 },
] as const;
export const QUARRY_CONNECTORS: readonly (readonly LayoutPoint[])[] = [
  [
    [-42, -6.5],
    [-23, -6.5],
    [-4, -7],
    [28, -7],
    [40, 6],
  ],
  [
    [-34, 38],
    [0, 32],
    [27, 42],
  ],
];
```

## src/game/sim.ts — map/world construction

Verbatim excerpt: imports, simulation constants, world types, opponent selection and createWorld. Subsequent simulation functions are omitted.

```typescript
import {
  applyCrit,
  clampToArc,
  casemateGun,
  effectiveTraverseRate,
  formatAmmo,
  formatCrit,
  formatHit,
  formatLos,
  formatTrack,
  greenReticleBound,
  howitzerBlocked,
  howitzerCanFire,
  howitzerCanLob,
  howitzerDamage,
  howitzerBlastDamage,
  howitzerChipHp,
  lobInRange,
  HOWITZER_LAW,
  hullById,
  instantiateHull,
  isHowitzer,
  leftoverAimDeg,
  occupyBush,
  stepConceal,
  mainGun,
  mainTurret,
  pushOutWrecks,
  firstCoverHit,
  hitDestructible,
  resolveHit,
  resolveLos,
  roundShot,
  spendRound,
  nextRound,
  resolveHe,
  formatHe,
  tickFire,
  tryAmmoCook,
  tryBreakTrack,
  wrapDeg,
  type Cover,
  type HitReport,
  type HullInstance,
  type MapId,
  type RoundKind,
  type WeatherKind,
  mapById,
  weatherPulse,
  tickWeather,
  WEATHER_LAW,
} from "../schema/index.ts";
import { clamp, forward, lerp, right, stepDeg, worldAngleTo } from "./math.ts";

export const ARENA = 36;
const DT_CAP = 0.1;
export const STEP = 1 / 60;

export type Tracer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  fromPlayer: boolean;
  round: RoundKind;
};

export type DustPuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  life: number;
};

export type World = {
  player: HullInstance;
  dummy: HullInstance;
  speed: number;
  dummySpeed: number;
  tracers: Tracer[];
  dust: DustPuff[];
  playerDustM: number;
  dummyDustM: number;
  reload: number;
  dummyReload: number;
  shake: number;
  complete: boolean;
  outcome: "win" | "loss" | null;
  time: number;
  lastHit: HitReport | null;
  lastHitText: string;
  playerSeesDummy: boolean;
  dummySeesPlayer: boolean;
  lastDummySeenX: number;
  lastDummySeenY: number;
  lastPlayerSeenX: number;
  lastPlayerSeenY: number;
  playerMuzzleAt: number;
  dummyMuzzleAt: number;
  losText: string;
  cover: Cover[];
  playerEverSaw: boolean;
  credits: number;
  round: RoundKind;
  arenaM: number;
  mapId: MapId;
  weather: WeatherKind;
  visMul: number;
  weatherUntil: number;
  floor: string;
  bushSkin: string;
  wreckSkin: string;
  artyMode: "direct" | "lob";
  playerConceal: number;
  dummyConceal: number;
  lobX: number;
  lobY: number;
  lobOk: boolean;
};

const DUMMY_FOR: Record<string, string> = {
  "t-28": "m2a4",
  "t-28e": "m2a4",
  "t-34": "tiger-i",
  panther: "tiger-ii",
  "panther-g": "tiger-ii",
  "m24-chaffee": "panther",
  "m4a3-sherman": "panther",
  "t-34-85": "panther",
  "t-44": "panther",
  "m7-priest": "m2a4",
  "su-76": "m2a4",
  wespe: "m2a4",
  jagdpanther: "tiger-ii",
  m4a3e8: "panther",
  "t-44-100": "tiger-ii",
  "t-54": "tiger-ii",
  "t-54b": "tiger-ii",
  "m26-pershing": "tiger-ii",
  "m46-patton": "tiger-ii",
  "m47-patton": "e-50",
  "m48-patton": "e-50",
  "t-62": "e-75",
  "t-64a": "e-75",
  "panther-f": "tiger-ii",
  "e-50": "tiger-ii",
  "e-75": "t-54",
  standardpanzer: "t-64a",
  "leopard-1": "t-64a",
};

export function dummyIdFor(playerId: string): string {
  return DUMMY_FOR[playerId] ?? "t-28";
}

export function createWorld(
  playerId: string,
  credits = 0,
  round: RoundKind = "ap",
  mapId: MapId = "range",
): World {
  const pbp = hullById(playerId) ?? hullById("m2a4")!;
  const did = dummyIdFor(pbp.id);
  const dbp = hullById(did)!;
  const map = mapById(mapId);
  return {
    player: instantiateHull(pbp, { id: "player", x: 0, y: -map.spawnY, yawDeg: 0 }),
    dummy: instantiateHull(dbp, { id: "dummy", x: 0, y: map.spawnY, yawDeg: 180 }),
    speed: 0,
    dummySpeed: 0,
    tracers: [],
    dust: [],
    playerDustM: 0,
    dummyDustM: 0,
    reload: 0,
    dummyReload: reloadFor(dbp.id) + 1.6,
    shake: 0,
    complete: false,
    outcome: null,
    time: 0,
    lastHit: null,
    lastHitText: "",
    playerSeesDummy: false,
    dummySeesPlayer: false,
    lastDummySeenX: 0,
    lastDummySeenY: map.spawnY,
    lastPlayerSeenX: 0,
    lastPlayerSeenY: -map.spawnY,
    playerMuzzleAt: -99,
    dummyMuzzleAt: -99,
    losText: "LOST",
    cover: map.cover.map((c) => ({ ...c })),
    playerEverSaw: false,
    credits,
    round,
    arenaM: map.arenaM,
    mapId: map.id,
    weather: WEATHER_LAW.start,
    visMul: WEATHER_LAW.homeVis,
    weatherUntil: WEATHER_LAW.firstShiftS,
    floor: map.floor,
    bushSkin: map.bushSkin,
    wreckSkin: map.wreckSkin,
    artyMode: "direct",
    playerConceal: 0,
    dummyConceal: 0,
    lobX: 0,
    lobY: map.spawnY,
    lobOk: true,
  };
}
```

## src/game/quarry-world.ts

Complete file.

```typescript
import { createWorld } from "./sim.ts";
import { QUARRY_COVER, QUARRY_STARTS } from "./quarry.ts";
import { worldAngleTo } from "./math.ts";

export function newLayoutWorld(combat = false, index = 0) {
  const w = createWorld("m2a4");
  w.arenaM = 64;
  w.cover = QUARRY_COVER.map((c) => ({ ...c }));
  w.player.x = 0;
  w.player.y = -50;
  const start = QUARRY_STARTS[index] ?? QUARRY_STARTS[0];
  Object.assign(w.player, { x: start.x, y: start.y, yawDeg: start.yaw });
  // Park the unused combatant outside the exercise. No garage state is loaded.
  w.dummy.x = 1000;
  w.dummy.y = 1000;
  w.lastDummySeenX = 0;
  w.lastDummySeenY = 50;
  if (combat) {
    const [x, y] = [
      [0, -28],
      [-42, -24],
      [43, -20],
      [0, 32],
    ][index] ?? [0, -28];
    Object.assign(w.dummy, { x, y, yawDeg: worldAngleTo(x, y, start.x, start.y) });
    w.lastPlayerSeenX = start.x;
    w.lastPlayerSeenY = start.y;
    w.lastDummySeenX = x;
    w.lastDummySeenY = y;
  }
  w.weatherUntil = Infinity;
  w.weather = "clear";
  w.visMul = 1;
  return w;
}
```

## src/game/quarry.ts — rendering/collision interpretation

Complete file. Collision outlines visualize the simulation clearance; collision response itself lives in sim.ts and schema/cover.ts.

```typescript
import type { Cover } from "../schema/cover.ts";
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
) {
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
  for (const route of QUARRY_ROUTES) {
    road(route.points, route.width + 2, "#55594c");
    road(route.points, route.width, "#777362");
  }
  for (const connector of QUARRY_CONNECTORS) road(connector, 7, "#777362");
  if (art) drawQuarryArtGround(ctx, ART_ROADS, QUARRY_COVER);
  if (routes)
    for (const route of QUARRY_ROUTES) {
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
```

## src/game/quarry-art.ts

Complete file.

```typescript
import type { Cover } from "../schema/cover.ts";
import type { LayoutPoint } from "./quarry.ts";

// Cosmetic only. The approved map data owns all footprints and road widths.
// Light comes from screen northwest. Static detail is baked once, never per frame.
type Road = { points: readonly LayoutPoint[]; width: number };
const RES = 16;
const AREA = { left: -64, top: 64, width: 128, height: 128 };
let ground: HTMLCanvasElement | null = null;
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
) {
  ground ??= bakeGround(roads, cover);
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
  const key = `${b.id}:${b.halfW}:${b.halfL}`;
  let sprite = objects.get(key);
  if (!sprite) {
    sprite =
      b.kind === "bush"
        ? groveSprite(b)
        : b.id.startsWith("house")
          ? houseSprite(b)
          : rockSprite(b);
    objects.set(key, sprite);
  }
  ctx.drawImage(sprite, x - w / 2, y - h / 2, w, h);
}
```

## src/game/render.ts — main-game quarry rendering

Verbatim excerpt: renderWorld entry, camera setup, terrain rendering and quarry cover dispatch. The subsequent standard-map cover loop and tank/effect rendering are omitted.

```typescript
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  dpr: number,
  layout?: { overview: boolean; collision: boolean; routes: boolean; art?: boolean },
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, w, h);

  const shake = world.shake;
  const ox = (Math.random() - 0.5) * shake * 10;
  const oy = (Math.random() - 0.5) * shake * 10;
  const cx = w / 2 + ox;
  const cy = h / 2 + oy;
  const arena = world.arenaM;
  const scale = Math.min(w, h) / (arena * (layout?.overview ? 2.15 : 1.15));
  const camX = layout?.overview ? 0 : world.player.x;
  const camY = layout?.overview ? 0 : world.player.y;
  const view = { x: camX, y: camY, cx, cy, scale };

  ctx.fillStyle = COL.yard;
  const left = wx(camX, -arena, cx, scale);
  const top = wy(camY, arena, cy, scale);
  const size = arena * 2 * scale;
  ctx.fillRect(left, top, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.clip();
  const quarry = !!layout || world.mapId === "quarry";
  const dirt = quarry ? null : skinImage(world.floor);
  if (quarry) quarryGround(ctx, view, layout?.routes ?? false, layout?.art ?? true);
  if (dirt) {
    const tpx = FLOOR_TILE_M * scale;
    for (let gx = -arena; gx < arena; gx += FLOOR_TILE_M) {
      for (let gy = -arena; gy < arena; gy += FLOOR_TILE_M) {
        const x = wx(camX, gx, cx, scale);
        const y = wy(camY, gy + FLOOR_TILE_M, cy, scale);
        const ix = Math.round((gx + arena) / FLOOR_TILE_M);
        const iy = Math.round((gy + arena) / FLOOR_TILE_M);
        const rot = ((ix + iy * 3) & 3) * (Math.PI / 2);
        ctx.save();
        ctx.translate(x + tpx / 2, y + tpx / 2);
        ctx.rotate(rot);
        ctx.drawImage(dirt, -tpx / 2, -tpx / 2, tpx, tpx);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, size, size);

  if (quarry) quarryCover(ctx, world.cover, view, layout?.collision ?? false, layout?.art ?? true);
```
