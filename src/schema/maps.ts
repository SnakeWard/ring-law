import { RANGE_COVER, type Cover } from "./cover.ts";
import { COVER_SKINS, FLOOR_SKIN } from "./skin.ts";

export const MAP_IDS = ["range", "snow", "urban", "tropical", "mountains"] as const;
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
