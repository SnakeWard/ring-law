import type { HullBlueprint } from "./hull.ts";
import { plate } from "./armor.ts";
import { howitzerChipHp } from "./howitzer.ts";
import type { HullClass, NationId, TurretDrive } from "./enums.ts";

function ringHull(p: {
  id: string;
  name: string;
  shortName: string;
  class: HullClass;
  nation: NationId;
  lengthM: number;
  widthM: number;
  hullYawRateDegPerSec: number;
  forwardSpeedMps: number;
  defaultEngineNorm?: number;
  hp: number;
  armor: HullBlueprint["armor"];
  notes: string;
  traverse: { rate: number; drive: TurretDrive; ringRadiusM: number; offsetForwardM: number };
  gun: {
    caliberMm: number;
    penMm: number;
    damageHp: number;
    elevationMinDeg: number;
    elevationMaxDeg: number;
    notes: string;
    mountTraverseDeg?: number;
  };
  bow?: boolean;
  mgCal?: number;
  mgPen?: number;
}): HullBlueprint {
  const mainId = `${p.id}-main`;
  const gunId = `${p.id}-gun`;
  const coaxId = `${p.id}-coax`;
  const mgCal = p.mgCal ?? (p.nation === "germany" ? 7.92 : 7.62);
  const mgPen = p.mgPen ?? (p.nation === "germany" ? 13 : 12);
  const leftover = p.gun.mountTraverseDeg ?? 0;
  const weapons: HullBlueprint["weapons"] = [
    {
      id: gunId,
      kind: "main_gun",
      mount: "turret_ring",
      turretId: mainId,
      caliberMm: p.gun.caliberMm,
      penMm: p.gun.penMm,
      damageHp: p.gun.damageHp,
      arcMinDeg: -180,
      arcMaxDeg: 180,
      elevationMinDeg: p.gun.elevationMinDeg,
      elevationMaxDeg: p.gun.elevationMaxDeg,
      mountTraverseDeg: leftover,
      slavedToWeaponId: null,
      offsetForwardM: p.traverse.offsetForwardM + 1.0,
      offsetRightM: 0,
      notes: p.gun.notes,
    },
    {
      id: coaxId,
      kind: "coax",
      mount: "turret_ring",
      turretId: mainId,
      caliberMm: mgCal,
      penMm: mgPen,
      damageHp: 8,
      arcMinDeg: -180,
      arcMaxDeg: 180,
      elevationMinDeg: p.gun.elevationMinDeg,
      elevationMaxDeg: p.gun.elevationMaxDeg,
      mountTraverseDeg: 0,
      slavedToWeaponId: gunId,
      offsetForwardM: p.traverse.offsetForwardM + 0.9,
      offsetRightM: 0.16,
      notes: "Slaved to the main gun.",
    },
  ];
  if (p.bow) {
    weapons.push({
      id: `${p.id}-bow`,
      kind: "bow_mg",
      mount: "hull_ball",
      turretId: null,
      caliberMm: mgCal,
      penMm: mgPen,
      damageHp: 8,
      arcMinDeg: -15,
      arcMaxDeg: 15,
      elevationMinDeg: -10,
      elevationMaxDeg: 20,
      mountTraverseDeg: 0,
      slavedToWeaponId: null,
      offsetForwardM: p.lengthM * 0.38,
      offsetRightM: 0.45,
      notes: "Hull ball. Not a turret.",
    });
  }
  return {
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    class: p.class,
    nation: p.nation,
    lengthM: p.lengthM,
    widthM: p.widthM,
    hullYawRateDegPerSec: p.hullYawRateDegPerSec,
    forwardSpeedMps: p.forwardSpeedMps,
    defaultEngineNorm: p.defaultEngineNorm ?? 1,
    hp: p.hp,
    armor: p.armor,
    notes: p.notes,
    turrets: [
      {
        id: mainId,
        role: "main",
        arcMinDeg: -180,
        arcMaxDeg: 180,
        wrap: true,
        traverseRateDegPerSec: p.traverse.rate,
        drive: p.traverse.drive,
        offsetForwardM: p.traverse.offsetForwardM,
        offsetRightM: 0,
        ringRadiusM: p.traverse.ringRadiusM,
        defaultWeaponId: gunId,
        notes: `${p.traverse.drive} ${p.traverse.rate}°/s. Leftover ${leftover}.`,
      },
    ],
    weapons,
  };
}

