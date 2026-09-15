import type { CoverKind, CoverRules } from "./cover.ts";
import type { WeatherKind } from "./maps.ts";

/**
 * BIOME LAW v1 — five theaters, each a deliberate asset kit.
 *
 * Every asset carries its own collision profile. The kit is the vocabulary
 * the level editor places from; nothing in a level is random.
 * Skins are either baked PNGs already in /public/skins or `gen:` keys the
 * runtime paints procedurally (see game/gen-assets.ts). Drop a PNG at the
 * documented path and swap the skin string to upgrade an asset.
 */
export const BIOME_LAW = {
  version: 1,
  frozenAt: "2026-09-14",
  evidence: "assumed" as const,
  ids: ["snow", "desert", "jungle", "forest", "urban"] as const,
  generatedPrefix: "gen:",
  deferred: ["Seasonal variants", "Night", "Elevation"],
} as const;

export const BIOME_IDS = BIOME_LAW.ids;
export type BiomeId = (typeof BIOME_IDS)[number];

export const RIVER_STYLES = ["ice", "wadi", "jungle", "stream", "canal"] as const;
export type RiverStyle = (typeof RIVER_STYLES)[number];
export const ROAD_STYLES = ["packed", "sand", "mud", "dirt", "asphalt"] as const;
export type RoadStyle = (typeof ROAD_STYLES)[number];

export type BiomeAsset = {
  id: string;
  name: string;
  kind: CoverKind;
  rules?: Partial<CoverRules>;
  skin: string;
  halfW: number;
  halfL: number;
  minHalf: number;
  maxHalf: number;
  /** Destructible hit points. Missing = permanent. */
  hp?: number;
  /** Number of procedural look variants (`skin#n`). 1 for PNGs. */
  variants: number;
  /** Why it exists on a real battlefield — shown in the palette. */
  note: string;
};

export type Biome = {
  id: BiomeId;
  name: string;
  blurb: string;
  floor: string;
  weather: WeatherKind;
  visMul: number;
  riverStyle: RiverStyle;
  roadStyle: RoadStyle;
  /** Fallback sprites for cover rows that carry no skin. */
  bushSkin: string;
  wreckSkin: string;
  assets: BiomeAsset[];
};

const PNG = (folder: string, file: string) => `/skins/maps/${folder}/${file}.png`;
const GEN = (biome: BiomeId, asset: string) => `${BIOME_LAW.generatedPrefix}${biome}/${asset}`;

/** Stops tracks and shells; the ring sees over it. */
const LOW_HARD: Partial<CoverRules> = { ring: false, hull: false };
/** Blocks the ring's view; drive over it, shoot through it. */
const SIGHT_BERM: Partial<CoverRules> = {
  motion: false,
  shot: false,
  ring: true,
  hull: false,
  conceal: false,
};
/** Steel that stops tracks and nothing else. */
const TRAP: Partial<CoverRules> = { shot: false, ring: false, hull: false };
/** Ground detail. Stops nothing. */
const DECOR: Partial<CoverRules> = {
  motion: false,
  shot: false,
  ring: false,
  hull: false,
  conceal: false,
};

function asset(
  id: string,
  name: string,
  kind: CoverKind,
  skin: string,
  halfW: number,
  halfL: number,
  note: string,
  extra: Partial<Pick<BiomeAsset, "rules" | "hp" | "variants" | "minHalf" | "maxHalf">> = {},
): BiomeAsset {
  const small = Math.min(halfW, halfL);
  return {
    id,
    name,
    kind,
    skin,
    halfW,
    halfL,
    minHalf: extra.minHalf ?? Math.max(0.5, small * 0.5),
    maxHalf: extra.maxHalf ?? Math.max(halfW, halfL) * 2.2,
    hp: extra.hp,
    rules: extra.rules,
    variants: extra.variants ?? (skin.startsWith(BIOME_LAW.generatedPrefix) ? 4 : 1),
    note,
  };
}

