import type { TurretInstance } from "./turret.ts";
import { bindsGreenReticle } from "./turret.ts";
import type { WeaponInstance, WeaponMount } from "./weapon.ts";
import { weaponCanFire } from "./weapon.ts";
import type { HullBlueprint, HullInstance } from "./hull.ts";
import { casemateGun, isCasemate, mainTurret } from "./hull.ts";

/**
 * Classification law — frozen.
 *
 * TURRET: a hull-mounted traverse RING with its own facing, rate, drive,
 * and disable states. Only TurretInstance qualifies.
 *
 * NOT A TURRET: any WeaponInstance, including:
 * - coax (slaved facing)
 * - bow / hull ball (limited independent aim, no ring)
 * - fixed sponson
 * - turret_offset / mountTraverseDeg (M20 ±10 inside a ring)
 * - pintle / AA
 * - hull_casemate leftover (Jagdpanther / SPG)
 * - howitzer
 *
 * Having a fire arc does not promote a weapon to a turret.
 * T-28 port/starboard MG rings are turrets because they are rings
 * with dedicated gunners and independent freeze/destroy states.
 */
export function isTurretMount(mount: WeaponMount): boolean {
  return mount === "turret_ring";
}

export function assertCatalogLaws(bp: HullBlueprint): string[] {
  const errors: string[] = [];
  const turretIds = new Set(bp.turrets.map((t) => t.id));
  const weaponIds = new Set(bp.weapons.map((w) => w.id));
  const mains = bp.turrets.filter((t) => t.role === "main");
  const casemate = isCasemate(bp);
  const casemateGuns = bp.weapons.filter(
    (w) =>
      w.mount === "hull_casemate" && (w.kind === "main_gun" || w.kind === "howitzer"),
  );

  if (casemate) {
    if (casemateGuns.length !== 1) {
      errors.push(`${bp.id}: casemate needs exactly one hull_casemate gun`);
    }
  } else if (mains.length !== 1) {
    errors.push(`${bp.id}: exactly one main turret required, got ${mains.length}`);
  }

  if (!casemate && casemateGuns.length > 0) {
    errors.push(`${bp.id}: ring hull cannot carry hull_casemate`);
  }

  const roles = bp.turrets.map((t) => t.role);
  if (new Set(roles).size !== roles.length) {
    errors.push(`${bp.id}: duplicate turret roles`);
  }

  for (const t of bp.turrets) {
    if (!weaponIds.has(t.defaultWeaponId)) {
      errors.push(`${bp.id}: turret ${t.id} defaultWeaponId missing`);
    }
    if (t.wrap && t.role !== "main") {
      errors.push(`${bp.id}: only main may wrap 360; ${t.id} is ${t.role}`);
    }
  }

  for (const w of bp.weapons) {
    if (w.mount === "turret_ring" && !w.turretId) {
      errors.push(`${bp.id}: weapon ${w.id} turret_ring missing turretId`);
    }
    if (w.turretId && !turretIds.has(w.turretId)) {
      errors.push(`${bp.id}: weapon ${w.id} points at unknown turret`);
    }
    if (w.mount === "hull_ball" || w.mount === "hull_fixed" || w.mount === "pintle" || w.mount === "hull_casemate") {
      if (w.turretId) {
        errors.push(`${bp.id}: hull/pintle/casemate weapon ${w.id} must not have turretId`);
      }
    }
    if (w.kind === "coax" && !w.slavedToWeaponId) {
      errors.push(`${bp.id}: coax ${w.id} must be slaved`);
    }
    if (w.kind === "sponson_fixed" && w.mount !== "hull_fixed") {
      errors.push(`${bp.id}: sponson ${w.id} must be hull_fixed`);
    }
    if (w.mount === "turret_offset" && w.mountTraverseDeg <= 0) {
      errors.push(`${bp.id}: turret_offset ${w.id} needs mountTraverseDeg`);
    }
    if (w.mount === "hull_casemate" && w.mountTraverseDeg <= 0) {
      errors.push(`${bp.id}: casemate ${w.id} needs leftover mountTraverseDeg`);
    }
    if (w.kind === "howitzer" && w.mount !== "hull_casemate") {
      errors.push(`${bp.id}: howitzer ${w.id} must be hull_casemate this freeze`);
    }
    if (w.kind === "howitzer" && w.damageHp <= 0) {
      errors.push(`${bp.id}: howitzer ${w.id} needs damageHp`);
    }
    if (w.kind === "main_gun" && (w.penMm <= 0 || w.damageHp <= 0)) {
      errors.push(`${bp.id}: main_gun ${w.id} needs penMm and damageHp`);
    }
  }

  if (bp.hp <= 0) errors.push(`${bp.id}: hp must be positive`);
  for (const [k, p] of Object.entries(bp.armor)) {
    if (p.mm <= 0) errors.push(`${bp.id}: armor ${k} mm`);
  }

  return errors;
}