function casemateHull(p: {
  id: string;
  name: string;
  shortName: string;
  class: HullClass;
  nation: NationId;
  lengthM: number;
  widthM: number;
  hullYawRateDegPerSec: number;
  forwardSpeedMps: number;
  hp: number;
  armor: HullBlueprint["armor"];
  notes: string;
  gun: {
    id: string;
    kind: "main_gun" | "howitzer";
    caliberMm: number;
    penMm: number;
    damageHp: number;
    arcMinDeg: number;
    arcMaxDeg: number;
    elevationMinDeg: number;
    elevationMaxDeg: number;
    mountTraverseDeg: number;
    offsetForwardM: number;
    notes: string;
  };
  bow?: boolean;
}): HullBlueprint {
  const weapons: HullBlueprint["weapons"] = [
    {
      id: p.gun.id,
      kind: p.gun.kind,
      mount: "hull_casemate",
      turretId: null,
      caliberMm: p.gun.caliberMm,
      penMm: p.gun.penMm,
      damageHp: p.gun.damageHp,
      arcMinDeg: p.gun.arcMinDeg,
      arcMaxDeg: p.gun.arcMaxDeg,
      elevationMinDeg: p.gun.elevationMinDeg,
      elevationMaxDeg: p.gun.elevationMaxDeg,
      mountTraverseDeg: p.gun.mountTraverseDeg,
      slavedToWeaponId: null,
      offsetForwardM: p.gun.offsetForwardM,
      offsetRightM: 0,
      notes: p.gun.notes,
    },
  ];
  if (p.bow) {
    const mgCal = p.nation === "germany" ? 7.92 : 7.62;
    weapons.push({
      id: `${p.id}-bow`,
      kind: "bow_mg",
      mount: "hull_ball",
      turretId: null,
      caliberMm: mgCal,
      penMm: p.nation === "germany" ? 13 : 12,
      damageHp: 8,
      arcMinDeg: -12,
      arcMaxDeg: 12,
      elevationMinDeg: -8,
      elevationMaxDeg: 16,
      mountTraverseDeg: 0,
      slavedToWeaponId: null,
      offsetForwardM: p.lengthM * 0.32,
      offsetRightM: 0.4,
      notes: "Hull ball in the casemate face. Not a turret.",
    });
  }
  return {
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    class: p.class,
    nation: p.nation,
    lengthM: p.lengthM,
    widthM: p.widthM,
    hullYawRateDegPerSec: p.hullYawRateDegPerSec,
    forwardSpeedMps: p.forwardSpeedMps,
    defaultEngineNorm: 1,
    hp: p.hp,
    armor: p.armor,
    notes: p.notes,
    turrets: [],
    weapons,
  };
}

/** USA artillery — M7 Priest. 105 mm howitzer. Open-top M3 chassis. */
export const M7_PRIEST: HullBlueprint = casemateHull({
  id: "m7-priest",
  name: "105 mm Howitzer Motor Carriage M7",
  shortName: "Priest",
  class: "artillery",
  nation: "usa",
  lengthM: 6.02,
  widthM: 2.87,
  hullYawRateDegPerSec: 36,
  forwardSpeedMps: 11.1,
  hp: 260,
  armor: {
    hullFront: plate(12.7),
    hullSide: plate(12.7),
    hullRear: plate(12.7),
    turretFront: plate(12.7),
    turretSide: plate(12.7),
    turretRear: plate(12.7),
  },
  notes:
    "Open-top M3 chassis. 105 mm M2A1 howitzer on hull_casemate leftover ±30°. Not a ring. HE chip only. Flight time Planned. Pintle .50 deferred. Armor/pen assumed 100 m.",
  gun: {
    id: "priest-m2a1",
    kind: "howitzer",
    caliberMm: 105,
    penMm: 0,
    damageHp: howitzerChipHp(105),
    arcMinDeg: -15,
    arcMaxDeg: 30,
    elevationMinDeg: -5,
    elevationMaxDeg: 35,
    mountTraverseDeg: 30,
    offsetForwardM: 1.4,
    notes: "105 mm M2A1. Howitzer HE. Leftover is the casemate arc. Not a turret.",
  },
});

