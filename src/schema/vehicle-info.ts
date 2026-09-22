import { howitzerReloadS } from "./howitzer.ts";
import { ARTILLERY_ARMAMENT } from "./catalog-artillery.ts";
import { BRIEFS_BY_ID, type Brief } from "./audio.ts";
import { CATALOG_HULLS, hullById } from "./catalog.ts";
import type { HullBlueprint } from "./hull.ts";
import type { NationId } from "./enums.ts";
import { NATIONS } from "./enums.ts";
import { NATION_NAME, TANK_TIERS, artilleryNodesFor, nodeByHull, specAt } from "./tree.ts";

export type NationSheetTheme = {
  bureau: string;
  series: string;
  mark: string;
  directive: string;
};

export const NATION_SHEET_THEME: Record<NationId, NationSheetTheme> = {
  usa: {
    bureau: "ORDNANCE DEPARTMENT · FIELD CARD",
    series: "ARMORED DEVELOPMENT SERIES",
    mark: "★",
    directive: "KEEP IT RUNNING. KEEP IT MOVING.",
  },
  ussr: {
    bureau: "ARMORED FORCES · TECHNICAL DOSSIER",
    series: "PROVING-GROUND VEHICLE RECORD",
    mark: "★",
    directive: "SLOPE THE STEEL. MASS THE FORCE.",
  },
  germany: {
    bureau: "WAFFENPRÜFAMT · FAHRZEUGBLATT",
    series: "PANZER DEVELOPMENT RECORD",
    mark: "✠",
    directive: "SEE FIRST. FIRE FIRST. MOVE.",
  },
};

export type VehicleInfoRosterEntry = {
  hullId: string;
  name: string;
  nation: NationId;
  nationName: string;
  tierLabel: string;
};

/** Roster order mirrors the garage: T1, free SPG, then T2–T10. */
export const VEHICLE_INFO_ROSTER: VehicleInfoRosterEntry[] = NATIONS.flatMap((nation) => {
  const orderedIds = [
    specAt(nation, 1).hullId,
    ...artilleryNodesFor(nation).map(node => node.hullId),
    ...TANK_TIERS.filter((tier) => tier > 1).map((tier) => specAt(nation, tier).hullId),
  ].filter((id): id is string => Boolean(id));

  return orderedIds.map((hullId) => {
    const hull = hullById(hullId);
    const node = nodeByHull(hullId);
    if (!hull || !node) throw new Error(`Info roster missing ${hullId}`);
    return {
      hullId,
      name: hull.shortName,
      nation,
      nationName: NATION_NAME[nation],
      tierLabel: node.class === "artillery" ? `T${node.tier} SPG` : `T${node.tier}`,
    };
  });
});

export type VehicleArmorRow = {
  label: string;
  mm: number;
  slopeDeg: number;
};

export type VehicleTechnicalRow = {
  label: string;
  value: string;
};

export type VehicleInfoSheet = {
  hull: HullBlueprint;
  brief: Brief;
  nationName: string;
  tierLabel: string;
  theme: NationSheetTheme;
  mainWeapon: HullBlueprint["weapons"][number];
  mainTurret: HullBlueprint["turrets"][number] | undefined;
  speedKph: number;
  features: string[];
  technical: VehicleTechnicalRow[];
  armor: VehicleArmorRow[];
};

function number(value: number, digits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
  });
}

function weaponLabel(weapon: HullBlueprint["weapons"][number]): string {
  if (ARTILLERY_ARMAMENT[weapon.id]) return ARTILLERY_ARMAMENT[weapon.id];
  const kind = weapon.kind === "howitzer" ? "howitzer" : "gun";
  return `${number(weapon.caliberMm, 1)} mm ${kind}`;
}

function ringLabel(hull: HullBlueprint): string {
  const main = hull.turrets.find((turret) => turret.role === "main");
  if (!main) return "Casemate · hull aim";
  if (hull.turrets.length > 1) {
    return `${hull.turrets.length} rings · ${main.drive} main`;
  }
  return `${main.drive} ring · ${number(main.traverseRateDegPerSec, 1)}°/s`;
}

