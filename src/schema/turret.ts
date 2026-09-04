import { z } from "zod";
import { TURRET_DRIVES, TURRET_ROLES, TURRET_STATES } from "./enums.ts";

/** Independent traverse ring. This is the only object that is a turret. */
export const turretBlueprintSchema = z.object({
  id: z.string().min(1),
  role: z.enum(TURRET_ROLES),
  /** Hull-relative arc, degrees. Full-circle uses wrap=true. */
  arcMinDeg: z.number(),
  arcMaxDeg: z.number(),
  wrap: z.boolean(),
  /** First-loop rate. Hydraulic scales with hull.engineNorm at runtime. */
  traverseRateDegPerSec: z.number().positive(),
  drive: z.enum(TURRET_DRIVES),
  /** Offset from hull center, hull-local meters (forward +, right +). */
  offsetForwardM: z.number(),
  offsetRightM: z.number(),
  ringRadiusM: z.number().positive(),
  defaultWeaponId: z.string().min(1),
  notes: z.string(),
});

export const turretInstanceSchema = turretBlueprintSchema.extend({
  parentHullId: z.string().min(1),
  /** Hull-relative facing in degrees. World = hullYaw + facingDeg. */
  facingDeg: z.number(),
  state: z.enum(TURRET_STATES),
  weaponId: z.string().min(1),
  targetId: z.string().nullable(),
});

export type TurretBlueprint = z.infer<typeof turretBlueprintSchema>;
export type TurretInstance = z.infer<typeof turretInstanceSchema>;

export function instantiateTurret(
  parentHullId: string,
  bp: TurretBlueprint,
): TurretInstance {
  return {
    ...bp,
    parentHullId,
    facingDeg: 0,
    state: "live",
    weaponId: bp.defaultWeaponId,
    targetId: null,
  };
}

export function turretCanTraverse(state: TurretInstance["state"]): boolean {
  return state === "live";
}

export function turretCanFire(state: TurretInstance["state"]): boolean {
  return state === "live" || state === "jammed";
}

/** Green firing-solution reticle binds only to a live-or-jammed main ring. */
export function bindsGreenReticle(t: TurretInstance): boolean {
  return t.role === "main" && turretCanFire(t.state);
}
