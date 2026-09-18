import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  LEVEL_LAW,
  mergeLevelLibraries,
  parseLevel,
  type LevelDoc,
} from "@/schema/level.ts";

function asPayload(doc: LevelDoc): string {
  return JSON.stringify(doc);
}

function payloadTooLarge(doc: LevelDoc): boolean {
  return asPayload(doc).length > LEVEL_LAW.maxPayloadBytes;
}

function parseRows(rows: { payload: unknown }[]): LevelDoc[] {
  const out: LevelDoc[] = [];
  for (const row of rows) {
    const doc = parseLevel(row.payload);
    if (doc) out.push(doc);
  }
  return out;
}

async function mapsForUser(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
): Promise<LevelDoc[]> {
  const rows = await sql.query<{ payload: unknown }>(
    `select payload from user_maps
     where user_id = $1
     order by updated_at desc
     limit $2`,
    [userId, LEVEL_LAW.maxSaved],
  );
  return parseRows(rows);
}

export const fetchUserMaps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return mapsForUser(sql, context.userId);
  });

export type PutUserMapResult =
  | { ok: true; doc: LevelDoc }
  | { ok: false; reason: "full" | "too-large" };

export const putUserMap = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const doc = parseLevel(d);
    if (!doc) throw new Error("Invalid map");
    return doc;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<PutUserMapResult> => {
    if (payloadTooLarge(data)) return { ok: false, reason: "too-large" };
    const sql = await getSql();
    const existing = await sql.query<{ map_id: string }>(
      `select map_id from user_maps where user_id = $1 and map_id = $2 limit 1`,
      [context.userId, data.id],
    );
    if (!existing[0]) {
      const countRows = await sql.query<{ n: number }>(
        `select count(*)::int as n from user_maps where user_id = $1`,
        [context.userId],
      );
      if ((countRows[0]?.n ?? 0) >= LEVEL_LAW.maxSaved) {
        return { ok: false, reason: "full" };
      }
    }
    await sql.query(
      `insert into user_maps (user_id, map_id, name, payload, updated_at)
       values ($1, $2, $3, $4::jsonb, $5::timestamptz)
       on conflict (user_id, map_id) do update
         set name = excluded.name,
             payload = excluded.payload,
             updated_at = excluded.updated_at`,
      [
        context.userId,
        data.id,
        data.name,
        asPayload(data),
        new Date(data.updatedAt).toISOString(),
      ],
    );
    return { ok: true, doc: data };
  });

export const deleteUserMap = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({
    id: String(d?.id ?? "")
      .trim()
      .slice(0, 64),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.id) return { ok: false };
    const sql = await getSql();
    await sql.query(`delete from user_maps where user_id = $1 and map_id = $2`, [
      context.userId,
      data.id,
    ]);
    return { ok: true };
  });

/** First sign-in (or a new device): merge this browser's maps into the account. */
export const claimUserMaps = createServerFn({ method: "POST" })
  .validator((docs: unknown) => {
    if (!Array.isArray(docs)) return [] as LevelDoc[];
    const out: LevelDoc[] = [];
    for (const item of docs.slice(0, LEVEL_LAW.maxSaved * 2)) {
      const doc = parseLevel(item);
      if (doc) out.push(doc);
    }
    return out;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const remote = await mapsForUser(sql, context.userId);
    const merged = mergeLevelLibraries(data, remote);
    for (const doc of merged) {
      if (payloadTooLarge(doc)) continue;
      const prev = remote.find((r) => r.id === doc.id);
      if (prev && prev.updatedAt >= doc.updatedAt) continue;
      const existing = await sql.query<{ map_id: string }>(
        `select map_id from user_maps where user_id = $1 and map_id = $2 limit 1`,
        [context.userId, doc.id],
      );
      if (!existing[0]) {
        const countRows = await sql.query<{ n: number }>(
          `select count(*)::int as n from user_maps where user_id = $1`,
          [context.userId],
        );
        if ((countRows[0]?.n ?? 0) >= LEVEL_LAW.maxSaved) continue;
      }
      await sql.query(
        `insert into user_maps (user_id, map_id, name, payload, updated_at)
         values ($1, $2, $3, $4::jsonb, $5::timestamptz)
         on conflict (user_id, map_id) do update
           set name = excluded.name,
               payload = excluded.payload,
               updated_at = excluded.updated_at`,
        [
          context.userId,
          doc.id,
          doc.name,
          asPayload(doc),
          new Date(doc.updatedAt).toISOString(),
        ],
      );
    }
    return mapsForUser(sql, context.userId);
  });