/** USSR artillery — SU-76M. 76.2 mm howitzer-class HE. */
export const SU_76: HullBlueprint = casemateHull({
  id: "su-76",
  name: "SU-76M",
  shortName: "SU-76",
  class: "artillery",
  nation: "ussr",
  lengthM: 5.0,
  widthM: 2.74,
  hullYawRateDegPerSec: 40,
  forwardSpeedMps: 12.5,
  hp: 220,
  armor: {
    hullFront: plate(25),
    hullSide: plate(15),
    hullRear: plate(10),
    turretFront: plate(25),
    turretSide: plate(15),
    turretRear: plate(10),
  },
  notes:
    "Open-top T-70 chassis. 76.2 mm ZiS-3 as howitzer HE this freeze — not tank AP. Leftover ±15°. Not a ring. Flight time Planned.",
  gun: {
    id: "su76-zis3",
    kind: "howitzer",
    caliberMm: 76.2,
    penMm: 0,
    damageHp: howitzerChipHp(76.2),
    arcMinDeg: -15,
    arcMaxDeg: 15,
    elevationMinDeg: -5,
    elevationMaxDeg: 25,
    mountTraverseDeg: 15,
    offsetForwardM: 1.2,
    notes: "76.2 mm ZiS-3. Howitzer HE chip, scaled off 105 mm. Not a turret.",
  },
});

/** Germany artillery — Wespe. 105 mm leFH. */
export const WESPE: HullBlueprint = casemateHull({
  id: "wespe",
  name: "Sd.Kfz. 124 Wespe",
  shortName: "Wespe",
  class: "artillery",
  nation: "germany",
  lengthM: 4.81,
  widthM: 2.28,
  hullYawRateDegPerSec: 38,
  forwardSpeedMps: 11.1,
  hp: 200,
  armor: {
    hullFront: plate(20),
    hullSide: plate(15),
    hullRear: plate(10),
    turretFront: plate(10),
    turretSide: plate(10),
    turretRear: plate(10),
  },
  notes:
    "Open-top Pz. II chassis. 10.5 cm leFH 18/2 howitzer, leftover ±16°. Not a ring. Flight time Planned.",
  gun: {
    id: "wespe-lefh",
    kind: "howitzer",
    caliberMm: 105,
    penMm: 0,
    damageHp: howitzerChipHp(105),
    arcMinDeg: -16,
    arcMaxDeg: 16,
    elevationMinDeg: -5,
    elevationMaxDeg: 42,
    mountTraverseDeg: 16,
    offsetForwardM: 0.9,
    notes: "10.5 cm leFH 18/2. Howitzer HE. Not a turret.",
  },
});

/** Germany T5 — Jagdpanther. Casemate leftover, Pak 43. Proves RING leftover on a TD. */
export const JAGDPANTHER: HullBlueprint = casemateHull({
  id: "jagdpanther",
  name: "Jagdpanther",
  shortName: "Jagdpanther",
  class: "heavy",
  nation: "germany",
  lengthM: 6.87,
  widthM: 3.27,
  hullYawRateDegPerSec: 18,
  forwardSpeedMps: 12.8,
  hp: 900,
  armor: {
    hullFront: plate(80, 55),
    hullSide: plate(50),
    hullRear: plate(40),
    turretFront: plate(80, 55),
    turretSide: plate(50),
    turretRear: plate(40),
  },
  notes:
    "Panther chassis casemate. 8.8 cm Pak 43 L/71, leftover ±11°. Not a ring. Superstructure plates sit in turret* slots. Armor/pen assumed 100 m AP.",
  gun: {
    id: "jagdpanther-pak43",
    kind: "main_gun",
    caliberMm: 88,
    penMm: 202,
    damageHp: 280,
    arcMinDeg: -11,
    arcMaxDeg: 11,
    elevationMinDeg: -8,
    elevationMaxDeg: 14,
    mountTraverseDeg: 11,
    offsetForwardM: 1.8,
    notes: "8.8 cm Pak 43 L/71. Casemate leftover ±11°. Same AP as KwK 43. Not a turret.",
  },
  bow: true,
});

