import { z } from "zod";
import { WEAPON_KINDS, WEAPON_MOUNTS, WEAPON_STATES } from "./enums.ts";

export type { WeaponKind, WeaponMount, WeaponState } from "./enums.ts";

/**
 * A firing device. Never a turret — even when it has an arc.
 * Ball mounts, sponsons, coax, M20 offset, and pintles stay here.
 */
export const weaponBlueprintSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(WEAPON_KINDS),
  mount: z.enum(WEAPON_MOUNTS),
  /** Null unless this weapon sits on a TurretInstance. */
  turretId: z.string().nullable(),
  caliberMm: z.number().positive(),
  /** Assumed AP penetration at PEN_LAW.rangeM. */
  penMm: z.number().nonnegative(),
  damageHp: z.number().nonnegative(),
  /** Hull- or turret-relative fire arc. Fixed sponsons use 0/0. */
  arcMinDeg: z.number(),
  arcMaxDeg: z.number(),
  elevationMinDeg: z.number(),
  elevationMaxDeg: z.number(),
  /**
   * Extra aim inside a turret without being a second ring (M2A4 M20 ±10).
   * Not a TurretInstance.
   */
  mountTraverseDeg: z.number().nonnegative(),
  /** Coax and similar inherit facing from this weapon id. */
  slavedToWeaponId: z.string().nullable(),
  offsetForwardM: z.number(),
  offsetRightM: z.number(),
  notes: z.string(),
});

export const weaponInstanceSchema = weaponBlueprintSchema.extend({
  parentHullId: z.string().min(1),
  facingDeg: z.number(),
  state: z.enum(WEAPON_STATES),
});

export type WeaponBlueprint = z.infer<typeof weaponBlueprintSchema>;
export type WeaponInstance = z.infer<typeof weaponInstanceSchema>;

export function instantiateWeapon(
  parentHullId: string,
  bp: WeaponBlueprint,
): WeaponInstance {
  return {
    ...bp,
    parentHullId,
    facingDeg: 0,
    state: "live",
  };
}

export function weaponCanFire(state: WeaponInstance["state"]): boolean {
  return state === "live" || state === "jammed";
}

/** Classification law: a weapon is never a turret. */
export function weaponIsTurret(_weapon: WeaponInstance): false {
  return false;
}
