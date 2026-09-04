/** Frozen turret / weapon / pen / crit contract. Bump only with a catalog migration. */
export const SCHEMA_VERSION = 5 as const;

export const HULL_CLASSES = ["light", "medium", "heavy", "artillery"] as const;
export type HullClass = (typeof HULL_CLASSES)[number];

export const NATIONS = ["usa", "ussr", "germany"] as const;
export type NationId = (typeof NATIONS)[number];

export const TURRET_ROLES = ["main", "mg_port", "mg_starboard"] as const;
export type TurretRole = (typeof TURRET_ROLES)[number];

export const TURRET_STATES = [
  "live",
  "jammed",
  "destroyed",
  "crew_killed",
] as const;
export type TurretState = (typeof TURRET_STATES)[number];

export const TURRET_DRIVES = ["electric", "hydraulic", "manual"] as const;
export type TurretDrive = (typeof TURRET_DRIVES)[number];

export const WEAPON_KINDS = [
  "main_gun",
  "howitzer",
  "mg",
  "coax",
  "bow_mg",
  "sponson_fixed",
  "aa_pintle",
  "rear_mg",
] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export const WEAPON_MOUNTS = [
  "turret_ring",
  "hull_ball",
  "hull_fixed",
  "hull_casemate",
  "turret_offset",
  "pintle",
] as const;
export type WeaponMount = (typeof WEAPON_MOUNTS)[number];

export const WEAPON_STATES = [
  "live",
  "jammed",
  "destroyed",
  "crew_killed",
] as const;
export type WeaponState = (typeof WEAPON_STATES)[number];

export const EVIDENCE = [
  "real",
  "simulated",
  "planned",
  "unknown",
  "assumed",
] as const;
export type Evidence = (typeof EVIDENCE)[number];
