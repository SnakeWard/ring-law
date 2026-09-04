/**
 * CREDIT LAW — frozen 2026-09-03.
 *
 * Silver from a range win. Separate bank from XP.
 * T2 is XP-gated — credits never unlock a hull this freeze.
 * Loss pays nothing. T2 is still XP-gated. Repairs are CREDIT_LAW's first sink (see REPAIR_LAW).
 */
export const CREDIT_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  winCredits: 5000,
  lossCredits: 0,
  t2Cost: null,
  deferred: [
    "Silver purchase of hulls",
    "Credit multiplier",
  ],
} as const;
