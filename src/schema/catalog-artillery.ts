import type { HullBlueprint } from './hull.ts';
import { plate } from './armor.ts';
import { howitzerChipHp } from './howitzer.ts';

// Historical vehicles; HP, reload, movement and shared lob mode are game balance.
// Assault guns retain their real designation and mounting in the dossier.
const specs = [
  { id: 'm12-gmc', name: '155 mm Gun Motor Carriage M12', shortName: 'M12 GMC', nation: 'usa', length: 6.73, width: 2.67, speed: 38, yaw: 25, hp: 420, front: 51, side: 19, rear: 19, caliber: 155, gun: '155 mm M1917 GPF gun', arc: 14, elevation: 30,
    notes: 'M3-derived chassis with an exposed rear gun platform and recoil spade. A self-propelled field gun, represented by the artillery HE rules. Tier 5 support; light protection, heavy shell.' },
  { id: 'm43-hmc', name: '8-inch Howitzer Motor Carriage M43', shortName: 'M43 HMC', nation: 'usa', length: 7.12, width: 3.15, speed: 39, yaw: 22, hp: 620, front: 51, side: 25, rear: 19, caliber: 203.2, gun: '8-inch M115 howitzer', arc: 18, elevation: 45,
    notes: 'M4-derived HVSS chassis, open rear fighting platform and recoil spade. Actual 203.2 mm self-propelled howitzer. Tier 10 support; a larger blast and longer reload, not a turreted tank.' },
  { id: 'su-122', name: 'SU-122', shortName: 'SU-122', nation: 'ussr', length: 6.95, width: 3, speed: 55, yaw: 28, hp: 540, front: 45, side: 45, rear: 40, caliber: 122, gun: '122 mm M-30S howitzer', arc: 10, elevation: 25,
    notes: 'T-34 chassis with an enclosed sloped casemate. A real assault howitzer serving the artillery branch. Its shared long-range lob mode is a gameplay abstraction. Tier 5; aim the hull and relocate after firing.' },
  { id: 'isu-152', name: 'ISU-152', shortName: 'ISU-152', nation: 'ussr', length: 6.77, width: 3.07, speed: 37, yaw: 20, hp: 820, front: 90, side: 75, rear: 60, caliber: 152.4, gun: '152.4 mm ML-20S gun-howitzer', arc: 10, elevation: 20,
    notes: 'IS chassis with a closed armored casemate and prominent muzzle brake. A real heavy assault gun, not an open-top field SPG. Shared lob mode is a gameplay abstraction. Tier 10; stronger protection trades away mobility.' },
  { id: 'hummel', name: 'Sd.Kfz. 165 Hummel', shortName: 'Hummel', nation: 'germany', length: 6.66, width: 2.97, speed: 42, yaw: 26, hp: 440, front: 30, side: 10, rear: 10, caliber: 150, gun: '15 cm sFH 18/1 howitzer', arc: 15, elevation: 42,
    notes: 'Geschuetzwagen III/IV chassis with a tall open rear fighting compartment. An actual self-propelled field howitzer. Tier 5; heavier shell than Wespe, thin armor and a longer reload.' },
  { id: 'sturmtiger', name: 'Sturmtiger (38 cm RW 61)', shortName: 'Sturmtiger', nation: 'germany', length: 6.28, width: 3.57, speed: 40, yaw: 16, hp: 950, front: 150, side: 80, rear: 80, caliber: 380, gun: '380 mm RW 61 rocket mortar', arc: 10, elevation: 85,
    notes: 'Tiger I chassis carrying a short, enormous rocket mortar in a fixed armored casemate. A real assault mortar, not a conventional howitzer. Shared HE/lob rules abstract its rocket ammunition. Tier 10; huge burst, very long reload.' },
] as const;

export const ARTILLERY_ARMAMENT: Record<string, string> = Object.fromEntries(
  specs.map(s => [s.id + '-gun', s.gun]),
);

export const EXPANDED_ARTILLERY: HullBlueprint[] = specs.map(s => ({
  id: s.id, name: s.name, shortName: s.shortName, nation: s.nation, class: 'artillery',
  lengthM: s.length, widthM: s.width, hullYawRateDegPerSec: s.yaw,
  forwardSpeedMps: s.speed / 3.6, defaultEngineNorm: 1, hp: s.hp,
  armor: { hullFront: plate(s.front), hullSide: plate(s.side), hullRear: plate(s.rear),
    turretFront: plate(s.front), turretSide: plate(s.side), turretRear: plate(s.rear) },
  notes: s.notes + ' Nominal armor is simplified; durability and combat values are authored balance.',
  turrets: [],
  weapons: [{ id: s.id + '-gun', kind: 'howitzer', mount: 'hull_casemate', turretId: null,
    caliberMm: s.caliber, penMm: 0, damageHp: howitzerChipHp(s.caliber),
    arcMinDeg: -s.arc, arcMaxDeg: s.arc, elevationMinDeg: -3, elevationMaxDeg: s.elevation,
    mountTraverseDeg: s.arc, slavedToWeaponId: null, offsetForwardM: 1.2, offsetRightM: 0,
    notes: s.gun + '. Fixed hull mounting; HE artillery gameplay.' }],
}));

export const ARTILLERY_BRIEFS = specs.map(s => ({
  hullId: s.id, title: s.name, src: '',
  script: `${s.name}. ${s.gun}. ${s.notes}\nKeep friendly vehicles clear of the impact. A hit anywhere on a hull delivers full HE damage; nearby misses fall off beyond its armor. Watch the reload, pick your ground, and move before the reply arrives.`,
}));
