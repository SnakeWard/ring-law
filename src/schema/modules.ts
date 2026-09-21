import type { HullBlueprint } from "./hull.ts";
import { nodeByHull } from "./tree.ts";

export const MODULE_SLOTS = ["tracks", "engine", "gun", "optics"] as const;
export type ModuleSlot = (typeof MODULE_SLOTS)[number];

export const MODULE_LAW = {
  version: 1,
  frozenAt: "2026-09-21",
  evidence: "assumed" as const,
  yawMul: 1.12,
  speedMul: 1.1,
  engineIdleBump: 0.08,
  penMul: 1.08,
  reloadMul: 0.92,
  opticsMul: 1.14,
  xpPerTier: 400,
  labels: {
    tracks: { name: "Wider tracks", blurb: "+12% hull traverse" },
    engine: { name: "Tuned engine", blurb: "+10% speed, hotter idle" },
    gun: { name: "Improved AP", blurb: "+8% pen, faster reload" },
    optics: { name: "Calibrated optics", blurb: "+14% spot range" },
  },
} as const;

export function moduleCost(hullId: string): number {
  const tier = nodeByHull(hullId)?.tier ?? 1;
  return MODULE_LAW.xpPerTier * Math.max(1, tier);
}

export function hullModules(modules: Record<string, string[]> | undefined, hullId: string): ModuleSlot[] {
  const raw = modules?.[hullId] ?? [];
  return MODULE_SLOTS.filter((s) => raw.includes(s));
}

export function hasModule(
  modules: Record<string, string[]> | undefined,
  hullId: string,
  slot: ModuleSlot,
): boolean {
  return (modules?.[hullId] ?? []).includes(slot);
}

export function applyFit(bp: HullBlueprint, slots: readonly string[]): HullBlueprint {
  const fitted = new Set(slots);
  let yaw = bp.hullYawRateDegPerSec;
  let speed = bp.forwardSpeedMps;
  let engine = bp.defaultEngineNorm;
  if (fitted.has("tracks")) yaw *= MODULE_LAW.yawMul;
  if (fitted.has("engine")) {
    speed *= MODULE_LAW.speedMul;
    engine = Math.min(1, engine + MODULE_LAW.engineIdleBump);
  }
  const weapons = bp.weapons.map((w) => {
    if (!fitted.has("gun")) return w;
    if (w.kind !== "main_gun" && w.kind !== "howitzer") return w;
    return { ...w, penMm: Math.round(w.penMm * MODULE_LAW.penMul) };
  });
  const turrets = bp.turrets.map((t) => {
    if (!fitted.has("tracks") || t.role !== "main") return t;
    return { ...t, traverseRateDegPerSec: t.traverseRateDegPerSec * 1.06 };
  });
  return {
    ...bp,
    hullYawRateDegPerSec: yaw,
    forwardSpeedMps: speed,
    defaultEngineNorm: engine,
    weapons,
    turrets,
  };
}

export function parseModules(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [hullId, slots] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(slots)) continue;
    const clean = MODULE_SLOTS.filter((s) => slots.includes(s));
    if (clean.length) out[hullId] = clean;
  }
  return out;
}
