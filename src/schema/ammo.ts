import type { Facet, HitReport } from "./armor.ts";

/**
 * AMMO LAW — frozen 2026-09-03.
 *
 * Side / rear pen can COOK the hull. Not a WoT module bingo.
 * Bounce never racks. Front and turret face/side do not.
 * Cook = burst HP + fire. No detonation instakill, no repair.
 */
export const AMMO_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  bounceNeverRacks: true,
  chance: {
    hull_front: 0,
    hull_side: 0.22,
    hull_rear: 0.4,
    turret_front: 0,
    turret_side: 0,
    turret_rear: 0.15,
  } as Record<Facet, number>,
  /** Extra HP as a fraction of hpMax on a cook. */
  cookFrac: 0.32,
  deferred: [
    "Full ammo detonation / one-shot bingo",
    "Turret-side racks",
    "Wet stowage / nation differences",
    "Repair / extinguisher",
  ],
} as const;

export type AmmoHost = {
  hp: number;
  hpMax: number;
  onFire: boolean;
};

export type AmmoReport = {
  cooked: boolean;
  damage: number;
};

export function ammoChance(facet: Facet): number {
  return AMMO_LAW.chance[facet] ?? 0;
}

export function tryAmmoCook(
  host: AmmoHost,
  hit: HitReport,
  rng: () => number = Math.random,
): AmmoReport {
  if (hit.kind === "bounce" || hit.damage <= 0) {
    return { cooked: false, damage: 0 };
  }
  const p = ammoChance(hit.facet);
  if (p <= 0 || rng() >= p) return { cooked: false, damage: 0 };
  const damage = Math.max(1, Math.round(host.hpMax * AMMO_LAW.cookFrac));
  host.onFire = true;
  host.hp = Math.max(0, host.hp - damage);
  return { cooked: true, damage };
}

export function formatAmmo(a: AmmoReport): string {
  if (!a.cooked) return "";
  return ` · AMMO −${a.damage}`;
}
