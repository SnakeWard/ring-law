import type { ShotSpec } from "./armor.ts";
import { HE_LAW } from "./he.ts";

export const ROUND_KINDS = ["ap", "apcr", "he"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

/**
 * APCR LAW — frozen 2026-09-03.
 *
 * Tungsten APCR is a silver round. Not researched. Not XP.
 * Dummy plate stays on AP. Broke fire falls back to AP.
 * Pen multiplier is assumed 100 m, not a WoT dump.
 */
export const APCR_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  penMul: 1.35,
  damageMul: 1,
  shotCost: 250,
  researchCost: null,
  dummyRound: "ap" as RoundKind,
  fallback: "ap" as RoundKind,
  deferred: [
    "Gold / free-XP ammo",
    "Per-hull APCR table",
    "Damage drop vs AP",
  ],
} as const;

export function roundShot(ap: ShotSpec, round: RoundKind): ShotSpec {
  if (round === "apcr") {
    return {
      penMm: ap.penMm * APCR_LAW.penMul,
      damageHp: ap.damageHp * APCR_LAW.damageMul,
      caliberMm: ap.caliberMm,
    };
  }
  return ap;
}

export function nextRound(round: RoundKind): RoundKind {
  if (round === "ap") return "apcr";
  if (round === "apcr") return "he";
  return "ap";
}

export function canAffordApcr(credits: number): boolean {
  return credits >= APCR_LAW.shotCost;
}

/** Spend silver for APCR / HE. Broke fire falls back to AP. */
export function spendRound(credits: number, want: RoundKind): { credits: number; round: RoundKind } {
  if (want === "apcr") {
    if (credits < APCR_LAW.shotCost) return { credits, round: APCR_LAW.fallback };
    return { credits: credits - APCR_LAW.shotCost, round: "apcr" };
  }
  if (want === "he") {
    if (credits < HE_LAW.shotCost) return { credits, round: HE_LAW.fallback };
    return { credits: credits - HE_LAW.shotCost, round: "he" };
  }
  return { credits, round: "ap" };
}

export function spendApcr(credits: number, want: RoundKind): { credits: number; round: RoundKind } {
  return spendRound(credits, want);
}
