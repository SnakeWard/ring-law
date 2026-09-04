import { z } from "zod";
import { HULL_CLASSES, NATIONS } from "./enums.ts";
import { armorSchema } from "./armor.ts";
import {
  instantiateTurret,
  turretBlueprintSchema,
  turretInstanceSchema,
  type TurretInstance,
} from "./turret.ts";
import {
  instantiateWeapon,
  weaponBlueprintSchema,
  weaponInstanceSchema,
  type WeaponInstance,
} from "./weapon.ts";

export const hullBlueprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  class: z.enum(HULL_CLASSES),
  nation: z.enum(NATIONS),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  hullYawRateDegPerSec: z.number().positive(),
  forwardSpeedMps: z.number().positive(),
  /** 0–1; hydraulic traverse scales with this at runtime. */
  defaultEngineNorm: z.number().min(0).max(1),
  hp: z.number().positive(),
  armor: armorSchema,
  /** Empty on casemate / SPG hulls. A casemate is not a ring. */
  turrets: z.array(turretBlueprintSchema),
  weapons: z.array(weaponBlueprintSchema).min(1),
  notes: z.string(),
});

export const hullInstanceSchema = z.object({
  id: z.string().min(1),
  blueprintId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  yawDeg: z.number(),
  engineNorm: z.number().min(0).max(1),
  hp: z.number(),
  hpMax: z.number().positive(),
  onFire: z.boolean(),
  tracked: z.boolean(),
  turrets: z.array(turretInstanceSchema),
  weapons: z.array(weaponInstanceSchema),
});

export type HullBlueprint = z.infer<typeof hullBlueprintSchema>;
export type HullInstance = z.infer<typeof hullInstanceSchema>;

export function instantiateHull(
  bp: HullBlueprint,
  spawn?: { id?: string; x: number; y: number; yawDeg: number },
): HullInstance {
  const id = spawn?.id ?? `${bp.id}-live`;
  return {
    id,
    blueprintId: bp.id,
    x: spawn?.x ?? 0,
    y: spawn?.y ?? 0,
    yawDeg: spawn?.yawDeg ?? 0,
    engineNorm: bp.defaultEngineNorm,
    hp: bp.hp,
    hpMax: bp.hp,
    onFire: false,
    tracked: false,
    turrets: bp.turrets.map((t) => instantiateTurret(id, t)),
    weapons: bp.weapons.map((w) => instantiateWeapon(id, w)),
  };
}

export function isCasemate(hull: { turrets: readonly unknown[] }): boolean {
  return hull.turrets.length === 0;
}

export function mainTurret(hull: HullInstance): TurretInstance | undefined {
  return hull.turrets.find((t) => t.role === "main");
}

export function casemateGun(hull: HullInstance): WeaponInstance | undefined {
  return hull.weapons.find(
    (w) =>
      w.mount === "hull_casemate" &&
      (w.kind === "main_gun" || w.kind === "howitzer"),
  );
}

export function mainGun(hull: HullInstance): WeaponInstance | undefined {
  const main = mainTurret(hull);
  if (main) {
    return (
      hull.weapons.find((w) => w.id === main.weaponId) ??
      hull.weapons.find((w) => w.kind === "main_gun")
    );
  }
  return casemateGun(hull);
}

export function weaponsOnTurret(
  hull: HullInstance,
  turretId: string,
): WeaponInstance[] {
  return hull.weapons.filter((w) => w.turretId === turretId);
}

export function hullWeapons(hull: HullInstance): WeaponInstance[] {
  return hull.weapons.filter((w) => w.turretId == null);
}
