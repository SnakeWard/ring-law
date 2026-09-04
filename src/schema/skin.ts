import { CATALOG_HULLS } from "./catalog.ts";

/**
 * SKIN LAW v5 — hull PNG yaw-locked, turret PNG per ring pivot.
 * Casemate hulls bake the gun into the hull PNG (not a ring).
 * PNG +Y is nose / barrel. Canvas rotates by −yawDeg (Y-down).
 * v5 leftover unique aliases: T-28E turrets, T-34-85 hull, T-44-100.
 */
export const SKIN_LAW = {
  version: 5,
  frozenAt: "2026-09-04",
  evidence: "real" as const,
  art: true,
  split:
    "Hull PNG rotates with hull yaw. Each turret PNG rotates on its ring pivot. Casemate is hull PNG — leftover does not promote a ring.",
  forward: "PNG +Y is hull nose / gun barrel. Renderer rotates by -yawDeg.",
  cover: ["bush", "wreck"] as const,
  floor: "dirt" as const,
  uniqueFamilies: [
    "m5-stuart",
    "m4a3e8",
    "m46-patton",
    "m47-patton",
    "m48-patton",
    "t-28e",
    "t-34-85",
    "t-44",
    "t-44-100",
    "t-54b",
    "t-62",
    "t-64a",
    "panther-g",
    "panther-f",
    "e-50",
    "e-75",
    "standardpanzer",
  ] as const,
} as const;

export type SkinSet = {
  hull: string;
  turrets: Record<string, string>;
  casemate: boolean;
};

const H = (dir: string) => `/skins/${dir}/hull.png`;
const T = (dir: string, file: string) => `/skins/${dir}/${file}.png`;

function ring(dir: string, turretId: string, file: string): SkinSet {
  return { hull: H(dir), turrets: { [turretId]: T(dir, file) }, casemate: false };
}

function rings(dir: string, hull = H(dir), map: Record<string, string>): SkinSet {
  return { hull, turrets: map, casemate: false };
}

function caseHull(dir: string): SkinSet {
  return { hull: H(dir), turrets: {}, casemate: true };
}

/** Unique art plus family aliases. Every catalog hullId has a row. */
export const SKINS: Record<string, SkinSet> = {
  m2a4: ring("m2a4", "m2a4-main", "m2a4-main"),
  "m3-stuart": ring("m3-stuart", "m3-main", "m3-main"),
  "m5-stuart": ring("m5-stuart", "m5-main", "m5-main"),
  "m24-chaffee": ring("m24-chaffee", "m24-main", "m24-main"),
  "m4a3-sherman": ring("m4a3-sherman", "m4a3-main", "m4a3-main"),
  "m4a3e8": ring("m4a3e8", "m4a3e8-main", "m4a3e8-main"),
  "m26-pershing": ring("m26-pershing", "m26-pershing-main", "m26-pershing-main"),
  "m46-patton": ring("m46-patton", "m46-patton-main", "m46-patton-main"),
  "m47-patton": ring("m47-patton", "m47-patton-main", "m47-patton-main"),
  "m48-patton": ring("m48-patton", "m48-patton-main", "m48-patton-main"),

  "t-28": rings("t-28", H("t-28"), {
    "t28-main": T("t-28", "t28-main"),
    "t28-mg-port": T("t-28", "t28-mg"),
    "t28-mg-starboard": T("t-28", "t28-mg"),
  }),
  "t-28e": rings("t-28e", H("t-28e"), {
    "t28e-main": T("t-28e", "t28e-main"),
    "t28e-mg-port": T("t-28e", "t28e-mg"),
    "t28e-mg-starboard": T("t-28e", "t28e-mg"),
  }),
  "t-34": ring("t-34", "t34-main", "t34-main"),
  "t-34-85": ring("t-34-85", "t3485-main", "t3485-main"),
  "t-44": ring("t-44", "t44-main", "t44-main"),
  "t-44-100": ring("t-44-100", "t-44-100-main", "t-44-100-main"),
  "t-54": ring("t-54", "t-54-main", "t-54-main"),
  "t-54b": ring("t-54b", "t-54b-main", "t-54b-main"),
  "t-62": ring("t-62", "t-62-main", "t-62-main"),
  "t-64a": ring("t-64a", "t-64a-main", "t-64a-main"),

  "tiger-i": ring("tiger-i", "tiger-main", "tiger-main"),
  "tiger-ii": ring("tiger-ii", "tiger-ii-main", "tiger-ii-main"),
  panther: ring("panther", "panther-main", "panther-main"),
  "panther-g": ring("panther-g", "panther-g-main", "panther-g-main"),
  "panther-f": ring("panther-f", "panther-f-main", "panther-f-main"),
  "e-50": ring("e-50", "e-50-main", "e-50-main"),
  "e-75": ring("e-75", "e-75-main", "e-75-main"),
  standardpanzer: ring("standardpanzer", "standardpanzer-main", "standardpanzer-main"),
  "leopard-1": ring("leopard-1", "leopard-1-main", "leopard-1-main"),

  jagdpanther: caseHull("jagdpanther"),
  "m7-priest": caseHull("m7-priest"),
  "su-76": caseHull("su-76"),
  wespe: caseHull("wespe"),
};

export const COVER_SKINS = {
  bush: "/skins/cover/bush.png",
  wreck: "/skins/cover/wreck.png",
} as const;

export const FLOOR_SKIN = "/skins/cover/dirt.png";
export const FLOOR_TILE_M = 8;

export function skinFor(hullId: string): SkinSet | undefined {
  return SKINS[hullId];
}

export function assertSkinCoverage(hullIds: readonly string[] = CATALOG_HULLS.map((h) => h.id)): string[] {
  const errors: string[] = [];
  for (const id of hullIds) {
    const s = SKINS[id];
    if (!s) errors.push(`${id}: missing skin`);
    else if (!s.hull) errors.push(`${id}: missing hull png`);
  }
  return errors;
}
