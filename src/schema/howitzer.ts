import { firstCoverHit, type Cover } from "./cover.ts";
import type { WeaponBlueprint, WeaponInstance } from "./weapon.ts";

/**
 * HOWITZER LAW v6 — long-range lob.
 *
 * High-arc HE. Direct still uses leftover cone. Lob fires at a map point.
 * Chip, splash, and blast scale with caliber vs 105 mm baseline.
 * Direct: wrecks block. Lob: arc clears wrecks, hits still chip buildings.
 */
export const HOWITZER_LAW = {
  version: 6,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  ammo: "he" as const,
  aimConeDeg: 8,
  minRangeM: 16,
  maxRangeM: 110,
  splashRadiusM: 8,
  blastRadiusM: 2,
  tankApCone: false,
  clearsBush: true,
  wreckBlocks: true,
  lobClearsWreck: true,
  baselineCalMm: 105,
  heChipHp: 50,
  reloadS: 7.5,
  parkedOffsetM: 1.5,
  flightTime: "planned" as const,
  lobReticle: true,
} as const;

export function isHowitzer(gun: Pick<WeaponBlueprint, "kind">): boolean {
  return gun.kind === "howitzer";
}

export function howitzerChipHp(caliberMm: number = HOWITZER_LAW.baselineCalMm): number {
  return Math.max(1, Math.round((HOWITZER_LAW.heChipHp * caliberMm) / HOWITZER_LAW.baselineCalMm));
}

export function howitzerSplashM(caliberMm: number = HOWITZER_LAW.baselineCalMm): number {
  return (HOWITZER_LAW.splashRadiusM * caliberMm) / HOWITZER_LAW.baselineCalMm;
}

export function howitzerBlastM(caliberMm: number = HOWITZER_LAW.baselineCalMm): number {
  return (HOWITZER_LAW.blastRadiusM * caliberMm) / HOWITZER_LAW.baselineCalMm;
}

export function howitzerMissM(distM: number, aimErrDeg: number): number {
  return distM * Math.tan((Math.abs(aimErrDeg) * Math.PI) / 180);
}

export function howitzerDamage(distM: number, aimErrDeg: number, caliberMm: number): number {
  if (distM < HOWITZER_LAW.minRangeM) return 0;
  if (distM > HOWITZER_LAW.maxRangeM) return 0;
  const miss = howitzerMissM(distM, aimErrDeg);
  const splash = howitzerSplashM(caliberMm);
  if (miss >= splash) return 0;
  return Math.max(0, Math.round(howitzerChipHp(caliberMm) * (1 - miss / splash)));
}

export function howitzerBlastDamage(distFromImpactM: number, caliberMm: number): number {
  const blast = howitzerBlastM(caliberMm);
  if (distFromImpactM >= blast) return 0;
  return Math.max(0, Math.round(howitzerChipHp(caliberMm) * (1 - distFromImpactM / blast)));
}

export function howitzerBlocked(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cover: readonly Cover[],
): Cover | null {
  return firstCoverHit(ax, ay, bx, by, cover, "shot");
}

export function howitzerCanFire(
  gun: Pick<WeaponInstance, "kind" | "state">,
  distM: number,
  aimErrDeg: number,
): boolean {
  if (!isHowitzer(gun)) return false;
  if (gun.state !== "live" && gun.state !== "jammed") return false;
  if (distM < HOWITZER_LAW.minRangeM) return false;
  if (distM > HOWITZER_LAW.maxRangeM) return false;
  return Math.abs(aimErrDeg) <= HOWITZER_LAW.aimConeDeg;
}

export function howitzerCanLob(
  gun: Pick<WeaponInstance, "kind" | "state">,
  distM: number,
): boolean {
  if (!isHowitzer(gun)) return false;
  if (gun.state !== "live" && gun.state !== "jammed") return false;
  return lobInRange(distM);
}

export function lobInRange(distM: number): boolean {
  return distM >= HOWITZER_LAW.minRangeM && distM <= HOWITZER_LAW.maxRangeM;
}
