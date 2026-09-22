import { firstCoverHit, type Cover } from "./cover.ts";
import type { WeaponBlueprint, WeaponInstance } from "./weapon.ts";

/**
 * HOWITZER LAW v7 — long-range lob.
 *
 * High-arc HE. Direct still uses leftover cone. Lob fires at a map point.
 * Chip, splash, and blast scale with caliber vs 105 mm baseline.
 * Direct: wrecks block. Lob: arc clears wrecks, hits still chip buildings.
 * Lob pan: the camera may scroll as far as max range so the gunner can see
 * the impact point. Edge, wheel, and right-drag. Not a free overview.
 */
export const HOWITZER_LAW = {
  version: 7,
  frozenAt: "2026-09-15",
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
  heChipHp: 150,
  reloadS: 7.5,
  parkedOffsetM: 1.5,
  flightTime: "planned" as const,
  lobReticle: true,
  lobPan: true,
  panSpeedMps: 52,
  panEdgeFrac: 0.18,
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
  return HOWITZER_LAW.blastRadiusM * Math.sqrt(caliberMm / HOWITZER_LAW.baselineCalMm);
}

/** Distance to the armored footprint, not its center: a bow hit is still a hit. */
export function howitzerHullDistance(ix: number, iy: number, hull: {
  x: number; y: number; yawDeg: number;
}, lengthM: number, widthM: number): number {
  const a = hull.yawDeg * Math.PI / 180;
  const dx = ix - hull.x, dy = iy - hull.y;
  const right = dx * Math.cos(a) + dy * Math.sin(a);
  const forward = -dx * Math.sin(a) + dy * Math.cos(a);
  return Math.hypot(Math.max(0, Math.abs(right) - widthM / 2), Math.max(0, Math.abs(forward) - lengthM / 2));
}

/** Larger shells trade their burst damage for a longer reload. */
export function howitzerReloadS(caliberMm: number): number {
  return HOWITZER_LAW.reloadS * Math.max(1, caliberMm / HOWITZER_LAW.baselineCalMm);
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

/** Look-at stays inside the gun's max range and the arena. */
export function clampLobLook(
  lookX: number,
  lookY: number,
  originX: number,
  originY: number,
  arenaM: number,
  maxRangeM: number = HOWITZER_LAW.maxRangeM,
): { x: number; y: number } {
  let x = lookX;
  let y = lookY;
  const dx = x - originX;
  const dy = y - originY;
  const dist = Math.hypot(dx, dy);
  if (dist > maxRangeM && dist > 1e-9) {
    const s = maxRangeM / dist;
    x = originX + dx * s;
    y = originY + dy * s;
  }
  const bound = Math.max(0, arenaM - 0.5);
  if (x > bound) x = bound;
  else if (x < -bound) x = -bound;
  if (y > bound) y = bound;
  else if (y < -bound) y = -bound;
  return { x, y };
}
