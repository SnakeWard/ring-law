import { SCHEMA_VERSION } from "./enums.ts";
import type { TurretInstance } from "./turret.ts";
import type { WeaponInstance } from "./weapon.ts";

/**
 * RING LAW — frozen 2026-09-03, compiled v4 with casemate leftover.
 *
 * A turret is a RING. A weapon is a firing device.
 * Fire arc, coax, ball mount, sponson, pintle, M20 offset, hull_casemate,
 * and howitzer never promote a weapon into a turret.
 */
export const RING_LAW = {
  version: SCHEMA_VERSION,
  frozenAt: "2026-09-04",
  turretIs:
    "A hull-mounted traverse ring with its own facing, rate, drive, and disable states. Only TurretInstance qualifies.",
  turretIsNot: [
    "Any WeaponInstance",
    "Coax (slaved facing)",
    "Bow / hull ball (limited aim, no ring)",
    "Fixed sponson",
    "Mount traverse inside a ring (M2A4 M20 ±10°)",
    "Pintle / AA",
    "hull_casemate leftover (Jagdpanther / SPG)",
    "Howitzer",
    "Having a fire arc",
  ],
  greenReticle:
    "Binds to role=main when the ring can fire, or to a live/jammed hull_casemate gun.",
  leftoverAim:
    "Jammed or crew-killed main: leftover aim is max mountTraverseDeg on that ring's weapons. Destroyed ring: 0. Casemate: leftover is always mountTraverseDeg on the hull_casemate gun.",
  starterHulls: ["m2a4", "t-28", "tiger-i"] as const,
  deferred: [
    "Super-heavy class",
    "M2A2/A3 twin turret",
    "AA pintle / T-28 rear MG as player aim",
    "Howitzer flight time (range / muzzle)",
    "Indirect artillery map-click",
  ],
} as const;

/** Canonical TurretInstance keys. Bump SCHEMA_VERSION if this list changes. */
export const TURRET_INSTANCE_FIELDS = [
  "id",
  "role",
  "arcMinDeg",
  "arcMaxDeg",
  "wrap",
  "traverseRateDegPerSec",
  "drive",
  "offsetForwardM",
  "offsetRightM",
  "ringRadiusM",
  "defaultWeaponId",
  "notes",
  "parentHullId",
  "facingDeg",
  "state",
  "weaponId",
  "targetId",
] as const;

/** Canonical WeaponInstance keys. Bump SCHEMA_VERSION if this list changes. */
export const WEAPON_INSTANCE_FIELDS = [
  "id",
  "kind",
  "mount",
  "turretId",
  "caliberMm",
  "penMm",
  "damageHp",
  "arcMinDeg",
  "arcMaxDeg",
  "elevationMinDeg",
  "elevationMaxDeg",
  "mountTraverseDeg",
  "slavedToWeaponId",
  "offsetForwardM",
  "offsetRightM",
  "notes",
  "parentHullId",
  "facingDeg",
  "state",
] as const;

export const TURRET_STATES_FROZEN = [
  "live",
  "jammed",
  "destroyed",
  "crew_killed",
] as const;

export const WEAPON_STATES_FROZEN = [
  "live",
  "jammed",
  "destroyed",
  "crew_killed",
] as const;

export type ClassifiedObject =
  | { kind: "turret"; object: TurretInstance; isTurret: true }
  | { kind: "weapon"; object: WeaponInstance; isTurret: false };

export function classifyTurret(t: TurretInstance): ClassifiedObject {
  return { kind: "turret", object: t, isTurret: true };
}

export function classifyWeapon(w: WeaponInstance): ClassifiedObject {
  return { kind: "weapon", object: w, isTurret: false };
}

export function instanceKeys(obj: object): string[] {
  return Object.keys(obj).sort();
}

export const STATE_CYCLE = [
  "live",
  "jammed",
  "crew_killed",
  "destroyed",
] as const;

export function nextState<T extends (typeof STATE_CYCLE)[number]>(
  state: T,
): (typeof STATE_CYCLE)[number] {
  const i = STATE_CYCLE.indexOf(state);
  return STATE_CYCLE[(i + 1) % STATE_CYCLE.length];
}
