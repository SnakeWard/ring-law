import type { HullInstance } from "./hull.ts";
import type { TurretInstance } from "./turret.ts";
import type { WeaponInstance } from "./weapon.ts";

/**
 * AUTO GUN LAW v1 — secondary rings fire on their own.
 *
 * Main gun kills. Port/starboard MG rings (T-28 and kin) auto-track with
 * a lead, fire independently, and can pin a track on a small chance even
 * when they bounce. Coax stays slaved and does not get a second trigger.
 * MG does not chip hull HP — disable only.
 */
export const AUTO_GUN_LAW = {
  version: 1,
  frozenAt: "2026-09-15",
  evidence: "assumed" as const,
  predictive: true,
  projectileMps: 92,
  reloadS: 0.48,
  aimOkDeg: 6,
  trackChance: 0.09,
  bounceCanTrack: true,
  damageHp: 0,
} as const;

export function autoGunTurrets(hull: HullInstance): TurretInstance[] {
  return hull.turrets.filter((t) => t.role !== "main" && t.state === "live");
}

export function autoGunWeapon(
  hull: HullInstance,
  turret: TurretInstance,
): WeaponInstance | undefined {
  return hull.weapons.find(
    (w) => w.turretId === turret.id && w.kind === "mg" && !w.slavedToWeaponId,
  );
}

export function leadPoint(
  fromX: number,
  fromY: number,
  tx: number,
  ty: number,
  tvx: number,
  tvy: number,
  shotMps: number = AUTO_GUN_LAW.projectileMps,
): { x: number; y: number } {
  const dist = Math.hypot(tx - fromX, ty - fromY);
  const t = shotMps > 1 ? dist / shotMps : 0;
  return { x: tx + tvx * t, y: ty + tvy * t };
}

export function tryMgTrack(
  host: { tracked: boolean },
  rng: () => number = Math.random,
): boolean {
  if (host.tracked) return false;
  if (rng() >= AUTO_GUN_LAW.trackChance) return false;
  host.tracked = true;
  return true;
}