export const M4A3E8: HullBlueprint = ringHull({
  id: "m4a3e8",
  name: "Medium Tank M4A3E8",
  shortName: "Easy Eight",
  class: "medium",
  nation: "usa",
  lengthM: 6.27,
  widthM: 2.67,
  hullYawRateDegPerSec: 28,
  forwardSpeedMps: 11.7,
  hp: 640,
  armor: {
    hullFront: plate(64, 47),
    hullSide: plate(38),
    hullRear: plate(38),
    turretFront: plate(76, 30),
    turretSide: plate(51),
    turretRear: plate(51),
  },
  notes:
    "M4A3E8 (76)W HVSS. 76 mm M1A2, Oilgear hydraulic 24°/s. Same glacis as M4A3(75). Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.88, offsetForwardM: 0.05 },
  gun: {
    caliberMm: 76.2,
    penMm: 149,
    damageHp: 130,
    elevationMinDeg: -10,
    elevationMaxDeg: 25,
    notes: "76 mm M1A2. Assumed M62 ~100 m.",
  },
  bow: true,
});

export const M26_PERSHING: HullBlueprint = ringHull({
  id: "m26-pershing",
  name: "Heavy Tank M26",
  shortName: "Pershing",
  class: "medium",
  nation: "usa",
  lengthM: 6.33,
  widthM: 3.51,
  hullYawRateDegPerSec: 24,
  forwardSpeedMps: 10.8,
  hp: 880,
  armor: {
    hullFront: plate(102, 46),
    hullSide: plate(76),
    hullRear: plate(51),
    turretFront: plate(102),
    turretSide: plate(76),
    turretRear: plate(76),
  },
  notes:
    "M26: 90 mm M3, hydraulic 20°/s. Glacis 102 mm @ 46°. Class stays medium on this line. Armor/pen assumed 100 m AP.",
  traverse: { rate: 20, drive: "hydraulic", ringRadiusM: 0.88, offsetForwardM: 0.1 },
  gun: {
    caliberMm: 90,
    penMm: 165,
    damageHp: 180,
    elevationMinDeg: -10,
    elevationMaxDeg: 20,
    notes: "90 mm M3. Assumed M82 ~100 m.",
  },
  bow: true,
});

export const M46_PATTON: HullBlueprint = ringHull({
  id: "m46-patton",
  name: "Medium Tank M46",
  shortName: "M46",
  class: "medium",
  nation: "usa",
  lengthM: 6.37,
  widthM: 3.51,
  hullYawRateDegPerSec: 26,
  forwardSpeedMps: 13.3,
  hp: 960,
  armor: {
    hullFront: plate(102, 46),
    hullSide: plate(76),
    hullRear: plate(51),
    turretFront: plate(102),
    turretSide: plate(76),
    turretRear: plate(76),
  },
  notes:
    "M46: AV-1790, 90 mm M3A1, hydraulic 24°/s. Same face as M26, more speed. Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.88, offsetForwardM: 0.1 },
  gun: {
    caliberMm: 90,
    penMm: 173,
    damageHp: 180,
    elevationMinDeg: -10,
    elevationMaxDeg: 20,
    notes: "90 mm M3A1. Assumed ~100 m AP.",
  },
  bow: true,
});

export const M47_PATTON: HullBlueprint = ringHull({
  id: "m47-patton",
  name: "Medium Tank M47",
  shortName: "M47",
  class: "medium",
  nation: "usa",
  lengthM: 6.36,
  widthM: 3.51,
  hullYawRateDegPerSec: 28,
  forwardSpeedMps: 13.3,
  hp: 1040,
  armor: {
    hullFront: plate(110, 60),
    hullSide: plate(76),
    hullRear: plate(51),
    turretFront: plate(110),
    turretSide: plate(76),
    turretRear: plate(76),
  },
  notes:
    "M47: 90 mm M36, hydraulic 24°/s. Glacis 110 mm @ 60°. Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.92, offsetForwardM: 0.08 },
  gun: {
    caliberMm: 90,
    penMm: 190,
    damageHp: 200,
    elevationMinDeg: -8,
    elevationMaxDeg: 19,
    notes: "90 mm M36. Assumed ~100 m AP.",
  },
  bow: true,
});

