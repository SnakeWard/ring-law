import type { BattleRecord } from "../game/battle-report.ts";

export type HullCareer = {
  battles: number;
  wins: number;
  damage: number;
  kills: number;
  score: number;
};

export type CareerStats = {
  battles: number;
  wins: number;
  losses: number;
  score: number;
  xpEarned: number;
  silverEarned: number;
  damageDealt: number;
  damageTaken: number;
  shots: number;
  hits: number;
  penetrations: number;
  kills: number;
  spots: number;
  tracks: number;
  playSeconds: number;
  byHull: Record<string, HullCareer>;
};

export function emptyCareer(): CareerStats {
  return {
    battles: 0,
    wins: 0,
    losses: 0,
    score: 0,
    xpEarned: 0,
    silverEarned: 0,
    damageDealt: 0,
    damageTaken: 0,
    shots: 0,
    hits: 0,
    penetrations: 0,
    kills: 0,
    spots: 0,
    tracks: 0,
    playSeconds: 0,
    byHull: {},
  };
}

export function parseCareer(input: unknown): CareerStats {
  const empty = emptyCareer();
  if (!input || typeof input !== "object") return empty;
  const p = input as Partial<CareerStats>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0);
  const byHull: Record<string, HullCareer> = {};
  if (p.byHull && typeof p.byHull === "object") {
    for (const [id, row] of Object.entries(p.byHull)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Partial<HullCareer>;
      byHull[id] = {
        battles: n(r.battles),
        wins: n(r.wins),
        damage: n(r.damage),
        kills: n(r.kills),
        score: n(r.score),
      };
    }
  }
  return {
    battles: n(p.battles),
    wins: n(p.wins),
    losses: n(p.losses),
    score: n(p.score),
    xpEarned: n(p.xpEarned),
    silverEarned: n(p.silverEarned),
    damageDealt: n(p.damageDealt),
    damageTaken: n(p.damageTaken),
    shots: n(p.shots),
    hits: n(p.hits),
    penetrations: n(p.penetrations),
    kills: n(p.kills),
    spots: n(p.spots),
    tracks: n(p.tracks),
    playSeconds: n(p.playSeconds),
    byHull,
  };
}

export function recordCareer(
  stats: CareerStats,
  hullId: string,
  won: boolean,
  score: number,
  rec: BattleRecord | undefined,
  xpGained: number,
  silverGained: number,
  playSeconds: number,
): CareerStats {
  const next = parseCareer(stats);
  next.battles += 1;
  if (won) next.wins += 1;
  else next.losses += 1;
  next.score += Math.max(0, Math.round(score));
  next.xpEarned += Math.max(0, xpGained);
  next.silverEarned += Math.max(0, silverGained);
  next.playSeconds += Math.max(0, playSeconds);
  if (rec) {
    next.damageDealt += rec.damageDealt;
    next.damageTaken += rec.damageTaken;
    next.shots += rec.shots;
    next.hits += rec.hits;
    next.penetrations += rec.penetrations;
    next.kills += rec.kills;
    next.spots += rec.spots;
    next.tracks += rec.tracks;
  }
  const hull = next.byHull[hullId] ?? { battles: 0, wins: 0, damage: 0, kills: 0, score: 0 };
  hull.battles += 1;
  if (won) hull.wins += 1;
  hull.damage += rec?.damageDealt ?? 0;
  hull.kills += rec?.kills ?? 0;
  hull.score += Math.max(0, Math.round(score));
  next.byHull[hullId] = hull;
  return next;
}