function featureList(hull: HullBlueprint, mainWeapon: HullBlueprint["weapons"][number]): string[] {
  const main = hull.turrets.find((turret) => turret.role === "main");
  const maxArmor = Math.max(
    hull.armor.hullFront.mm,
    hull.armor.hullSide.mm,
    hull.armor.hullRear.mm,
    hull.armor.turretFront.mm,
    hull.armor.turretSide.mm,
    hull.armor.turretRear.mm,
  );
  const secondaryCount = Math.max(0, hull.weapons.length - 1);
  const features = [
    mainWeapon.kind === "howitzer" ? `${weaponLabel(mainWeapon)} · ${number(mainWeapon.damageHp)} HP direct HE impact · ${number(howitzerReloadS(mainWeapon.caliberMm), 1)} s reload` : `${weaponLabel(mainWeapon)} · ${number(mainWeapon.penMm)} mm penetration at the catalog's 100 m reference`,
    `${number(hull.forwardSpeedMps * 3.6, 1)} km/h forward speed · ${number(hull.hullYawRateDegPerSec, 1)}°/s hull traverse`,
    `${number(hull.armor.hullFront.mm)} mm hull front at ${number(hull.armor.hullFront.slopeDeg)}° · ${number(maxArmor)} mm maximum nominal plate`,
  ];

  if (main) {
    features.push(
      hull.turrets.length > 1
        ? `${hull.turrets.length} independently modeled turret rings; weapons remain separate devices`
        : `${main.drive[0].toUpperCase()}${main.drive.slice(1)} 360° ring · ${number(main.traverseRateDegPerSec, 1)}°/s catalog traverse`,
    );
  } else {
    features.push(
      `Casemate mounting · ${number(mainWeapon.arcMinDeg)}° to ${number(mainWeapon.arcMaxDeg)}° authored fire arc`,
    );
  }

  features.push(
    `${hull.class[0].toUpperCase()}${hull.class.slice(1)} role · ${number(hull.hp)} in-game durability`,
    secondaryCount
      ? `${secondaryCount} secondary weapon${secondaryCount === 1 ? "" : "s"} modeled alongside the primary`
      : "Single-purpose primary armament with no secondary weapon in the catalog",
  );
  return features;
}

export function vehicleInfoSheetFor(hullId: string): VehicleInfoSheet | undefined {
  const hull = hullById(hullId);
  const brief = BRIEFS_BY_ID[hullId];
  const node = nodeByHull(hullId);
  if (!hull || !brief || !node) return undefined;

  const mainWeapon =
    hull.weapons.find((weapon) => weapon.kind === "main_gun") ??
    hull.weapons.find((weapon) => weapon.kind === "howitzer") ??
    hull.weapons[0];
  const mainTurret = hull.turrets.find((turret) => turret.role === "main");
  const speedKph = hull.forwardSpeedMps * 3.6;
  const tierLabel = node.class === "artillery" ? `TIER ${node.tier} SPG` : `TIER ${node.tier}`;
  const technical: VehicleTechnicalRow[] = [
    { label: "Designation", value: hull.name },
    { label: "Nation / branch", value: `${NATION_NAME[hull.nation]} · ${tierLabel}` },
    { label: "Battlefield role", value: hull.class.toUpperCase() },
    {
      label: "Hull dimensions",
      value: `${number(hull.lengthM, 2)} m × ${number(hull.widthM, 2)} m`,
    },
    { label: "Forward speed", value: `${number(speedKph, 1)} km/h` },
    { label: "Hull traverse", value: `${number(hull.hullYawRateDegPerSec, 1)}°/s` },
    { label: "In-game durability", value: `${number(hull.hp)} HP` },
    { label: "Turret system", value: ringLabel(hull) },
    { label: "Primary armament", value: weaponLabel(mainWeapon) },
    {
      label: mainWeapon.kind === "howitzer" ? "HE impact / reload" : "AP reference",
      value: mainWeapon.kind === "howitzer" ? `${number(mainWeapon.damageHp)} HP · ${number(howitzerReloadS(mainWeapon.caliberMm), 1)} s` : `${number(mainWeapon.penMm)} mm pen · ${number(mainWeapon.damageHp)} damage`,
    },
    {
      label: "Elevation",
      value: `${number(mainWeapon.elevationMinDeg)}° / +${number(mainWeapon.elevationMaxDeg)}°`,
    },
    { label: "Modeled weapons", value: `${hull.weapons.length}` },
  ];
  if (mainWeapon.kind === "howitzer") technical.push({ label: "Unlock", value: node.tier === 1 ? "Available from the start" : `Reach tier ${node.tier} in ${NATION_NAME[hull.nation]}` });
  const armor: VehicleArmorRow[] = [
    { label: "Hull front", ...hull.armor.hullFront },
    { label: "Hull side", ...hull.armor.hullSide },
    { label: "Hull rear", ...hull.armor.hullRear },
    { label: "Turret front", ...hull.armor.turretFront },
    { label: "Turret side", ...hull.armor.turretSide },
    { label: "Turret rear", ...hull.armor.turretRear },
  ];

  return {
    hull,
    brief,
    nationName: NATION_NAME[hull.nation],
    tierLabel,
    theme: NATION_SHEET_THEME[hull.nation],
    mainWeapon,
    mainTurret,
    speedKph,
    features: featureList(hull, mainWeapon),
    technical,
    armor,
  };
}

export function assertVehicleInfoCoverage(): string[] {
  const errors: string[] = [];
  const ids = new Set(VEHICLE_INFO_ROSTER.map((entry) => entry.hullId));
  for (const hull of CATALOG_HULLS) {
    if (!ids.has(hull.id)) errors.push(`${hull.id}: missing from info roster`);
    if (!vehicleInfoSheetFor(hull.id)) errors.push(`${hull.id}: missing info sheet`);
  }
  if (ids.size !== CATALOG_HULLS.length) {
    errors.push(`info roster ${ids.size} does not match catalog ${CATALOG_HULLS.length}`);
  }
  return errors;
}