export const M48_PATTON: HullBlueprint = ringHull({
  id: "m48-patton",
  name: "Medium Tank M48A1",
  shortName: "M48",
  class: "medium",
  nation: "usa",
  lengthM: 6.95,
  widthM: 3.63,
  hullYawRateDegPerSec: 26,
  forwardSpeedMps: 12.5,
  hp: 1120,
  armor: {
    hullFront: plate(110, 60),
    hullSide: plate(76),
    hullRear: plate(35),
    turretFront: plate(178),
    turretSide: plate(76),
    turretRear: plate(51),
  },
  notes:
    "M48A1: 90 mm M41, hydraulic 24°/s. Cast hull. Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.95, offsetForwardM: 0.05 },
  gun: {
    caliberMm: 90,
    penMm: 198,
    damageHp: 210,
    elevationMinDeg: -9,
    elevationMaxDeg: 19,
    notes: "90 mm M41. Assumed ~100 m AP.",
  },
  bow: false,
});

export const T44_100: HullBlueprint = ringHull({
  id: "t-44-100",
  name: "T-44-100",
  shortName: "T-44-100",
  class: "medium",
  nation: "ussr",
  lengthM: 7.65,
  widthM: 3.25,
  hullYawRateDegPerSec: 30,
  forwardSpeedMps: 16,
  hp: 720,
  armor: {
    hullFront: plate(90, 60),
    hullSide: plate(75),
    hullRear: plate(45),
    turretFront: plate(120),
    turretSide: plate(90),
    turretRear: plate(75),
  },
  notes:
    "T-44-100: 100 mm D-10T on the T-44 hull. Same 90 mm @ 60° glacis. No bow MG. Armor/pen assumed 100 m AP.",
  traverse: { rate: 18, drive: "electric", ringRadiusM: 0.85, offsetForwardM: 0.12 },
  gun: {
    caliberMm: 100,
    penMm: 175,
    damageHp: 220,
    elevationMinDeg: -5,
    elevationMaxDeg: 18,
    notes: "100 mm D-10T. Assumed BR-412 ~100 m.",
  },
  bow: false,
});

export const T54: HullBlueprint = ringHull({
  id: "t-54",
  name: "T-54-1",
  shortName: "T-54",
  class: "medium",
  nation: "ussr",
  lengthM: 6.45,
  widthM: 3.27,
  hullYawRateDegPerSec: 28,
  forwardSpeedMps: 13.9,
  hp: 900,
  armor: {
    hullFront: plate(120, 60),
    hullSide: plate(80),
    hullRear: plate(45),
    turretFront: plate(200),
    turretSide: plate(160),
    turretRear: plate(60),
  },
  notes:
    "T-54-1: 100 mm D-10T, electric 360 ring. Glacis 120 mm @ 60°. Armor/pen assumed 100 m AP.",
  traverse: { rate: 16, drive: "electric", ringRadiusM: 0.9, offsetForwardM: 0.08 },
  gun: {
    caliberMm: 100,
    penMm: 185,
    damageHp: 230,
    elevationMinDeg: -5,
    elevationMaxDeg: 18,
    notes: "100 mm D-10T. Assumed BR-412B ~100 m.",
  },
  bow: true,
});

export const T54B: HullBlueprint = ringHull({
  id: "t-54b",
  name: "T-54B",
  shortName: "T-54B",
  class: "medium",
  nation: "ussr",
  lengthM: 6.45,
  widthM: 3.27,
  hullYawRateDegPerSec: 28,
  forwardSpeedMps: 13.9,
  hp: 980,
  armor: {
    hullFront: plate(120, 60),
    hullSide: plate(80),
    hullRear: plate(45),
    turretFront: plate(200),
    turretSide: plate(160),
    turretRear: plate(60),
  },
  notes:
    "T-54B: 100 mm D-10T2S, stabilizer Planned as leftover 0. Same glacis. Armor/pen assumed 100 m AP.",
  traverse: { rate: 16, drive: "electric", ringRadiusM: 0.9, offsetForwardM: 0.08 },
  gun: {
    caliberMm: 100,
    penMm: 190,
    damageHp: 230,
    elevationMinDeg: -5,
    elevationMaxDeg: 18,
    notes: "100 mm D-10T2S. Assumed ~100 m AP.",
  },
  bow: true,
});

