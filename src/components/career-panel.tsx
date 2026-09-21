import {
  ACHIEVEMENTS,
  emptyCareer,
  hullById,
  type Garage,
} from "@/schema";

export function CareerPanel({ garage }: { garage: Garage }) {
  const s = garage.stats ?? emptyCareer();
  const wr = s.battles > 0 ? Math.round((s.wins / s.battles) * 100) : 0;
  const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
  const hulls = Object.entries(s.byHull).sort((a, b) => b[1].score - a[1].score).slice(0, 4);
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">RECORD</p>
      <h2 className="text-2xl font-semibold tracking-tight">Career book</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Score" value={Math.round(s.score)} hot />
        <Stat label="Battles" value={`${s.wins}–${s.losses}`} />
        <Stat label="Win %" value={`${wr}`} />
        <Stat label="Kills" value={s.kills} />
        <Stat label="Damage" value={Math.round(s.damageDealt)} />
        <Stat label="Pens" value={s.penetrations} />
        <Stat label="Hits %" value={`${acc}`} />
        <Stat label="Spots" value={s.spots} />
      </div>
      {hulls.length ? (
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted">BY HULL</p>
          <ul className="mt-2 space-y-1 text-sm">
            {hulls.map(([id, row]) => (
              <li key={id} className="flex justify-between border-b border-line py-1">
                <span>{hullById(id)?.shortName ?? id}</span>
                <span className="font-mono text-subtle">
                  {row.wins}/{row.battles} · {Math.round(row.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">MARKS</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const on = Boolean(garage.achievements?.[a.id]);
          return (
            <div
              key={a.id}
              className={
                "rounded-md border px-3 py-2 " +
                (on ? "border-reticle bg-raised" : "border-line opacity-60")
              }
            >
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted">{a.blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string | number; hot?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-bg px-3 py-2">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{label}</p>
      <p className={"font-mono text-lg tabular-nums " + (hot ? "text-reticle" : "")}>{value}</p>
    </div>
  );
}
