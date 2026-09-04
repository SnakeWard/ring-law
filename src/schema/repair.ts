/**
 * REPAIR LAW — frozen 2026-09-03.
 *
 * A loss marks that hull unpaid. Cheap silver sink to take it out again.
 * A win costs nothing to repair. Unpaid blocks deploy on that hull only.
 * Other T1 hulls stay free so a broke garage can earn silver.
 */
export const REPAIR_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  lossCost: 800,
  winCost: 0,
  unpaidBlocksDeploy: true,
  deferred: [
    "Damage-scaled bill",
    "Win repair",
    "Module / track repair",
    "Insurance",
  ],
} as const;