export function wrapDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function clampToArc(
  facingDeg: number,
  arcMinDeg: number,
  arcMaxDeg: number,
  wrap: boolean,
): number {
  if (wrap) return wrapDeg(facingDeg);
  return Math.min(arcMaxDeg, Math.max(arcMinDeg, facingDeg));
}

export function inArc(
  localDeg: number,
  arcMinDeg: number,
  arcMaxDeg: number,
  wrap: boolean,
): boolean {
  const d = wrapDeg(localDeg);
  if (wrap) return true;
  return d >= arcMinDeg && d <= arcMaxDeg;
}

export function effectiveTraverseRate(
  turret: TurretInstance,
  engineNorm: number,
): number {
  if (turret.state !== "live") return 0;
  if (turret.drive !== "hydraulic") return turret.traverseRateDegPerSec;
  const scale = 0.35 + engineNorm * 1.65;
  return turret.traverseRateDegPerSec * scale;
}

export function setTurretState(
  hull: HullInstance,
  turretId: string,
  state: TurretInstance["state"],
): HullInstance {
  return {
    ...hull,
    turrets: hull.turrets.map((t) => (t.id === turretId ? { ...t, state } : t)),
  };
}

export function setWeaponState(
  hull: HullInstance,
  weaponId: string,
  state: WeaponInstance["state"],
): HullInstance {
  return {
    ...hull,
    weapons: hull.weapons.map((w) => (w.id === weaponId ? { ...w, state } : w)),
  };
}

export function setTurretFacing(
  hull: HullInstance,
  turretId: string,
  facingDeg: number,
): HullInstance {
  return {
    ...hull,
    turrets: hull.turrets.map((t) => {
      if (t.id !== turretId) return t;
      return {
        ...t,
        facingDeg: clampToArc(facingDeg, t.arcMinDeg, t.arcMaxDeg, t.wrap),
      };
    }),
  };
}

/**
 * Jammed / crew-killed main: leftover is max mountTraverseDeg on that ring.
 * Destroyed ring or live ring: 0.
 * Casemate: leftover is always mountTraverseDeg on the hull_casemate gun.
 */
export function leftoverAimDeg(hull: HullInstance): number {
  const gun = casemateGun(hull);
  if (gun) return Math.max(0, gun.mountTraverseDeg);
  const main = mainTurret(hull);
  if (!main) return 0;
  if (main.state === "live" || main.state === "destroyed") return 0;
  const guns = hull.weapons.filter((w) => w.turretId === main.id);
  if (guns.length === 0) return 0;
  return Math.max(0, ...guns.map((w) => w.mountTraverseDeg));
}

export function greenReticleBound(hull: HullInstance): boolean {
  const main = mainTurret(hull);
  if (main) return bindsGreenReticle(main);
  const gun = casemateGun(hull);
  if (!gun) return false;
  return weaponCanFire(gun.state);
}
