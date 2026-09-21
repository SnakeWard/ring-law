import { biomeAsset, type BiomeId } from "./biomes.ts";
import { MAP_LAW, type MapSize } from "./maps.ts";
import {
  LEVEL_LAW,
  riverGeometry,
  type LevelDoc,
  type LevelProp,
  type LevelRiver,
  type LevelRoad,
} from "./level.ts";
import { RIVER_LAW, riverLengthM, type CrossingKind } from "./river.ts";

/**
 * PRESET LAW v1 — authored openers, one per theater.
 *
 * Coordinates are fractions of the arena half-extent so a layout keeps its
 * shape on every size; prop sizes stay in metres. Every layout has
 * rotational symmetry about the centre (x,y → −x,−y) so both spawns get the
 * same lanes. Tier 1 props appear on medium and large, tier 2 only on large.
 */
export const PRESET_LAW = {
  version: 1,
  frozenAt: "2026-09-14",
  evidence: "assumed" as const,
  symmetry: "rotational" as const,
  riverWidthMul: { small: 0.65, medium: 1, large: 1.25, xlarge: 1.45 } as Record<MapSize, number>,
} as const;

type Frac = [number, number];
type PropSpec = {
  asset: string;
  at: Frac;
  tier?: 0 | 1 | 2;
  /** Restrict to these sizes (tier still applies). */
  only?: MapSize[];
  halfW?: number;
  halfL?: number;
  variant?: number;
  mirror?: boolean;
};
type CrossingSpec = { kind: CrossingKind; frac: number; lengthM?: number };
type RiverSpec = { points: Frac[]; widthM: number; crossings: CrossingSpec[] };
type RoadSpec = { points: Frac[]; widthM: number };

export type PresetSpec = {
  id: string;
  biome: BiomeId;
  name: string;
  brief: string;
  rivers: RiverSpec[];
  roads: RoadSpec[];
  props: PropSpec[];
};

const T = (n: number) => Math.round(n * 100) / 100;

