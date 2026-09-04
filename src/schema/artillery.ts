import type { HullBlueprint } from "./hull.ts";

/**
 * ARTILLERY LAW v2 — Expert freeze compiled 2026-09-04.
 *
 * Artillery is a playable class. Open-top casemate SPGs, not rings.
 * Howitzer HE. Canonical hull is M7 Priest. SU-76 and Wespe ride with it.
 * Indirect map-click and flight time stay Planned.
 */
export const ARTILLERY_LAW = {
  version: 2,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  classId: "artillery" as const,
  locked: false,
  hullId: "m7-priest",
  hulls: {
    usa: "m7-priest",
    ussr: "su-76",
    germany: "wespe",
  },
  researchCost: null,
  canPlay: true,
  isTurret: false,
  gunKind: "howitzer" as const,
  mount: "hull_casemate" as const,
  deferred: [
    "Indirect fire / map click",
    "Howitzer flight time (range / muzzle)",
    "Pintle AA as player aim",
  ],
} as const;

export function canResearchArtillery(): false {
  return false;
}

export function assertArtilleryLaws(hulls: HullBlueprint[]): string[] {
  const errors: string[] = [];
  if (ARTILLERY_LAW.hullId !== "m7-priest") errors.push("canonical artillery hull is M7 Priest");
  if (ARTILLERY_LAW.researchCost != null) errors.push("artillery has no research cost this freeze");
  if (!ARTILLERY_LAW.canPlay) errors.push("artillery must be playable this freeze");
  if (ARTILLERY_LAW.isTurret) errors.push("artillery is not a ring");
  if (ARTILLERY_LAW.locked) errors.push("artillery must not stay locked");
  const want = new Set(Object.values(ARTILLERY_LAW.hulls));
  const found = new Set<string>();
  for (const h of hulls) {
    if (h.class !== ARTILLERY_LAW.classId) continue;
    found.add(h.id);
    if (h.turrets.length !== 0) errors.push(`${h.id}: artillery is a casemate, not a ring`);
    const gun = h.weapons.find((w) => w.mount === "hull_casemate" && w.kind === "howitzer");
    if (!gun) errors.push(`${h.id}: needs a hull_casemate howitzer`);
    if (gun?.turretId) errors.push(`${h.id}: howitzer must not sit on a ring`);
  }
  for (const id of want) {
    if (!found.has(id)) errors.push(`missing artillery hull ${id}`);
  }
  return errors;
}
