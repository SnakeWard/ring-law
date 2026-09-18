import type { HullClass } from "./enums.ts";

/**
 * BOT LAW v1 — class roles, stance shifts, no idle freeze.
 * Lights scout and hunt artillery. Mediums brawl. Heavies assault.
 * SPGs hold the rear. Anyone can fall back to cover when burning or thin.
 */
export const BOT_LAW = {
  version: 1,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  roles: {
    light: "scout",
    medium: "brawler",
    heavy: "assault",
    artillery: "battery",
  } as const,
  standoffM: {
    scout: 22,
    brawl: 11,
    hunt_arty: 8,
    cover: 1.4,
    fallback: 26,
    advance: 4,
  } as const,
  fallbackHp: 0.28,
  flankM: { light: 16, medium: 8, heavy: 4, artillery: 6 },
  scoutPushM: 14,
  bushReachM: 28,
  deferred: ["Smoke pop", "Radio calls", "Shared fire plan"],
} as const;

export type BotStance =
  | "advance"
  | "scout"
  | "brawl"
  | "cover"
  | "hunt_arty"
  | "fallback";

export type BotView = {
  id: string;
  x: number;
  y: number;
  class: HullClass;
  hpRatio: number;
  onFire: boolean;
  south: boolean;
  arenaM: number;
  inCover: boolean;
  seen: { x: number; y: number } | null;
  lastKnown: { x: number; y: number } | null;
  arty: { x: number; y: number } | null;
  bushes: readonly { x: number; y: number }[];
};

export function pickBotStance(v: BotView): BotStance {
  if (v.onFire || v.hpRatio <= BOT_LAW.fallbackHp) return "fallback";
  if (v.class === "artillery") {
    if (v.seen && !v.inCover && v.bushes.length) return "cover";
    return v.seen ? "cover" : "advance";
  }
  if (v.class === "light") {
    if (v.arty) return "hunt_arty";
    return "scout";
  }
  if (v.class === "heavy") {
    if (v.seen) return v.hpRatio > 0.4 ? "brawl" : "cover";
    return "advance";
  }
  if (v.seen && v.hpRatio < 0.55 && nearestBush(v, v.seen.x, v.seen.y)) return "cover";
  if (v.seen) return "brawl";
  return "advance";
}

export function flankSign(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33) ^ id.charCodeAt(i);
  return (h & 1) === 0 ? -1 : 1;
}

export function nearestBush(
  v: Pick<BotView, "x" | "y" | "bushes">,
  threatX: number,
  threatY: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = Infinity;
  for (const b of v.bushes) {
    const dSelf = Math.hypot(b.x - v.x, b.y - v.y);
    if (dSelf > BOT_LAW.bushReachM) continue;
    const dThreat = Math.hypot(b.x - threatX, b.y - threatY);
    if (dThreat < 5) continue;
    const score = dSelf - dThreat * 0.2;
    if (score < bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

function clampArena(x: number, y: number, arena: number): { x: number; y: number } {
  const m = arena - 3;
  return {
    x: Math.max(-m, Math.min(m, x)),
    y: Math.max(-m, Math.min(m, y)),
  };
}

function standoffFrom(
  v: BotView,
  mark: { x: number; y: number },
  range: number,
  stray = 0,
): { x: number; y: number } {
  const dx = v.x - mark.x;
  const dy = v.y - mark.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const nx = dx / d;
  const ny = dy / d;
  const side = flankSign(v.id);
  return clampArena(
    mark.x + nx * range + ny * side * stray,
    mark.y + ny * range - nx * side * stray,
    v.arenaM,
  );
}

export function botGoal(v: BotView): { x: number; y: number; hold: boolean } {
  const stance = pickBotStance(v);
  const fwd = v.south ? 1 : -1;
  const side = flankSign(v.id);
  const flank = BOT_LAW.flankM[v.class] * side;
  const mark = v.seen ?? v.lastKnown;

  if (stance === "fallback") {
    const from = mark ?? { x: v.x, y: v.y - fwd * 8 };
    const bush = nearestBush(v, from.x, from.y);
    if (bush) return { ...bush, hold: true };
    return {
      ...clampArena(v.x - (from.x - v.x), v.y - fwd * 12, v.arenaM),
      hold: false,
    };
  }
  if (stance === "cover") {
    const threat = mark ?? { x: v.x, y: v.y + fwd * 20 };
    if (v.inCover) return { x: v.x, y: v.y, hold: true };
    const bush = nearestBush(v, threat.x, threat.y);
    if (bush) return { ...bush, hold: true };
  }
  if (stance === "hunt_arty" && v.arty) {
    return { ...standoffFrom(v, v.arty, BOT_LAW.standoffM.hunt_arty, 2), hold: false };
  }
  if (stance === "scout") {
    if (mark) return { ...standoffFrom(v, mark, BOT_LAW.standoffM.scout, 8), hold: false };
    return {
      ...clampArena(v.x + flank, v.y + fwd * BOT_LAW.scoutPushM, v.arenaM),
      hold: false,
    };
  }
  if (stance === "brawl" && mark) {
    const d = Math.hypot(v.x - mark.x, v.y - mark.y);
    return {
      ...standoffFrom(v, mark, BOT_LAW.standoffM.brawl, 0),
      hold: d < 16 && d > 7,
    };
  }
  if (v.class === "artillery") {
    const home = v.south ? -v.arenaM * 0.42 : v.arenaM * 0.42;
    return { ...clampArena(v.x + flank * 0.4, home, v.arenaM), hold: true };
  }
  if (mark) return { ...standoffFrom(v, mark, BOT_LAW.standoffM.advance), hold: false };
  return {
    ...clampArena(v.x + flank * 0.5, v.y + fwd * 12, v.arenaM),
    hold: false,
  };
}
