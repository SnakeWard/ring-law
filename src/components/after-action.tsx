import { emptyBattleRecord, type BattleRecord } from "../game/battle-report.ts";
import { hullById, isSouthId, plateScore, type ScoreInputs } from "@/schema";

export type RosterCard = {
  id: string;
  label: string;
  hullName: string;
  south: boolean;
  pilot: "human" | "bot";
  self: boolean;
  score: number;
  record: BattleRecord;
};

export function rosterFromWorld(world: {
  battle: Record<string, BattleRecord>;
  outcome: "win" | "loss" | null;
  selfId: string;
  pilots: Record<string, "human" | "bot">;
  player: { id: string; blueprintId: string };
  dummy: { id: string; blueprintId: string };
  allies: { id: string; blueprintId: string }[];
  foes: { id: string; blueprintId: string }[];
}): RosterCard[] {
  const plates = [world.player, world.dummy, ...world.allies, ...world.foes];
  const southWon = world.outcome === "win";
  return plates
    .map((h) => {
      const rec = world.battle[h.id] ?? emptyBattleRecord();
      const south = isSouthId(h.id);
      const won = world.outcome != null && south === southWon;
      const score = plateScore(rec as ScoreInputs, won);
      return {
        id: h.id,
        label: h.id === "player" ? "You" : h.id,
        hullName: hullById(h.blueprintId)?.shortName ?? h.blueprintId,
        south,
        pilot: world.pilots[h.id] ?? (h.id === "player" ? "human" : "bot"),
        self: h.id === world.selfId,
        score,
        record: rec,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function AfterAction({
  record = emptyBattleRecord(),
  roster,
}: {
  record?: BattleRecord;
  roster?: RosterCard[];
}) {
  const rows = roster?.length
    ? roster
    : [
        {
          id: "player",
          label: "You",
          hullName: "",
          south: true,
          pilot: "human" as const,
          self: true,
          score: plateScore(record as ScoreInputs, true),
          record,
        },
      ];
  return (
    <section aria-label="After-action report" className="mt-4 rounded-md border border-line p-3">
      <h3 className="text-sm font-semibold">After-action</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="font-mono text-[10px] tracking-[0.12em] text-muted">
            <tr>
              <th className="py-1 pr-2">Plate</th>
              <th className="py-1 pr-2">Pilot</th>
              <th className="py-1 pr-2">Score</th>
              <th className="py-1 pr-2">Dmg</th>
              <th className="py-1 pr-2">Pen</th>
              <th className="py-1 pr-2">Kills</th>
              <th className="py-1 pr-2">Spot</th>
              <th className="py-1 pr-2">Track</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={r.self ? "bg-raised/80 font-medium" : undefined}
              >
                <td className="py-1 pr-2">
                  {r.hullName || r.label}
                  {r.self ? " · you" : ""}
                </td>
                <td className="py-1 pr-2 font-mono uppercase text-subtle">
                  {r.pilot === "bot" ? "bot" : "human"}
                </td>
                <td className="py-1 pr-2 text-reticle">{r.score}</td>
                <td className="py-1 pr-2">{Math.round(r.record.damageDealt)}</td>
                <td className="py-1 pr-2">{r.record.penetrations}</td>
                <td className="py-1 pr-2">{r.record.kills}</td>
                <td className="py-1 pr-2">{r.record.spots}</td>
                <td className="py-1 pr-2">{r.record.tracks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Score is pens, damage, kills, first spots, and immobilisations. Win or
        loss is a bonus. Bots are scored the same as pilots.
      </p>
    </section>
  );
}
