import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { canPlay, parseGarage } from "@/schema/xp.ts";
import { hullFitsLobby } from "@/schema/squad.ts";
import { SOCIAL_LAW, type LobbyInvite, type OnlinePilot, type OpenLobbyRow } from "@/schema/social.ts";

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const heartbeat = createServerFn({ method: "POST" })
  .validator((d: { name: string }) => ({ name: String(d.name ?? "").slice(0, 64) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into presence (user_id, name, last_seen)
       values ($1, $2, now())
       on conflict (user_id) do update set name = excluded.name, last_seen = now()`,
      [context.userId, data.name || "Pilot"],
    );
    return { ok: true };
  });

export const listOnline = createServerFn({ method: "POST" })
  .validator((d: { q?: string }) => ({ q: String(d?.q ?? "").trim().slice(0, 32) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const q = data.q ? `%${data.q}%` : "%";
    const rows = await sql.query<{ user_id: string; name: string }>(
      `select user_id, name from presence
       where user_id <> $1
         and last_seen > now() - make_interval(secs => $2)
         and name ilike $3
       order by name asc
       limit $4`,
      [context.userId, SOCIAL_LAW.presenceTtlS, q, SOCIAL_LAW.searchCap],
    );
    return rows.map((r) => ({ userId: r.user_id, name: r.name, online: true })) satisfies OnlinePilot[];
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .validator((d: { userId: string }) => ({ userId: String(d.userId) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.userId || data.userId === context.userId) return { ok: false };
    const sql = await getSql();
    await sql.query(
      `insert into friend_requests (from_id, to_id, status)
       values ($1, $2, 'pending')
       on conflict (from_id, to_id) do nothing`,
      [context.userId, data.userId],
    );
    return { ok: true };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .validator((d: { fromId: string; accept: boolean }) => ({
    fromId: String(d.fromId),
    accept: !!d.accept,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update friend_requests set status = $3 where from_id = $1 and to_id = $2`,
      [data.fromId, context.userId, data.accept ? "accepted" : "declined"],
    );
    if (data.accept) {
      const [a, b] = pair(data.fromId, context.userId);
      await sql.query(
        `insert into friendships (user_a, user_b) values ($1, $2) on conflict do nothing`,
        [a, b],
      );
    }
    return { ok: true };
  });

export const listFriends = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ other_id: string; name: string; last_seen: string | Date | null }>(
      `select case when f.user_a = $1 then f.user_b else f.user_a end as other_id,
              coalesce(p.name, '') as name,
              p.last_seen
       from friendships f
       left join presence p on p.user_id = case when f.user_a = $1 then f.user_b else f.user_a end
       where f.user_a = $1 or f.user_b = $1
       order by name`,
      [context.userId],
    );
    const ttl = SOCIAL_LAW.presenceTtlS * 1000;
    const now = Date.now();
    return rows.map((r) => {
      const seen = r.last_seen ? new Date(r.last_seen).getTime() : 0;
      return {
        userId: r.other_id,
        name: r.name || "Pilot",
        online: now - seen < ttl,
      } satisfies OnlinePilot;
    });
  });

export const listRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ from_id: string; name: string }>(
      `select r.from_id, coalesce(p.name, r.from_id) as name
       from friend_requests r
       left join presence p on p.user_id = r.from_id
       where r.to_id = $1 and r.status = 'pending'`,
      [context.userId],
    );
    return rows.map((r) => ({ userId: r.from_id, name: r.name, online: true }));
  });

export const inviteToLobby = createServerFn({ method: "POST" })
  .validator((d: { toId: string; code: string }) => ({
    toId: String(d.toId),
    code: String(d.code).toUpperCase().slice(0, 8),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await sql.query(
      `insert into lobby_invites (id, from_id, to_id, code) values ($1, $2, $3, $4)`,
      [id, context.userId, data.toId, data.code],
    );
    return { ok: true, id };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; from_id: string; name: string; code: string }>(
      `select i.id, i.from_id, coalesce(p.name, i.from_id) as name, i.code
       from lobby_invites i
       left join presence p on p.user_id = i.from_id
       where i.to_id = $1
       order by i.created_at desc
       limit 20`,
      [context.userId],
    );
    return rows.map(
      (r) =>
        ({
          id: r.id,
          fromId: r.from_id,
          fromName: r.name,
          code: r.code,
        }) satisfies LobbyInvite,
    );
  });

export const publishLobby = createServerFn({ method: "POST" })
  .validator((d: OpenLobbyRow & { locked: boolean; openJoin: boolean; hostUserId?: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into public_lobbies
         (code, host_user_id, host_name, tier, format, map_id, locked, open_join, humans, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       on conflict (code) do update set
         host_name = excluded.host_name,
         tier = excluded.tier,
         format = excluded.format,
         map_id = excluded.map_id,
         locked = excluded.locked,
         open_join = excluded.open_join,
         humans = excluded.humans,
         updated_at = now()`,
      [
        data.code,
        context.userId,
        data.hostName,
        data.tier,
        data.format,
        data.mapId,
        data.locked,
        data.openJoin,
        data.humans,
      ],
    );
    return { ok: true };
  });

export const unpublishLobby = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => ({ code: String(d.code) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`delete from public_lobbies where code = $1 and host_user_id = $2`, [
      data.code,
      context.userId,
    ]);
    return { ok: true };
  });

export const listOpenLobbies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<OpenLobbyRow>(
      `select code, host_name as "hostName", tier, format, map_id as "mapId", humans
       from public_lobbies
       where open_join = true and locked = false
         and host_user_id <> $1
         and updated_at > now() - interval '3 minutes'
       order by updated_at desc
       limit 20`,
      [context.userId],
    );
    return rows;
  });

export const verifyLobbyHull = createServerFn({ method: "POST" })
  .validator((d: { userId: string; hullId: string; hostHullId: string }) => ({
    userId: String(d.userId),
    hullId: String(d.hullId),
    hostHullId: String(d.hostHullId),
  }))
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown }>(
      `select payload from garages where user_id = $1 limit 1`,
      [data.userId],
    );
    const g = parseGarage(rows[0]?.payload);
    return hullFitsLobby(data.hostHullId, data.hullId, (id) => canPlay(g, id));
  });