export const T62: HullBlueprint = ringHull({
  id: "t-62",
  name: "T-62",
  shortName: "T-62",
  class: "medium",
  nation: "ussr",
  lengthM: 6.63,
  widthM: 3.3,
  hullYawRateDegPerSec: 26,
  forwardSpeedMps: 13.9,
  hp: 1080,
  armor: {
    hullFront: plate(102, 60),
    hullSide: plate(80),
    hullRear: plate(45),
    turretFront: plate(214),
    turretSide: plate(161),
    turretRear: plate(65),
  },
  notes:
    "T-62: 115 mm U-5TS, electric ring. No bow MG. Armor/pen assumed 100 m AP.",
  traverse: { rate: 16, drive: "electric", ringRadiusM: 0.92, offsetForwardM: 0.06 },
  gun: {
    caliberMm: 115,
    penMm: 220,
    damageHp: 280,
    elevationMinDeg: -6,
    elevationMaxDeg: 16,
    notes: "115 mm U-5TS. Assumed 3BM4 ~100 m modeled as AP.",
  },
  bow: false,
});

export const T64A: HullBlueprint = ringHull({
  id: "t-64a",
  name: "T-64A",
  shortName: "T-64A",
  class: "medium",
  nation: "ussr",
  lengthM: 6.54,
  widthM: 3.42,
  hullYawRateDegPerSec: 28,
  forwardSpeedMps: 16.7,
  hp: 1240,
  armor: {
    hullFront: plate(205, 60),
    hullSide: plate(80),
    hullRear: plate(45),
    turretFront: plate(280),
    turretSide: plate(150),
    turretRear: plate(70),
  },
  notes:
    "T-64A: 125 mm D-81T. Composite glacis modeled as 205 mm @ 60°. Autoloader Planned as leftover 0. Armor/pen assumed 100 m AP.",
  traverse: { rate: 18, drive: "electric", ringRadiusM: 0.9, offsetForwardM: 0.04 },
  gun: {
    caliberMm: 125,
    penMm: 250,
    damageHp: 340,
    elevationMinDeg: -6,
    elevationMaxDeg: 14,
    notes: "125 mm D-81T. Assumed 3BM9 ~100 m modeled as AP.",
  },
  bow: false,
});

export const PANTHER_F: HullBlueprint = ringHull({
  id: "panther-f",
  name: "Pz.Kpfw. V Panther Ausf. F",
  shortName: "Panther F",
  class: "medium",
  nation: "germany",
  lengthM: 6.87,
  widthM: 3.27,
  hullYawRateDegPerSec: 22,
  forwardSpeedMps: 12.5,
  defaultEngineNorm: 1,
  hp: 840,
  armor: {
    hullFront: plate(80, 55),
    hullSide: plate(50, 30),
    hullRear: plate(40),
    turretFront: plate(120),
    turretSide: plate(60),
    turretRear: plate(60),
  },
  notes:
    "Ausf. F Schmalturm. Same 7.5 cm KwK 42 L/70, thicker turret face. L4 hydraulic 6°/s. Armor/pen assumed 100 m AP.",
  traverse: { rate: 6, drive: "hydraulic", ringRadiusM: 0.7, offsetForwardM: 0.15 },
  gun: {
    caliberMm: 75,
    penMm: 138,
    damageHp: 135,
    elevationMinDeg: -8,
    elevationMaxDeg: 18,
    notes: "7.5 cm KwK 42 L/70. Same as Ausf. G.",
  },
  bow: true,
});

export const E50: HullBlueprint = ringHull({
  id: "e-50",
  name: "E-50",
  shortName: "E-50",
  class: "medium",
  nation: "germany",
  lengthM: 7.1,
  widthM: 3.32,
  hullYawRateDegPerSec: 24,
  forwardSpeedMps: 16.7,
  defaultEngineNorm: 1,
  hp: 1020,
  armor: {
    hullFront: plate(150, 60),
    hullSide: plate(80),
    hullRear: plate(80),
    turretFront: plate(150),
    turretSide: plate(80),
    turretRear: plate(80),
  },
  notes:
    "E-50: 8.8 cm KwK 43 L/71, hydraulic 12°/s. Glacis 150 mm @ 60°. Paper tank, Assumed 100 m AP.",
  traverse: { rate: 12, drive: "hydraulic", ringRadiusM: 0.9, offsetForwardM: 0.08 },
  gun: {
    caliberMm: 88,
    penMm: 202,
    damageHp: 280,
    elevationMinDeg: -8,
    elevationMaxDeg: 15,
    notes: "8.8 cm KwK 43 L/71. Same AP as Tiger II.",
  },
  bow: true,
});

