/**
 * SCORE LAW v1 — performance payout.
 * Pens, HP removed, kills, first spots, and track breaks make the card.
 * Win/loss is a bonus, not the whole cheque. Bots are scored the same way.
 */
export const SCORE_LAW = {
  version: 1,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  pen: 15,
  damage: 1,
  kill: 200,
  spot: 80,
  track: 60,
  winBonus: 400,
  lossBonus: 80,
  xpPerPoint: 0.45,
  silverPerPoint: 2.2,
  minXpWin: 200,
  maxXp: 2800,
  minSilverWin: 800,
  maxSilver: 12000,
  minXpLoss: 40,
  minSilverLoss: 0,
} as const;

export type ScoreInputs = {
  penetrations: number;
  damageDealt: number;
  kills: number;
  spots: number;
  tracks: number;
};

export function plateScore(record: ScoreInputs, won: boolean): number {
  return (
    record.penetrations * SCORE_LAW.pen +
    Math.round(record.damageDealt) * SCORE_LAW.damage +
    record.kills * SCORE_LAW.kill +
    record.spots * SCORE_LAW.spot +
    record.tracks * SCORE_LAW.track +
    (won ? SCORE_LAW.winBonus : SCORE_LAW.lossBonus)
  );
}

export function xpFromScore(score: number, won: boolean): number {
  const raw = Math.round(score * SCORE_LAW.xpPerPoint);
  if (won) return Math.max(SCORE_LAW.minXpWin, Math.min(SCORE_LAW.maxXp, raw));
  return Math.max(SCORE_LAW.minXpLoss, Math.min(SCORE_LAW.maxXp, raw));
}

export function silverFromScore(score: number, won: boolean): number {
  const raw = Math.round(score * SCORE_LAW.silverPerPoint);
  if (won) return Math.max(SCORE_LAW.minSilverWin, Math.min(SCORE_LAW.maxSilver, raw));
  return Math.max(SCORE_LAW.minSilverLoss, Math.min(SCORE_LAW.maxSilver, raw));
}
