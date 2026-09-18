import { emptyBattleRecord, type BattleRecord } from '../game/battle-report.ts';

export function AfterAction({ record = emptyBattleRecord() }: { record?: BattleRecord }) {
  return <section aria-label="After-action report" className="mt-4 rounded-md border border-line p-3">
    <h3 className="text-sm font-semibold">Your after-action report</h3>
    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
      {Object.entries({ 'Main-gun shots': record.shots, 'Plate hits': record.hits,
        'Penetrations / overmatches': record.penetrations, 'Bounces': record.bounces,
        'HE plate hits': record.heHits, 'Enemy damage': record.damageDealt,
        'Damage taken': record.damageTaken, 'Friendly / self damage': record.friendlyDamage,
      }).map(([label,value]) => <div key={label}><dt className="text-muted">{label}</dt><dd>{Math.round(value)}</dd></div>)}
    </dl>
    <p className="mt-2 text-xs text-muted">Actual HP removed, including cook-offs, fire and splash. Automatic guns excluded from shot and hit counts. Splash has no armor facet.</p>
    <p className="mt-2 text-xs">Facets hit: {Object.entries(record.facets).map(([facet,count]) => `${facet.replaceAll('_',' ')} ${count}`).join(' · ') || 'None'}</p>
  </section>;
}
