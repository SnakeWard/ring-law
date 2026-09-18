import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseGarage, type Garage } from "@/schema/xp.ts";

function asPayload(g: Garage): string {
  return JSON.stringify(g);
}

export const fetchGarage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown }>(
      "select payload from garages where user_id = $1 limit 1",
      [context.userId],
    );
    if (!rows[0]) return null;
    return parseGarage(rows[0].payload);
  });

export const putGarage = createServerFn({ method: "POST" })
  .validator((g: Garage) => parseGarage(g))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into garages (user_id, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update
         set payload = excluded.payload, updated_at = now()`,
      [context.userId, asPayload(data)],
    );
    return data;
  });

/** First sign-in: keep the server row if it exists, else seed from this device. */
export const claimGarage = createServerFn({ method: "POST" })
  .validator((g: Garage) => parseGarage(g))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql.query<{ payload: unknown }>(
      "select payload from garages where user_id = $1 limit 1",
      [context.userId],
    );
    if (existing[0]) return parseGarage(existing[0].payload);
    await sql.query(
      `insert into garages (user_id, payload, imported_local, updated_at)
       values ($1, $2::jsonb, true, now())
       on conflict (user_id) do nothing`,
      [context.userId, asPayload(data)],
    );
    const rows = await sql.query<{ payload: unknown }>(
      "select payload from garages where user_id = $1 limit 1",
      [context.userId],
    );
    return parseGarage(rows[0]?.payload ?? data);
  });
