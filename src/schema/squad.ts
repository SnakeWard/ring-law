import { hullById } from "./catalog.ts";
import { nodeByHull } from "./tree.ts";
import type { HullClass } from "./enums.ts";

/**
 * MATCH LAW v1 — 1v1, 2v2, 3v3 on the range.
 *
 * Tier band: nobody sits more than one tier above the player's hull.
 * 2v2: any mix of light / medium / heavy / artillery.
 * 3v3: at most one artillery per team.
 * Enemies fill the same size and band. Artillery is a side branch (tier 0)
 * and counts as T1 for the band.
 */
export const MATCH_LAW = {
  version: 2,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  formats: ["1v1", "2v2", "3v3", "4v4"] as const,
  size: { "1v1": 1, "2v2": 2, "3v3": 3, "4v4": 4 },
  maxTierUp: 1,
  maxArty: { "1v1": 1, "2v2": 2, "3v3": 1, "4v4": 1 },
  /** 2v2+ stay off the 36 m dirt range. */
  minArenaM: { "1v1": 0, "2v2": 64, "3v3": 64, "4v4": 64 },
  spreadM: { 1: [0], 2: [0, -8], 3: [0, -11, 11], 4: [0, -12, 12, 24] } as Record<number, readonly number[]>,
} as const;

export type MatchFormat = (typeof MATCH_LAW.formats)[number];

export function formatSize(format: MatchFormat): number {
  return MATCH_LAW.size[format];
}

export function mapAllowsFormat(arenaM: number, format: MatchFormat): boolean {
  return arenaM >= MATCH_LAW.minArenaM[format];
}

export function isArtilleryHull(hullId: string): boolean {
  return hullById(hullId)?.class === "artillery";
}

export function hullTier(hullId: string): number {
  const node = nodeByHull(hullId);
  if (!node) return 1;
  if (node.class === "artillery") return 1;
  return node.tier;
}

export function hullClassOf(hullId: string): HullClass | undefined {
  return hullById(hullId)?.class;
}

/** Host sets the band. Joiners may bring that tier or one above if they can play it. */
export function hullFitsLobby(
  hostHullId: string,
  joinerHullId: string,
  playable: (id: string) => boolean,
): boolean {
  if (!hullById(joinerHullId) || !playable(joinerHullId)) return false;
  return hullTier(joinerHullId) <= hullTier(hostHullId) + MATCH_LAW.maxTierUp;
}

export function countArtillery(ids: readonly string[]): number {
  return ids.filter(isArtilleryHull).length;
}

export function squadSlotCount(format: MatchFormat): number {
  return Math.max(0, formatSize(format) - 1);
}

export function validateSquad(
  playerId: string,
  squad: readonly string[],
  format: MatchFormat,
  playable: (id: string) => boolean,
): string[] {
  const errors: string[] = [];
  const need = squadSlotCount(format);
  const picked = squad.slice(0, need);
  if (picked.length !== need) errors.push(`${format} needs ${need} teammate${need === 1 ? "" : "s"}`);
  const cap = hullTier(playerId) + MATCH_LAW.maxTierUp;
  for (const id of picked) {
    if (!hullById(id)) errors.push(`unknown hull ${id}`);
    else if (!playable(id)) errors.push(`${id} is locked`);
    else if (hullTier(id) > cap) errors.push(`${id} is more than one tier up`);
  }
  const team = [playerId, ...picked];
  if (countArtillery(team) > MATCH_LAW.maxArty[format]) {
    errors.push(`${format} may field at most ${MATCH_LAW.maxArty[format]} artillery`);
  }
  return errors;
}

export function squadReady(
  playerId: string,
  squad: readonly string[],
  format: MatchFormat,
  playable: (id: string) => boolean,
): boolean {
  return validateSquad(playerId, squad, format, playable).length === 0;
}

export function pickEnemyIds(
  playerId: string,
  squad: readonly string[],
  format: MatchFormat,
  counter: (id: string) => string,
): string[] {
  const n = formatSize(format);
  const cap = hullTier(playerId) + MATCH_LAW.maxTierUp;
  const ids = [counter(playerId)];
  const used = new Set(ids);
  const extras = squad.length ? squad : [playerId];
  for (let i = 1; i < n; i++) {
    const seed = extras[(i - 1) % extras.length];
    let id = counter(seed);
    if (used.has(id) || (format === "3v3" && isArtilleryHull(id) && countArtillery(ids) >= 1)) {
      const alt = CATALOG_FALLBACK.find(
        (h) =>
          !used.has(h) &&
          hullTier(h) <= cap &&
          hullTier(h) >= Math.min(hullTier(playerId), 1) &&
          !(format === "3v3" && isArtilleryHull(h) && countArtillery(ids) >= 1),
      );
      id = alt ?? id;
    }
    ids.push(id);
    used.add(id);
  }
  return ids.slice(0, n);
}

const CATALOG_FALLBACK = [
  "m2a4",
  "t-28",
  "tiger-i",
  "m3-stuart",
  "t-28e",
  "tiger-ii",
  "m5-stuart",
  "t-34",
  "panther",
  "m7-priest",
  "su-76",
  "wespe",
] as const;

export type TeamSpawn = { x: number; y: number; yawDeg: number };

export function teamSpawns(
  spawnY: number,
  count: number,
  side: "south" | "north",
): TeamSpawn[] {
  const xs = MATCH_LAW.spreadM[count] ?? MATCH_LAW.spreadM[1];
  const y = side === "south" ? -spawnY : spawnY;
  const yaw = side === "south" ? 0 : 180;
  const sign = side === "south" ? 1 : -1;
  return xs.slice(0, count).map((x) => ({ x: x * sign || 0, y, yawDeg: yaw }));
}
