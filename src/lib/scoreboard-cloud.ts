import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type ScoreboardRow = {
  userId: string;
  name: string;
  score: number;
  battles: number;
  wins: number;
  kills: number;
};

export const submitScoreboard = createServerFn({ method: "POST" })
  .validator((d: { name: string; score: number; battles: number; wins: number; kills: number }) => ({
    name: String(d.name ?? "").slice(0, 64),
    score: Math.max(0, Math.floor(Number(d.score) || 0)),
    battles: Math.max(0, Math.floor(Number(d.battles) || 0)),
    wins: Math.max(0, Math.floor(Number(d.wins) || 0)),
    kills: Math.max(0, Math.floor(Number(d.kills) || 0)),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into scoreboard (user_id, name, score, battles, wins, kills, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (user_id) do update set
         name = excluded.name,
         score = excluded.score,
         battles = excluded.battles,
         wins = excluded.wins,
         kills = excluded.kills,
         updated_at = now()`,
      [context.userId, data.name || "Pilot", data.score, data.battles, data.wins, data.kills],
    );
    return { ok: true };
  });

export const listScoreboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql.query<{
      user_id: string;
      name: string;
      score: number;
      battles: number;
      wins: number;
      kills: number;
    }>(
      `select user_id, name, score, battles, wins, kills
       from scoreboard
       order by score desc, wins desc, updated_at asc
       limit 40`,
    );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      score: r.score,
      battles: r.battles,
      wins: r.wins,
      kills: r.kills,
    })) satisfies ScoreboardRow[];
  });
