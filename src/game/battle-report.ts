import type { Facet, HitReport } from '../schema/armor.ts';

export type BattleRecord = {
  shots: number;
  hits: number;
  penetrations: number;
  bounces: number;
  heHits: number;
  damageDealt: number;
  damageTaken: number;
  friendlyDamage: number;
  kills: number;
  tracks: number;
  spots: number;
  facets: Partial<Record<Facet, number>>;
};
export const emptyBattleRecord = (): BattleRecord => ({
  shots: 0, hits: 0, penetrations: 0, bounces: 0, heHits: 0,
  damageDealt: 0, damageTaken: 0, friendlyDamage: 0,
  kills: 0, tracks: 0, spots: 0, facets: {},
});
export function recordImpact(record: BattleRecord, hit: HitReport, he: boolean) {
  record.hits++;
  record.facets[hit.facet] = (record.facets[hit.facet] ?? 0) + 1;
  if (he) record.heHits++;
  else if (hit.kind === 'bounce') record.bounces++;
  else record.penetrations++;
}
export function recordDamage(records: Record<string, BattleRecord>, source: string | undefined,
  victim: string, before: number, after: number, friendly: boolean) {
  const damage = Math.max(0, before - Math.max(0, after));
  (records[victim] ??= emptyBattleRecord()).damageTaken += damage;
  if (source) {
    const r = records[source] ??= emptyBattleRecord();
    if (friendly) r.friendlyDamage += damage;
    else r.damageDealt += damage;
  }
}