export const BIOMES: Record<BiomeId, Biome> = {
  snow: {
    id: "snow",
    name: "Snow",
    blurb: "Pine stands, frozen river, log cabins. Squalls cut the ring to 72%.",
    floor: PNG("snow", "floor"),
    weather: "snow",
    visMul: 0.72,
    riverStyle: "ice",
    roadStyle: "packed",
    bushSkin: PNG("snow", "pine"),
    wreckSkin: PNG("snow", "rock"),
    assets: [
      asset(
        "pine",
        "Pine stand",
        "bush",
        PNG("snow", "pine"),
        2.4,
        2.4,
        "Conifer clump. Sit inside to vanish from the ring.",
      ),
      asset(
        "rock",
        "Boulder",
        "wreck",
        PNG("snow", "rock"),
        2.2,
        2.4,
        "Glacial erratic. Hard cover on every channel.",
      ),
      asset(
        "log",
        "Fallen log",
        "wreck",
        GEN("snow", "log"),
        1.2,
        3.2,
        "Stops tracks and shells; the ring sees over it.",
        { rules: LOW_HARD },
      ),
      asset(
        "drift",
        "Snow bank",
        "bush",
        GEN("snow", "drift"),
        3.6,
        1.5,
        "Plowed berm. Breaks ring sight, drive straight over.",
        { rules: SIGHT_BERM },
      ),
      asset(
        "cabin",
        "Log cabin",
        "wreck",
        GEN("snow", "cabin"),
        3.2,
        3.6,
        "Timber walls. Falls to fire after 140 HP.",
        { hp: 140 },
      ),
      asset(
        "bridge",
        "Timber bridge",
        "wreck",
        GEN("snow", "bridge"),
        1.4,
        5,
        "Deck across ice. Stops tracks and shells; twist it to sit on the river.",
        { rules: LOW_HARD, maxHalf: 12 },
      ),
      asset(
        "fence",
        "Rail fence",
        "wreck",
        GEN("snow", "fence"),
        4.5,
        0.45,
        "Split-rail. Stops tracks and shells until 40 HP.",
        { rules: LOW_HARD, hp: 40, minHalf: 0.4, maxHalf: 12 },
      ),
      asset(
        "tent",
        "Canvas tent",
        "wreck",
        GEN("snow", "tent"),
        2.2,
        2.8,
        "Winter bivouac. Falls after 50 HP.",
        { hp: 50 },
      ),
      asset(
        "crate",
        "Supply crate",
        "wreck",
        GEN("snow", "crate"),
        0.9,
        0.9,
        "Wooden crate. Hard cover, small.",
      ),
      asset(
        "well",
        "Stone well",
        "wreck",
        GEN("snow", "well"),
        1.3,
        1.3,
        "Village well. Hard cover.",
      ),
    ],
  },
  desert: {
    id: "desert",
    name: "Desert",
    blurb: "Dune ridges, a dry wadi with one wet ford, adobe villages. Clear air, long sight.",
    floor: GEN("desert", "floor"),
    weather: "clear",
    visMul: 1,
    riverStyle: "wadi",
    roadStyle: "sand",
    bushSkin: GEN("desert", "scrub"),
    wreckSkin: GEN("desert", "outcrop"),
    assets: [
      asset(
        "dune",
        "Dune ridge",
        "wreck",
        GEN("desert", "dune"),
        8,
        3,
        "Steep slip face. Impassable, blocks every channel.",
        { minHalf: 1.5, maxHalf: 20 },
      ),
      asset(
        "outcrop",
        "Rock outcrop",
        "wreck",
        GEN("desert", "outcrop"),
        2.6,
        2.2,
        "Weathered sandstone. Hard cover.",
      ),
      asset(
        "berm",
        "Sand berm",
        "bush",
        GEN("desert", "berm"),
        4,
        1.4,
        "Bulldozed berm. Breaks ring sight, drive over it.",
        { rules: SIGHT_BERM },
      ),
      asset(
        "scrub",
        "Thorn scrub",
        "bush",
        GEN("desert", "scrub"),
        2.2,
        2,
        "Dry acacia. Hides a hull from the ring.",
      ),
      asset(
        "palms",
        "Oasis palms",
        "bush",
        GEN("desert", "palms"),
        2.8,
        2.8,
        "Date palms around water. Concealment.",
      ),
      asset(
        "adobe",
        "Adobe house",
        "wreck",
        GEN("desert", "adobe"),
        3.4,
        3,
        "Mud brick. Collapses after 150 HP.",
        { hp: 150 },
      ),
      asset(
        "truck",
        "Burnt truck",
        "wreck",
        PNG("urban", "truck"),
        1.5,
        3,
        "Convoy wreck. Hard cover.",
      ),
      asset(
        "bridge",
        "Plank bridge",
        "wreck",
        GEN("desert", "bridge"),
        1.4,
        5,
        "Weathered deck. Stops tracks and shells; rotate to span the wadi.",
        { rules: LOW_HARD, maxHalf: 12 },
      ),
      asset(
        "tent",
        "Field tent",
        "wreck",
        GEN("desert", "tent"),
        2.2,
        2.8,
        "Canvas fly. Falls after 50 HP.",
        { hp: 50 },
      ),
      asset(
        "crate",
        "Supply crate",
        "wreck",
        GEN("desert", "crate"),
        0.9,
        0.9,
        "Wooden crate. Hard cover, small.",
      ),
      asset(
        "well",
        "Cistern",
        "wreck",
        GEN("desert", "well"),
        1.3,
        1.3,
        "Stone cistern. Hard cover.",
      ),
      asset(
        "bunker",
        "Sand bunker",
        "wreck",
        GEN("desert", "bunker"),
        2.4,
        2,
        "Dug-in concrete. Hard cover.",
      ),
      asset(
        "barricade",
        "Barricade",
        "wreck",
        GEN("desert", "barricade"),
        3.2,
        1.2,
        "Stacked crates and beams. Stops tracks and shells until 80 HP.",
        { rules: LOW_HARD, hp: 80, maxHalf: 10 },
      ),
    ],
  },
  jungle: {
    id: "jungle",
    name: "Jungle",
    blurb: "Wide brown river, dense bush walls, stone ruins, stilt huts. Rain to 88%.",
    floor: PNG("tropical", "floor"),
    weather: "rain",
    visMul: 0.88,
    riverStyle: "jungle",
    roadStyle: "mud",
    bushSkin: PNG("tropical", "bush"),
    wreckSkin: PNG("tropical", "ruin"),
    assets: [
      asset(
        "bush",
        "Jungle bush",
        "bush",
        PNG("tropical", "bush"),
        2.7,
        2.6,
        "Broadleaf thicket. Hides a hull from the ring.",
      ),
      asset(
        "palms",
        "Palm cluster",
        "bush",
        GEN("jungle", "palms"),
        2.8,
        2.8,
        "Coconut palms. Concealment.",
      ),
      asset(
        "ruin",
        "Stone ruin",
        "wreck",
        PNG("tropical", "ruin"),
        2.8,
        2.2,
        "Temple wall. Hard cover.",
      ),
      asset(
        "boulder",
        "Mossy boulder",
        "wreck",
        GEN("jungle", "boulder"),
        2.2,
        2,
        "River rock. Hard cover.",
      ),
      asset(
        "log",
        "Fallen trunk",
        "wreck",
        GEN("jungle", "log"),
        1.2,
        3.4,
        "Rotting hardwood. Stops tracks and shells, not sight.",
        { rules: LOW_HARD },
      ),
      asset(
        "hut",
        "Stilt hut",
        "wreck",
        GEN("jungle", "hut"),
        2.6,
        2.6,
        "Thatch and bamboo. Falls after 90 HP.",
        { hp: 90 },
      ),
      asset(
        "bridge",
        "Log bridge",
        "wreck",
        GEN("jungle", "bridge"),
        1.4,
        5,
        "Lashings over the brown river. Stops tracks and shells; rotate to span.",
        { rules: LOW_HARD, maxHalf: 12 },
      ),
      asset(
        "fence",
        "Bamboo fence",
        "wreck",
        GEN("jungle", "fence"),
        4.5,
        0.45,
        "Stakes and lashings. Stops tracks and shells until 35 HP.",
        { rules: LOW_HARD, hp: 35, minHalf: 0.4, maxHalf: 12 },
      ),
      asset(
        "tent",
        "Canvas tent",
        "wreck",
        GEN("jungle", "tent"),
        2.2,
        2.8,
        "Field tent. Falls after 50 HP.",
        { hp: 50 },
      ),
      asset(
        "crate",
        "Supply crate",
        "wreck",
        GEN("jungle", "crate"),
        0.9,
        0.9,
        "Wooden crate. Hard cover, small.",
      ),
      asset(
        "boat",
        "Canoe",
        "wreck",
        GEN("jungle", "boat"),
        1.2,
        3,
        "Beached hull. Stops tracks and shells; the ring sees over it.",
        { rules: LOW_HARD },
      ),
    ],
  },
  forest: {
    id: "forest",
    name: "Forest",
    blurb: "Oak tree lines, a shallow stream, stone field walls, a barn. Fog to 70%.",
    floor: GEN("forest", "floor"),
    weather: "fog",
    visMul: 0.7,
    riverStyle: "stream",
    roadStyle: "dirt",
    bushSkin: GEN("forest", "oak"),
    wreckSkin: PNG("mountains", "rock"),
    assets: [
      asset(
        "oak",
        "Oak canopy",
        "bush",
        GEN("forest", "oak"),
        3,
        3,
        "Broad crown. Hides a hull from the ring.",
      ),
      asset("pine", "Pine", "bush", PNG("mountains", "pine"), 2.3, 2.3, "Conifer. Concealment."),
      asset(
        "hedge",
        "Hedgerow",
        "bush",
        GEN("forest", "hedge"),
        4.5,
        1.2,
        "Field boundary. Blocks the ring's view, passable.",
        { rules: { hull: false } },
      ),
      asset(
        "boulder",
        "Boulder",
        "wreck",
        PNG("mountains", "rock"),
        2.3,
        2.3,
        "Granite. Hard cover.",
      ),
      asset(
        "log",
        "Fallen oak",
        "wreck",
        GEN("forest", "log"),
        1.2,
        3.4,
        "Stops tracks and shells; sight passes.",
        { rules: LOW_HARD },
      ),
      asset(
        "wall",
        "Stone wall",
        "wreck",
        GEN("forest", "wall"),
        4.5,
        0.8,
        "Dry-stone field wall. Stops tracks and shells until 60 HP.",
        { rules: LOW_HARD, hp: 60, maxHalf: 14 },
      ),
      asset(
        "cabin",
        "Cabin",
        "wreck",
        GEN("forest", "cabin"),
        3,
        3.4,
        "Timber. Falls after 140 HP.",
        { hp: 140 },
      ),
      asset(
        "barn",
        "Barn",
        "wreck",
        GEN("forest", "barn"),
        4,
        5,
        "Plank barn. Falls after 160 HP.",
        { hp: 160 },
      ),
      asset(
        "bridge",
        "Timber bridge",
        "wreck",
        GEN("forest", "bridge"),
        1.4,
        5,
        "Deck across the stream. Stops tracks and shells; rotate to sit on the water.",
        { rules: LOW_HARD, maxHalf: 12 },
      ),
      asset(
        "fence",
        "Rail fence",
        "wreck",
        GEN("forest", "fence"),
        4.5,
        0.45,
        "Split-rail paddock. Stops tracks and shells until 40 HP.",
        { rules: LOW_HARD, hp: 40, minHalf: 0.4, maxHalf: 12 },
      ),
      asset(
        "tent",
        "Canvas tent",
        "wreck",
        GEN("forest", "tent"),
        2.2,
        2.8,
        "Field tent. Falls after 50 HP.",
        { hp: 50 },
      ),
      asset(
        "crate",
        "Supply crate",
        "wreck",
        GEN("forest", "crate"),
        0.9,
        0.9,
        "Wooden crate. Hard cover, small.",
      ),
      asset(
        "well",
        "Village well",
        "wreck",
        GEN("forest", "well"),
        1.3,
        1.3,
        "Stone well. Hard cover.",
      ),
    ],
  },
  urban: {
    id: "urban",
    name: "Urban",
    blurb: "City blocks, a stone canal, sandbag lines, tank traps. Rain to 84%.",
    floor: PNG("urban", "floor"),
    weather: "rain",
    visMul: 0.84,
    riverStyle: "canal",
    roadStyle: "asphalt",
    bushSkin: PNG("urban", "wall"),
    wreckSkin: PNG("urban", "truck"),
    assets: [
      asset(
        "block",
        "City block",
        "wreck",
        PNG("urban", "block"),
        11,
        7,
        "Tenement block. Falls after 180 HP.",
        { hp: 180, minHalf: 3, maxHalf: 20 },
      ),
      asset(
        "house",
        "Row house",
        "wreck",
        PNG("urban", "house"),
        3.2,
        8,
        "Narrow house. Falls after 180 HP.",
        { hp: 180, maxHalf: 14 },
      ),
      asset(
        "rubble",
        "Rubble",
        "bush",
        PNG("urban", "wall"),
        2.2,
        1.8,
        "Collapsed wall. Hides a hull from the ring.",
      ),
      asset(
        "truck",
        "Wrecked truck",
        "wreck",
        PNG("urban", "truck"),
        1.5,
        3,
        "Burnt lorry. Hard cover.",
      ),
      asset(
        "sandbags",
        "Sandbag line",
        "wreck",
        GEN("urban", "sandbags"),
        3,
        0.9,
        "Stops tracks and shells until 70 HP; the ring sees over.",
        { rules: LOW_HARD, hp: 70, maxHalf: 10 },
      ),
      asset(
        "hedgehog",
        "Tank trap",
        "wreck",
        GEN("urban", "hedgehog"),
        1.4,
        1.4,
        "Czech hedgehog. Stops tracks only.",
        { rules: TRAP },
      ),
      asset(
        "crater",
        "Shell crater",
        "bush",
        GEN("urban", "crater"),
        2.4,
        2.4,
        "Ground scar. Decoration, stops nothing.",
        { rules: DECOR },
      ),
      asset(
        "bridge",
        "Canal bridge",
        "wreck",
        GEN("urban", "bridge"),
        1.4,
        5,
        "Stone deck. Stops tracks and shells; rotate to span the canal.",
        { rules: LOW_HARD, maxHalf: 12 },
      ),
      asset(
        "barricade",
        "Street barricade",
        "wreck",
        GEN("urban", "barricade"),
        3.2,
        1.2,
        "Carts and beams. Stops tracks and shells until 80 HP.",
        { rules: LOW_HARD, hp: 80, maxHalf: 10 },
      ),
      asset(
        "crate",
        "Crate stack",
        "wreck",
        GEN("urban", "crate"),
        0.9,
        0.9,
        "Wooden crate. Hard cover, small.",
      ),
      asset(
        "bunker",
        "Pillbox",
        "wreck",
        GEN("urban", "bunker"),
        2.4,
        2,
        "Concrete embrasure. Hard cover.",
      ),
      asset(
        "tent",
        "Command tent",
        "wreck",
        GEN("urban", "tent"),
        2.2,
        2.8,
        "Staff tent. Falls after 50 HP.",
        { hp: 50 },
      ),
      asset(
        "boat",
        "Canal barge",
        "wreck",
        GEN("urban", "boat"),
        1.2,
        3,
        "Moored barge. Stops tracks and shells; the ring sees over it.",
        { rules: LOW_HARD },
      ),
    ],
  },
};

export function biomeById(id: string | null | undefined): Biome {
  if (id && id in BIOMES) return BIOMES[id as BiomeId];
  return BIOMES.forest;
}

export function biomeAsset(biome: BiomeId, assetId: string): BiomeAsset | undefined {
  return BIOMES[biome].assets.find((a) => a.id === assetId);
}

export function isGeneratedSkin(skin: string): boolean {
  return skin.startsWith(BIOME_LAW.generatedPrefix);
}

/** `gen:forest/oak#2` → { key: "forest/oak", variant: 2 }. */
export function parseGeneratedSkin(skin: string): { key: string; variant: number } | null {
  if (!isGeneratedSkin(skin)) return null;
  const body = skin.slice(BIOME_LAW.generatedPrefix.length);
  const hash = body.indexOf("#");
  if (hash < 0) return { key: body, variant: 0 };
  return { key: body.slice(0, hash), variant: Number(body.slice(hash + 1)) || 0 };
}

export function skinWithVariant(skin: string, variant: number): string {
  if (!isGeneratedSkin(skin) || variant <= 0) return skin;
  const base = skin.split("#")[0];
  return `${base}#${variant}`;
}
