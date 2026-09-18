import type { HullInstance } from "./hull.ts";

/**
 * INTEL LAW v1 — what the team knows, drawn on the minimap.
 *
 * The minimap is a read-only projection of team knowledge. It never adds
 * knowledge; it only displays it. Aerial paints every living enemy for its
 * duration. Spotting marks enemies in any friendly hull's LOS, and a lost
 * mark lingers at last-known position for a short decay window.
 */
export const INTEL_LAW = {
  version: 1,
  frozenAt: "2026-09-17",
  evidence: "assumed" as const,
  /** Seconds a mark lingers at last-known position after LOS is lost. */
  staleDecayS: 4,
  /** Whether allies' LOS feeds the player's minimap (3v3 shared spotting). */
  teamShared: true,
  minimap: {
    /** Corner of the yard canvas. */
    anchor: "top-right" as const,
    sizePx: 148,
    marginPx: 14,
    /** When the frame is drawn at all. */
    show: "always" as const,
  },
  color: {
    friendly: "#6ee7a8", // COL.reticle — existing palette
    enemy: "#c45c4a", // COL.dead — existing palette
    stale: "#8a6a62", // enemy at 50% — last-known, not live
    self: "#e8ebe4", // COL.fg — outline on the player's own pip
  },
  deferred: [
    "Enemy-side minimap (AI already uses lastPlayerSeen; no display needed)",
    "Fog-of-war shading on the minimap",
    "Minimap ping / click-to-mark for squad",
    "Spot decay on the main yard (LOS_LAW deferred item; this law decays the mark only)",
  ],
} as const;

export type Team = "friendly" | "enemy";
export type MarkState = "live" | "aerial" | "stale";

export type IntelMark = {
  id: string;
  team: Team;
  x: number;
  y: number;
  hpRatio: number;
  state: MarkState;
  /** world.time when last seen. */
  seenAt: number;
};

export function teamOf(hull: { id: string }): Team {
  return hull.id === "player" || hull.id.startsWith("ally-") ? "friendly" : "enemy";
}

export function teamColor(team: Team, state?: MarkState): string {
  if (team === "friendly") return INTEL_LAW.color.friendly;
  return state === "stale" ? INTEL_LAW.color.stale : INTEL_LAW.color.enemy;
}

function markOf(hull: HullInstance, state: MarkState, seenAt: number): IntelMark {
  return {
    id: hull.id,
    team: teamOf(hull),
    x: hull.x,
    y: hull.y,
    hpRatio: hull.hpMax > 0 ? hull.hp / hull.hpMax : 0,
    state,
    seenAt,
  };
}

/**
 * Pure. Given the previous marks, the current world time, the living plates
 * and a `sees(from, to)` predicate, return the new mark table.
 * - friendly plates: always a live mark (you always know where your team is)
 * - enemy plate, aerialActive: live mark, state "aerial"
 * - enemy plate seen by any friendly (or by player only if !teamShared): "live"
 * - enemy plate not seen, previous mark exists, time - seenAt < staleDecayS: "stale", position frozen
 * - otherwise: no mark
 */
export function stepIntel(
  prev: Record<string, IntelMark>,
  time: number,
  friendly: readonly HullInstance[],
  enemy: readonly HullInstance[],
  sees: (from: HullInstance, to: HullInstance) => boolean,
  aerial: boolean,
  teamShared: boolean = INTEL_LAW.teamShared,
): Record<string, IntelMark> {
  const next: Record<string, IntelMark> = {};
  const eyes = teamShared ? friendly : friendly.filter((h) => h.id === "player");
  for (const h of friendly) {
    if (h.hp <= 0) continue;
    next[h.id] = markOf(h, "live", time);
  }
  for (const h of enemy) {
    if (h.hp <= 0) continue;
    if (aerial) {
      next[h.id] = markOf(h, "aerial", time);
      continue;
    }
    if (eyes.some((eye) => sees(eye, h))) {
      next[h.id] = markOf(h, "live", time);
      continue;
    }
    const old = prev[h.id];
    if (old && time - old.seenAt < INTEL_LAW.staleDecayS) {
      next[h.id] = { ...old, state: "stale" };
    }
  }
  return next;
}

/** World metres → minimap pixel, given arenaM and sizePx. Clamped to the frame. */
export function minimapPoint(
  xM: number,
  yM: number,
  arenaM: number,
  sizePx: number,
): { px: number; py: number } {
  const half = sizePx / 2;
  const clampPx = (v: number) => Math.min(sizePx, Math.max(0, v));
  return {
    px: clampPx(half + (xM / arenaM) * half),
    py: clampPx(half - (yM / arenaM) * half),
  };
}
