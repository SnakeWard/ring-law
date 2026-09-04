import { locateFacet, facetPlate, type ArmorHost, type ArmorLayout, type HitReport } from "./armor.ts";

/**
 * HE LAW — frozen 2026-09-03.
 *
 * Cheap silver round. Never pens. Never overmatches.
 * A plate hit is a bounce that chips HP. No crit, cook, or track.
 * Dummy stays on AP. Broke fire falls back to AP.
 */
export const HE_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  shotCost: 80,
  researchCost: null,
  chipMul: 0.2,
  chipMin: 8,
  dummyRound: "ap" as const,
  fallback: "ap" as const,
  deferred: [
    "HE pen on paper-thin plates",
    "Splash radius / near-miss",
    "Gold HE",
    "Caliber-scaled chip",
  ],
} as const;

export function heChip(apDamageHp: number): number {
  return Math.max(HE_LAW.chipMin, Math.round(apDamageHp * HE_LAW.chipMul));
}

export function resolveHe(
  host: ArmorHost,
  armor: ArmorLayout,
  lengthM: number,
  hitX: number,
  hitY: number,
  apDamageHp: number,
): HitReport {
  const facet = locateFacet(host, lengthM, hitX, hitY);
  const pl = facetPlate(armor, facet);
  return {
    kind: "bounce",
    facet,
    nominalMm: pl.mm,
    effectiveMm: pl.mm,
    impactDeg: 0,
    damage: heChip(apDamageHp),
  };
}

export function formatHe(h: HitReport): string {
  const facet = h.facet.replaceAll("_", " ");
  return `HE CHIP ${facet} −${h.damage}`;
}