export const E75: HullBlueprint = ringHull({
  id: "e-75",
  name: "E-75",
  shortName: "E-75",
  class: "heavy",
  nation: "germany",
  lengthM: 7.4,
  widthM: 3.42,
  hullYawRateDegPerSec: 16,
  forwardSpeedMps: 11.1,
  defaultEngineNorm: 0.5,
  hp: 1320,
  armor: {
    hullFront: plate(160, 55),
    hullSide: plate(80),
    hullRear: plate(80),
    turretFront: plate(185),
    turretSide: plate(80),
    turretRear: plate(80),
  },
  notes:
    "E-75: 10.5 cm KwK L/68, hydraulic idle 8°/s. Super-heavy class still deferred. Armor/pen assumed 100 m AP.",
  traverse: { rate: 8, drive: "hydraulic", ringRadiusM: 0.95, offsetForwardM: 0.05 },
  gun: {
    caliberMm: 105,
    penMm: 230,
    damageHp: 320,
    elevationMinDeg: -8,
    elevationMaxDeg: 15,
    notes: "10.5 cm KwK L/68. Assumed Pzgr ~100 m.",
  },
  bow: true,
});

export const STANDARDPANZER: HullBlueprint = ringHull({
  id: "standardpanzer",
  name: "Standardpanzer",
  shortName: "Std.Pz.",
  class: "medium",
  nation: "germany",
  lengthM: 6.54,
  widthM: 3.25,
  hullYawRateDegPerSec: 32,
  forwardSpeedMps: 18,
  hp: 1100,
  armor: {
    hullFront: plate(70, 60),
    hullSide: plate(35),
    hullRear: plate(25),
    turretFront: plate(70),
    turretSide: plate(45),
    turretRear: plate(45),
  },
  notes:
    "Leopard prototype: 105 mm L7, hydraulic 24°/s. Mobility over plate. Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.88, offsetForwardM: 0.06 },
  gun: {
    caliberMm: 105,
    penMm: 250,
    damageHp: 300,
    elevationMinDeg: -9,
    elevationMaxDeg: 20,
    notes: "105 mm L7. Assumed ~100 m AP.",
  },
  bow: false,
});

export const LEOPARD_1: HullBlueprint = ringHull({
  id: "leopard-1",
  name: "Leopard 1",
  shortName: "Leopard 1",
  class: "medium",
  nation: "germany",
  lengthM: 7.09,
  widthM: 3.25,
  hullYawRateDegPerSec: 34,
  forwardSpeedMps: 18.3,
  hp: 1200,
  armor: {
    hullFront: plate(70, 30),
    hullSide: plate(35),
    hullRear: plate(25),
    turretFront: plate(65),
    turretSide: plate(45),
    turretRear: plate(45),
  },
  notes:
    "Leopard 1: 105 mm L7A3, hydraulic 24°/s. Thin plate, fast hull. Armor/pen assumed 100 m AP.",
  traverse: { rate: 24, drive: "hydraulic", ringRadiusM: 0.88, offsetForwardM: 0.04 },
  gun: {
    caliberMm: 105,
    penMm: 260,
    damageHp: 310,
    elevationMinDeg: -9,
    elevationMaxDeg: 20,
    notes: "105 mm L7A3. Assumed ~100 m AP.",
  },
  bow: false,
});

export const EXPERT_HULLS: HullBlueprint[] = [
  M7_PRIEST,
  SU_76,
  WESPE,
  JAGDPANTHER,
  M4A3E8,
  M26_PERSHING,
  M46_PATTON,
  M47_PATTON,
  M48_PATTON,
  T44_100,
  T54,
  T54B,
  T62,
  T64A,
  PANTHER_F,
  E50,
  E75,
  STANDARDPANZER,
  LEOPARD_1,
];
