/**
 * CONSUMABLE LAW v1 — silver sinks you take onto the yard.
 *
 * Repair kit: pulls a track, kills a fire, and patches hull in the fight.
 * Aerial: a timed overlay that paints every enemy on the map.
 * Bought in the garage, spent in the trial. Not insurance, not a free repair bill.
 */
export const CONSUMABLE_LAW = {
  version: 1,
  frozenAt: "2026-09-15",
  evidence: "assumed" as const,
  repairKit: {
    cost: 700,
    healHp: 90,
    maxCarry: 3,
  },
  aerial: {
    cost: 1600,
    durationS: 14,
    maxCarry: 2,
  },
} as const;

export function kitCost(): number {
  return CONSUMABLE_LAW.repairKit.cost;
}

export function aerialCost(): number {
  return CONSUMABLE_LAW.aerial.cost;
}
