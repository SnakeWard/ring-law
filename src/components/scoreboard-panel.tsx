import { useEffect, useState } from "react";
import { listScoreboard, type ScoreboardRow } from "@/lib/scoreboard-cloud";

export function ScoreboardPanel({ selfId }: { selfId?: string }) {
  const [rows, setRows] = useState<ScoreboardRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void listScoreboard()
      .then((list) => {
        if (live) setRows(list);
      })
      .catch(() => {
        if (live) setError("Board is offline on this host.");
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">BOARD</p>
      <h2 className="text-2xl font-semibold tracking-tight">Global ledger</h2>
      <p className="text-sm text-muted">Career score, signed-in pilots only.</p>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {!rows ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No names on the board yet. Finish a fight.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] tracking-[0.12em] text-muted">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Pilot</th>
              <th className="py-1 pr-2">Score</th>
              <th className="py-1 pr-2">W–L</th>
              <th className="py-1 pr-2">Kills</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.userId}
                className={r.userId === selfId ? "bg-raised/80 font-medium" : undefined}
              >
                <td className="py-1 pr-2 font-mono text-subtle">{i + 1}</td>
                <td className="py-1 pr-2">{r.name || "Pilot"}</td>
                <td className="py-1 pr-2 text-reticle">{r.score}</td>
                <td className="py-1 pr-2 font-mono">
                  {r.wins}–{Math.max(0, r.battles - r.wins)}
                </td>
                <td className="py-1 pr-2">{r.kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