export const PRESETS: PresetSpec[] = [
  {
    id: "frozen-fork",
    biome: "snow",
    name: "Frozen Fork",
    brief:
      "A river splits the valley. One ford west, one timber bridge east. Pine stands screen both banks; the cabin overlooks the bridge.",
    rivers: [
      {
        points: [
          [-1.15, 0.12],
          [-0.6, 0.04],
          [-0.2, -0.06],
          [0.25, -0.02],
          [0.65, 0.1],
          [1.15, 0.06],
        ],
        widthM: 7,
        crossings: [
          { kind: "ford", frac: 0.3, lengthM: 8 },
          { kind: "bridge", frac: 0.72, lengthM: 7 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [0.02, -1.15],
          [0.3, -0.5],
          [0.52, 0.03],
          [0.3, 0.5],
          [0.02, 1.15],
        ],
        widthM: 3.5,
      },
    ],
    props: [
      { asset: "pine", at: [-0.55, -0.3] },
      { asset: "pine", at: [-0.66, -0.2], tier: 1 },
      { asset: "pine", at: [-0.46, -0.18], tier: 1 },
      { asset: "pine", at: [0.32, -0.32] },
      { asset: "pine", at: [0.42, -0.22], tier: 1 },
      { asset: "cabin", at: [0.16, -0.3] },
      { asset: "rock", at: [0.75, -0.36] },
      { asset: "rock", at: [-0.6, -0.5], tier: 2 },
      { asset: "log", at: [-0.2, -0.62], tier: 1 },
      { asset: "log", at: [0.55, -0.56], tier: 2 },
      { asset: "drift", at: [-0.06, -0.24], tier: 1 },
      { asset: "pine", at: [-0.85, -0.7], tier: 2 },
    ],
  },
  {
    id: "wadi-crossing",
    biome: "desert",
    name: "Wadi Crossing",
    brief:
      "A dry wadi cuts the sand corner to corner. Dune ridges wall the flanks, a ford sits at the centre bend and the convoy road takes the bridge.",
    rivers: [
      {
        points: [
          [-1.15, -0.55],
          [-0.55, -0.3],
          [-0.1, -0.05],
          [0.3, 0.12],
          [0.7, 0.4],
          [1.15, 0.75],
        ],
        widthM: 6,
        crossings: [
          { kind: "ford", frac: 0.42, lengthM: 8 },
          { kind: "bridge", frac: 0.7, lengthM: 7 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [0.05, -1.15],
          [0.35, -0.55],
          [0.62, 0.27],
          [0.4, 0.62],
          [0.05, 1.15],
        ],
        widthM: 4,
      },
    ],
    props: [
      { asset: "dune", at: [-0.45, -0.78], halfW: 9, halfL: 3 },
      { asset: "dune", at: [0.6, -0.36], halfW: 7, halfL: 2.6 },
      { asset: "outcrop", at: [-0.3, -0.3] },
      { asset: "palms", at: [-0.26, 0.2] },
      { asset: "adobe", at: [0.74, -0.62] },
      { asset: "adobe", at: [0.84, -0.46], tier: 1 },
      { asset: "adobe", at: [0.62, -0.44], tier: 1 },
      { asset: "scrub", at: [0.35, -0.5], tier: 1 },
      { asset: "scrub", at: [-0.72, -0.05], tier: 1 },
      { asset: "berm", at: [0.1, -0.64], tier: 1 },
      { asset: "truck", at: [0.42, 0.0], tier: 1 },
      { asset: "outcrop", at: [-0.9, -0.5], tier: 2 },
      { asset: "scrub", at: [-0.05, -0.85], tier: 2 },
    ],
  },
  {
    id: "river-bend",
    biome: "jungle",
    name: "River Bend",
    brief:
      "A wide brown river bends through the middle. The ford at the bend is the fight; the stone bridge west is the flank. Bush walls make lanes, ruins hold the ford.",
    rivers: [
      {
        points: [
          [-1.15, -0.32],
          [-0.6, -0.38],
          [-0.15, -0.05],
          [0.35, 0.28],
          [0.7, 0.3],
          [1.15, 0.2],
        ],
        widthM: 9,
        crossings: [
          { kind: "bridge", frac: 0.18, lengthM: 8 },
          { kind: "ford", frac: 0.5, lengthM: 10 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [-0.1, -1.15],
          [-0.4, -0.7],
          [-0.72, -0.37],
          [-0.5, 0.2],
          [-0.1, 1.15],
        ],
        widthM: 3,
      },
    ],
    props: [
      { asset: "bush", at: [-0.35, -0.62] },
      { asset: "bush", at: [-0.47, -0.5], tier: 1 },
      { asset: "bush", at: [0.3, -0.58] },
      { asset: "bush", at: [0.42, -0.46], tier: 1 },
      { asset: "ruin", at: [-0.22, -0.34] },
      { asset: "hut", at: [0.66, -0.48] },
      { asset: "hut", at: [0.78, -0.3], tier: 1 },
      { asset: "hut", at: [0.55, -0.28], tier: 1 },
      { asset: "palms", at: [-0.72, -0.12], tier: 1 },
      { asset: "boulder", at: [0.14, -0.72], tier: 1 },
      { asset: "log", at: [-0.2, -0.82], tier: 2 },
      { asset: "palms", at: [0.9, -0.7], tier: 2 },
      { asset: "bush", at: [-0.85, -0.65], tier: 2 },
    ],
  },
  {
    id: "logging-road",
    biome: "forest",
    name: "Logging Road",
    brief:
      "A dirt road runs spawn to spawn over a plank bridge. Oak lines make the road a corridor; stone walls and a barn hold the fields either side. Two fords for the patient.",
    rivers: [
      {
        points: [
          [-1.15, 0.2],
          [-0.7, 0.1],
          [-0.3, 0.16],
          [0.1, 0.04],
          [0.5, -0.08],
          [1.15, -0.14],
        ],
        widthM: 4,
        crossings: [
          { kind: "ford", frac: 0.2, lengthM: 7 },
          { kind: "bridge", frac: 0.5, lengthM: 6 },
          { kind: "ford", frac: 0.82, lengthM: 7 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [0, -1.15],
          [0.02, -0.5],
          [0, 0.08],
          [-0.02, 0.5],
          [0, 1.15],
        ],
        widthM: 4,
      },
    ],
    props: [
      { asset: "oak", at: [-0.16, -0.36] },
      { asset: "oak", at: [0.16, -0.36] },
      { asset: "oak", at: [-0.16, -0.58], tier: 1 },
      { asset: "oak", at: [0.16, -0.58], tier: 1 },
      { asset: "wall", at: [-0.5, -0.3], halfW: 6, halfL: 0.8 },
      { asset: "wall", at: [0.5, -0.3], halfW: 5, halfL: 0.8, tier: 1 },
      { asset: "barn", at: [0.62, -0.52], tier: 1 },
      { asset: "cabin", at: [-0.62, -0.55], tier: 1 },
      { asset: "hedge", at: [0.45, -0.66], tier: 2 },
      { asset: "pine", at: [-0.8, -0.25], tier: 1 },
      { asset: "pine", at: [-0.88, -0.36], tier: 2 },
      { asset: "boulder", at: [0.3, -0.18] },
      { asset: "log", at: [-0.36, -0.62], tier: 2 },
    ],
  },
  {
    id: "canal-district",
    biome: "urban",
    name: "Canal District",
    brief:
      "A stone canal cuts the district. Two bridges, each at the end of a street. Blocks make the streets, sandbags and hedgehogs guard the bridge heads.",
    rivers: [
      {
        points: [
          [-1.15, 0.06],
          [-0.4, 0.06],
          [0.4, 0.06],
          [1.15, 0.06],
        ],
        widthM: 6,
        crossings: [
          { kind: "bridge", frac: 0.37, lengthM: 8 },
          { kind: "bridge", frac: 0.63, lengthM: 8 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [-0.3, -1.15],
          [-0.3, 1.15],
        ],
        widthM: 5,
      },
      {
        points: [
          [0.3, -1.15],
          [0.3, 1.15],
        ],
        widthM: 5,
      },
      {
        points: [
          [-1.15, -0.5],
          [1.15, -0.5],
        ],
        widthM: 5,
      },
      {
        points: [
          [-1.15, 0.5],
          [1.15, 0.5],
        ],
        widthM: 5,
      },
    ],
    props: [
      { asset: "block", at: [-0.6, -0.3] },
      { asset: "block", at: [0.6, -0.3] },
      { asset: "block", at: [0, -0.24], halfW: 9, halfL: 6, only: ["medium", "large", "xlarge"] },
      { asset: "truck", at: [0, -0.16], only: ["small"] },
      { asset: "block", at: [-0.6, -0.74], tier: 1, halfW: 9, halfL: 5 },
      { asset: "block", at: [0.6, -0.74], tier: 1, halfW: 9, halfL: 5 },
      { asset: "house", at: [-0.88, -0.1], tier: 1 },
      { asset: "sandbags", at: [-0.42, -0.14], tier: 1 },
      { asset: "hedgehog", at: [-0.19, -0.14], tier: 1 },
      { asset: "rubble", at: [0.1, -0.12], tier: 1 },
      { asset: "truck", at: [0.45, -0.62], tier: 1 },
      { asset: "crater", at: [-0.2, -0.62], tier: 2 },
      { asset: "crater", at: [0.36, -0.14], tier: 2 },
      { asset: "house", at: [0.88, -0.62], tier: 2 },
    ],
  },
  {
    id: "peat-cut",
    biome: "marsh",
    name: "Peat Cut",
    brief: "A wet cut with one board walk. Reeds hide both approaches. Dikework holds the flanks.",
    rivers: [
      {
        points: [
          [-1.15, 0.08],
          [-0.4, 0.04],
          [0.3, -0.04],
          [1.15, -0.08],
        ],
        widthM: 5,
        crossings: [
          { kind: "ford", frac: 0.28, lengthM: 8 },
          { kind: "bridge", frac: 0.52, lengthM: 7 },
          { kind: "ford", frac: 0.78, lengthM: 8 },
        ],
      },
    ],
    roads: [],
    props: [
      { asset: "reed", at: [-0.22, -0.28] },
      { asset: "reed", at: [0.22, -0.28] },
      { asset: "dike", at: [-0.55, -0.22], halfW: 6, halfL: 1.4 },
      { asset: "dike", at: [0.55, -0.22], halfW: 6, halfL: 1.4 },
      { asset: "hut", at: [0.62, -0.5], tier: 1 },
      { asset: "stump", at: [-0.14, -0.5], tier: 1 },
      { asset: "log", at: [0.1, -0.62], tier: 2 },
      { asset: "reed", at: [-0.72, -0.48], tier: 1 },
    ],
  },
  {
    id: "grain-cut",
    biome: "steppe",
    name: "Grain Cut",
    brief: "Open grass with a dirt road over a timber bridge. Hay and a barn mark the farm. A rail cut is a track trap.",
    rivers: [
      {
        points: [
          [-1.15, 0.12],
          [-0.2, 0.04],
          [0.4, -0.04],
          [1.15, -0.1],
        ],
        widthM: 4,
        crossings: [
          { kind: "ford", frac: 0.25, lengthM: 8 },
          { kind: "bridge", frac: 0.5, lengthM: 6 },
          { kind: "ford", frac: 0.78, lengthM: 8 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [0, -1.15],
          [0, 1.15],
        ],
        widthM: 4,
      },
    ],
    props: [
      { asset: "hay", at: [-0.4, -0.36] },
      { asset: "hay", at: [0.4, -0.36] },
      { asset: "barn", at: [0.58, -0.55], tier: 1 },
      { asset: "cabin", at: [-0.58, -0.52], tier: 1 },
      { asset: "rail", at: [0.22, -0.18], tier: 1 },
      { asset: "scrub", at: [-0.18, -0.62], tier: 1 },
      { asset: "boulder", at: [0.72, -0.22], tier: 2 },
    ],
  },
  {
    id: "seawall",
    biome: "coast",
    name: "Seawall",
    brief: "A seawall and dunes face a wet cut. Bunkers and wire hold the beach. One pier spans the water.",
    rivers: [
      {
        points: [
          [-1.15, 0.05],
          [-0.3, 0.05],
          [0.3, 0.05],
          [1.15, 0.05],
        ],
        widthM: 7,
        crossings: [
          { kind: "bridge", frac: 0.5, lengthM: 9 },
          { kind: "ford", frac: 0.22, lengthM: 9 },
          { kind: "ford", frac: 0.78, lengthM: 9 },
        ],
      },
    ],
    roads: [],
    props: [
      { asset: "seawall", at: [0, -0.22], halfW: 8, halfL: 1.1 },
      { asset: "dune", at: [-0.55, -0.42] },
      { asset: "dune", at: [0.55, -0.42] },
      { asset: "bunker", at: [-0.28, -0.16], tier: 1 },
      { asset: "hedgehog", at: [0.18, -0.16], tier: 1 },
      { asset: "sandbags", at: [-0.12, -0.32], tier: 1 },
      { asset: "boat", at: [0.7, -0.18], tier: 2 },
      { asset: "scrub", at: [-0.72, -0.28], tier: 1 },
    ],
  },
  {
    id: "sidings",
    biome: "industrial",
    name: "Sidings",
    brief: "Workshops and silos flank a canal. Rails trap tracks. A yard bridge is the only honest crossing.",
    rivers: [
      {
        points: [
          [-1.15, 0.06],
          [0, 0.06],
          [1.15, 0.06],
        ],
        widthM: 6,
        crossings: [
          { kind: "bridge", frac: 0.5, lengthM: 8 },
          { kind: "ford", frac: 0.24, lengthM: 8 },
          { kind: "ford", frac: 0.76, lengthM: 8 },
        ],
      },
    ],
    roads: [
      {
        points: [
          [0, -1.15],
          [0, 1.15],
        ],
        widthM: 5,
      },
    ],
    props: [
      { asset: "factory", at: [-0.52, -0.36] },
      { asset: "factory", at: [0.52, -0.36] },
      { asset: "silo", at: [-0.22, -0.55], tier: 1 },
      { asset: "silo", at: [0.22, -0.55], tier: 1 },
      { asset: "rail", at: [0.32, -0.18], tier: 1 },
      { asset: "truck", at: [-0.12, -0.22] },
      { asset: "drums", at: [0.7, -0.5], tier: 2 },
      { asset: "barricade", at: [0, -0.14], tier: 1 },
    ],
  },
];

export function presetById(id: string): PresetSpec | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function presetForBiome(biome: BiomeId): PresetSpec | undefined {
  return PRESETS.find((p) => p.biome === biome);
}

function tierAllowed(size: MapSize, tier: number): boolean {
  if (size === "small") return tier === 0;
  if (size === "medium") return tier <= 1;
  return true;
}

/** Builds a LevelDoc from a preset at the given size. Deterministic ids. */
export function buildPreset(spec: PresetSpec, size: MapSize, name?: string): LevelDoc {
  const a = MAP_LAW.sizes[size].arenaM;
  const spawnY = MAP_LAW.sizes[size].spawnY;
  const props: LevelProp[] = [];
  let n = 0;
  const add = (p: PropSpec, sx: number, sy: number) => {
    const asset = biomeAsset(spec.biome, p.asset);
    if (!asset) return;
    props.push({
      id: `${p.asset}-${n++}`,
      asset: p.asset,
      x: T(p.at[0] * a * sx),
      y: T(p.at[1] * a * sy),
      halfW: p.halfW ?? asset.halfW,
      halfL: p.halfL ?? asset.halfL,
      variant: p.variant ?? n % asset.variants,
    });
  };
  for (const p of spec.props) {
    if (!tierAllowed(size, p.tier ?? 0)) continue;
    if (p.only && !p.only.includes(size)) continue;
    add(p, 1, 1);
    if (p.mirror !== false) add(p, -1, -1);
  }
  const rivers: LevelRiver[] = spec.rivers.map((r, i) => {
    const widthM = Math.max(
      RIVER_LAW.minWidthM,
      Math.min(RIVER_LAW.maxWidthM, T(r.widthM * PRESET_LAW.riverWidthMul[size])),
    );
    const doc: LevelRiver = {
      id: `river-${i}`,
      points: r.points.map(([fx, fy]) => ({ x: T(fx * a), y: T(fy * a) })),
      widthM,
      crossings: [],
    };
    const len = riverLengthM(riverGeometry(doc));
    doc.crossings = r.crossings.map((c, k) => ({
      id: `x-${i}-${k}`,
      kind: c.kind,
      atM: T(c.frac * len),
      lengthM: Math.max(RIVER_LAW.minCrossingM, Math.min(RIVER_LAW.maxCrossingM, c.lengthM ?? 8)),
    }));
    return doc;
  });
  const roads: LevelRoad[] = spec.roads.map((r, i) => ({
    id: `road-${i}`,
    points: r.points.map(([fx, fy]) => ({ x: T(fx * a), y: T(fy * a) })),
    widthM: r.widthM,
  }));
  return {
    version: LEVEL_LAW.docVersion,
    id: `${spec.id}-${size}-${Math.random().toString(36).slice(2, 7)}`,
    name: name ?? spec.name,
    biome: spec.biome,
    size,
    spawns: {
      player: { x: 0, y: -spawnY, yawDeg: 0 },
      dummy: { x: 0, y: spawnY, yawDeg: 180 },
    },
    props,
    rivers,
    roads,
    updatedAt: Date.now(),
  };
}
