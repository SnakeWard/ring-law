import type { NationId } from "./enums.ts";
import type { BiomeId } from "./biomes.ts";

/**
 * CAMO LAW v1 — nation style × theater paint.
 *
 * The hull PNG is the plate. Camo is a read-only overlay keyed by nation and
 * environment. Germany paints Hinterhalt blobs and disks (Pz IV / Jagdtiger).
 * USA paints large NATO / MERDC blocks (Leopard-family language).
 * USSR paints elongated 3-tone amoeba. Same theater, three different schemes.
 */
export const CAMO_LAW = {
  version: 1,
  frozenAt: "2026-09-17",
  evidence: "assumed" as const,
  tilePx: 256,
  /** Midtone replacement strength. Tracks and deep shade stay dark. */
  strength: 0.88,
  styles: {
    usa: "block",
    ussr: "amoeba",
    germany: "ambush",
  } as const,
  deferred: [
    "Player-picked scheme independent of the map",
    "Decal / turret numbers on top of camo",
    "Worn winter wash that flakes mid-match",
  ],
} as const;

export const CAMO_ENVS = [
  "dirt",
  "snow",
  "urban",
  "jungle",
  "forest",
  "desert",
] as const;
export type CamoEnv = (typeof CAMO_ENVS)[number];
export type CamoStyle = "ambush" | "block" | "amoeba";

export type CamoRgb = readonly [number, number, number];

export type CamoScheme = {
  nation: NationId;
  env: CamoEnv;
  style: CamoStyle;
  name: string;
  /** First swatch is the field colour. Later swatches are patches. */
  colors: readonly CamoRgb[];
};

const MAP_ENV: Record<string, CamoEnv> = {
  range: "dirt",
  snow: "snow",
  urban: "urban",
  tropical: "jungle",
  mountains: "forest",
  quarry: "desert",
  siberia: "snow",
};

const BIOME_ENV: Record<BiomeId, CamoEnv> = {
  snow: "snow",
  desert: "desert",
  jungle: "jungle",
  forest: "forest",
  urban: "urban",
};

const SCHEMES: Record<NationId, Record<CamoEnv, Omit<CamoScheme, "nation" | "env" | "style">>> = {
  germany: {
    dirt: {
      name: "Hinterhalt",
      colors: [
        [196, 158, 74],
        [74, 92, 46],
        [92, 62, 36],
        [48, 44, 34],
      ],
    },
    snow: {
      name: "Wintertarn",
      colors: [
        [228, 226, 216],
        [92, 102, 72],
        [106, 84, 62],
      ],
    },
    urban: {
      name: "Trümmer",
      colors: [
        [138, 134, 124],
        [92, 84, 70],
        [74, 78, 64],
        [52, 50, 48],
      ],
    },
    jungle: {
      name: "Dschungel",
      colors: [
        [52, 68, 36],
        [36, 48, 28],
        [90, 62, 38],
      ],
    },
    forest: {
      name: "Buntfarben",
      colors: [
        [74, 92, 46],
        [196, 158, 74],
        [104, 72, 40],
        [44, 48, 32],
      ],
    },
    desert: {
      name: "Dunkelgelb",
      colors: [
        [210, 176, 92],
        [186, 148, 64],
        [96, 108, 52],
      ],
    },
  },
  usa: {
    dirt: {
      name: "Olive drab",
      colors: [
        [74, 90, 50],
        [48, 62, 36],
        [90, 78, 48],
      ],
    },
    snow: {
      name: "Winter",
      colors: [
        [230, 232, 226],
        [90, 104, 72],
        [138, 140, 136],
      ],
    },
    urban: {
      name: "Urban MERDC",
      colors: [
        [122, 124, 118],
        [74, 82, 56],
        [42, 44, 40],
      ],
    },
    jungle: {
      name: "ERDL",
      colors: [
        [90, 108, 52],
        [44, 56, 32],
        [106, 74, 44],
        [36, 38, 32],
      ],
    },
    forest: {
      name: "Woodland",
      colors: [
        [60, 74, 42],
        [106, 78, 46],
        [42, 44, 40],
        [184, 168, 120],
      ],
    },
    desert: {
      name: "3-color desert",
      colors: [
        [196, 174, 120],
        [138, 106, 64],
        [212, 196, 154],
      ],
    },
  },
  ussr: {
    dirt: {
      name: "4BO",
      colors: [
        [90, 104, 64],
        [92, 74, 48],
        [56, 64, 44],
      ],
    },
    snow: {
      name: "Winterwash",
      colors: [
        [226, 228, 220],
        [90, 104, 64],
        [120, 118, 108],
      ],
    },
    urban: {
      name: "Zavod grey",
      colors: [
        [106, 112, 96],
        [58, 64, 56],
        [90, 76, 60],
      ],
    },
    jungle: {
      name: "Tropik",
      colors: [
        [58, 74, 40],
        [92, 64, 44],
        [40, 52, 32],
      ],
    },
    forest: {
      name: "3-tone",
      colors: [
        [74, 92, 52],
        [106, 80, 48],
        [184, 160, 96],
      ],
    },
    desert: {
      name: "Pesok",
      colors: [
        [200, 176, 112],
        [90, 104, 64],
        [212, 200, 160],
      ],
    },
  },
};

export function camoStyleOf(nation: NationId): CamoStyle {
  return CAMO_LAW.styles[nation];
}

export function camoEnvForMap(map: { id: string; biome?: string }): CamoEnv {
  const biome = map.biome as BiomeId | undefined;
  if (biome && biome in BIOME_ENV) return BIOME_ENV[biome];
  return MAP_ENV[map.id] ?? "dirt";
}

export function camoScheme(nation: NationId, env: CamoEnv): CamoScheme {
  const row = SCHEMES[nation][env];
  return {
    nation,
    env,
    style: camoStyleOf(nation),
    name: row.name,
    colors: row.colors,
  };
}

export function allCamoSchemes(): CamoScheme[] {
  const out: CamoScheme[] = [];
  for (const nation of Object.keys(SCHEMES) as NationId[]) {
    for (const env of CAMO_ENVS) out.push(camoScheme(nation, env));
  }
  return out;
}
