import { TREE_LAW, nextOnLine, nodeByHull, tankNodesFor } from "./tree.ts";
import { CREDIT_LAW } from "./credits.ts";
import { REPAIR_LAW } from "./repair.ts";
import type { RoundKind } from "./apcr.ts";
import { MAP_IDS, MAP_LAW, isCustomMapId, type MapId } from "./maps.ts";
import { CONSUMABLE_LAW } from "./consumable.ts";
import type { MatchFormat } from "./squad.ts";
import { xpFromScore, silverFromScore } from "./score.ts";
import { emptyCareer, parseCareer, recordCareer, type CareerStats } from "./career.ts";
import { evaluateAchievements, parseAchievements } from "./achievements.ts";
import { withinTierCap } from "./guest.ts";
import {
  hasModule,
  hullModules,
  moduleCost,
  parseModules,
  type ModuleSlot,
} from "./modules.ts";
import type { BattleRecord } from "../game/battle-report.ts";

/**
 * XP LAW — Expert freeze v6 compiled 2026-09-04.
 *
 * One range win researches that T1.
 * Each later win on a researched hull spends 1000 XP on the next tank on that line.
 * Artillery is free-play — wins in Priest do not buy the tank line.
 */
export const XP_LAW = {
  version: 6,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  winXp: 1000,
  lossXp: 0,
  t1Cost: 1000,
  t2Cost: 1000,
  t3Cost: 1000,
  t4Cost: 1000,
  t5Cost: 1000,
  t6Cost: 1000,
  t7Cost: 1000,
  t8Cost: 1000,
  t9Cost: 1000,
  t10Cost: 1000,
  storageKey: "ring-garage-v1",
  deferred: [
    "Free XP / conversion",
    "Daily first-win bonus",
  ],
} as const;

export type Garage = {
  xp: number;
  credits: number;
  researched: Record<string, boolean>;
  needsRepair: Record<string, boolean>;
  round: RoundKind;
  /** A baked MapId or a `custom:` editor map id. */
  mapId: string;
  match: MatchFormat;
  squad: string[];
  repairKits: number;
  aerials: number;
  stats: CareerStats;
  achievements: Record<string, number>;
  modules: Record<string, string[]>;
};

export function emptyGarage(): Garage {
  return {
    xp: 0,
    credits: 0,
    researched: {},
    needsRepair: {},
    round: "ap",
    mapId: MAP_LAW.defaultMap,
    match: "1v1",
    squad: [],
    repairKits: 0,
    aerials: 0,
    stats: emptyCareer(),
    achievements: {},
    modules: {},
  };
}

export type WinPayout = {
  garage: Garage;
  gained: number;
  creditsGained: number;
  researchedHullId: string | null;
  newMarks: string[];
};

export type LossPayout = {
  garage: Garage;
  creditsGained: number;
  repairDue: number;
  hullId: string;
  newMarks: string[];
};

export function isResearched(garage: Garage, hullId: string): boolean {
  return garage.researched[hullId] === true;
}

export function researchCost(tier: number): number | null {
  if (tier >= 1 && tier <= 10) return 1000;
  return null;
}

function tryBuy(garage: Garage, hullId: string, tier: number, maxTier?: number): boolean {
  if (garage.researched[hullId]) return false;
  if (maxTier != null && tier > maxTier) return false;
  const cost = researchCost(tier);
  if (cost == null || garage.xp < cost) return false;
  garage.xp -= cost;
  garage.researched[hullId] = true;
  return true;
}

/**
 * `maxTier` caps what this player may drive (guests: GUEST_LAW.maxTier).
 * Omitted = no cap.
 */
export function canPlay(garage: Garage, hullId: string, maxTier?: number): boolean {
  if (!withinTierCap(hullId, maxTier)) return false;
  if ((TREE_LAW.lockedClasses as readonly string[]).includes(hullId)) return false;
  const node = nodeByHull(hullId);
  if (!node?.hullId) return false;
  if (node.class === "artillery") return node.unlocked || tankNodesFor(node.nation).some(
    (tank) => tank.tier >= node.tier && !!tank.hullId && isResearched(garage, tank.hullId),
  );
  if (node.tier === 1) return true;
  return isResearched(garage, hullId);
}

export function hullNeedsRepair(garage: Garage, hullId: string): boolean {
  return garage.needsRepair[hullId] === true;
}

export function canDeploy(garage: Garage, hullId: string, maxTier?: number): boolean {
  if (!canPlay(garage, hullId, maxTier)) return false;
  if (!hullNeedsRepair(garage, hullId)) return true;
  return garage.credits >= REPAIR_LAW.lossCost;
}

export function tryRepair(garage: Garage, hullId: string): Garage {
  if (!hullNeedsRepair(garage, hullId)) return garage;
  if (garage.credits < REPAIR_LAW.lossCost) return garage;
  const needsRepair = { ...garage.needsRepair };
  delete needsRepair[hullId];
  return {
    ...garage,
    credits: garage.credits - REPAIR_LAW.lossCost,
    needsRepair,
  };
}

function stampCareer(
  garage: Garage,
  hullId: string,
  won: boolean,
  score: number,
  rec: BattleRecord | undefined,
  xpGained: number,
  silverGained: number,
  playSeconds: number,
): { stats: CareerStats; achievements: Record<string, number>; newMarks: string[] } {
  const stats = recordCareer(
    garage.stats ?? emptyCareer(),
    hullId,
    won,
    score,
    rec,
    xpGained,
    silverGained,
    playSeconds,
  );
  const newMarks = evaluateAchievements({
    researched: garage.researched,
    modules: garage.modules ?? {},
    achievements: garage.achievements ?? {},
    credits: garage.credits,
    stats,
    hullId,
    won,
    rec,
  });
  const achievements = { ...(garage.achievements ?? {}) };
  const at = Date.now();
  for (const id of newMarks) achievements[id] = at;
  return { stats, achievements, newMarks };
}

export function applyLoss(
  garage: Garage,
  hullId: string,
  score?: number,
  rec?: BattleRecord,
  playSeconds = 0,
): LossPayout {
  const creditsGained = score == null ? CREDIT_LAW.lossCredits : silverFromScore(score, false);
  const xpGain = score == null ? XP_LAW.lossXp : xpFromScore(score, false);
  const next: Garage = {
    ...garage,
    xp: garage.xp + xpGain,
    credits: garage.credits + creditsGained,
    researched: { ...garage.researched },
    needsRepair: { ...garage.needsRepair, [hullId]: true },
    squad: [...(garage.squad ?? [])],
    modules: { ...(garage.modules ?? {}) },
  };
  const career = stampCareer(next, hullId, false, score ?? 0, rec, xpGain, creditsGained, playSeconds);
  next.stats = career.stats;
  next.achievements = career.achievements;
  return {
    garage: next,
    creditsGained,
    repairDue: REPAIR_LAW.lossCost,
    hullId,
    newMarks: career.newMarks,
  };
}

export function applyWin(
  garage: Garage,
  hullId: string,
  score?: number,
  rec?: BattleRecord,
  playSeconds = 0,
  /** Research stops at this tier (guests). XP still banks. */
  maxTier?: number,
): WinPayout {
  const gained = score == null ? XP_LAW.winXp : xpFromScore(score, true);
  const creditsGained = score == null ? CREDIT_LAW.winCredits : silverFromScore(score, true);
  const next: Garage = {
    xp: garage.xp + gained,
    credits: garage.credits + creditsGained,
    researched: { ...garage.researched },
    needsRepair: { ...garage.needsRepair },
    round: garage.round,
    mapId: garage.mapId,
    match: garage.match ?? "1v1",
    squad: [...(garage.squad ?? [])],
    repairKits: garage.repairKits ?? 0,
    aerials: garage.aerials ?? 0,
    stats: garage.stats ?? emptyCareer(),
    achievements: { ...(garage.achievements ?? {}) },
    modules: { ...(garage.modules ?? {}) },
  };
  let researchedHullId: string | null = null;
  const node = nodeByHull(hullId);
  if (node?.hullId && node.class !== "artillery" && tryBuy(next, node.hullId, node.tier, maxTier)) {
    researchedHullId = node.hullId;
  }
  const nxt = nextOnLine(hullId);
  if (nxt?.hullId && isResearched(next, hullId) && tryBuy(next, nxt.hullId, nxt.tier, maxTier)) {
    researchedHullId = nxt.hullId;
  }
  const career = stampCareer(next, hullId, true, score ?? 0, rec, gained, creditsGained, playSeconds);
  next.stats = career.stats;
  next.achievements = career.achievements;
  return {
    garage: next,
    gained,
    creditsGained,
    researchedHullId,
    newMarks: career.newMarks,
  };
}

export function researchModule(garage: Garage, hullId: string, slot: ModuleSlot): Garage {
  if (!canPlay(garage, hullId)) return garage;
  if (hasModule(garage.modules, hullId, slot)) return garage;
  const cost = moduleCost(hullId);
  if (garage.xp < cost) return garage;
  const slots = [...hullModules(garage.modules, hullId), slot];
  const modules = { ...(garage.modules ?? {}), [hullId]: slots };
  const next: Garage = { ...garage, xp: garage.xp - cost, modules };
  const newMarks = evaluateAchievements({
    researched: next.researched,
    modules: next.modules,
    achievements: next.achievements ?? {},
    credits: next.credits,
    stats: next.stats ?? emptyCareer(),
    hullId,
    won: false,
  });
  const achievements = { ...(next.achievements ?? {}) };
  const at = Date.now();
  for (const id of newMarks) achievements[id] = at;
  return { ...next, achievements };
}

export function parseGarage(input: unknown): Garage {
  const empty = emptyGarage();
  if (!input || typeof input !== "object") return empty;
  const parsed = input as Partial<Garage>;
  if (typeof parsed.xp !== "number" || typeof parsed.researched !== "object" || !parsed.researched) {
    return empty;
  }
  const storedMap = parsed.mapId;
  const mapId =
    MAP_IDS.includes(storedMap as MapId) || isCustomMapId(storedMap)
      ? (storedMap as string)
      : MAP_LAW.defaultMap;
  const researched: Record<string, boolean> = {};
  for (const [id, on] of Object.entries(parsed.researched)) {
    if (on === true) researched[id] = true;
  }
  const needsRepair: Record<string, boolean> = {};
  if (parsed.needsRepair && typeof parsed.needsRepair === "object") {
    for (const [id, on] of Object.entries(parsed.needsRepair)) {
      if (on === true) needsRepair[id] = true;
    }
  }
  return {
    xp: Math.max(0, parsed.xp),
    credits: typeof parsed.credits === "number" ? Math.max(0, parsed.credits) : 0,
    researched,
    needsRepair,
    round: parsed.round === "apcr" || parsed.round === "he" ? parsed.round : "ap",
    mapId,
    match:
      parsed.match === "2v2" || parsed.match === "3v3" || parsed.match === "4v4"
        ? parsed.match
        : "1v1",
    squad: Array.isArray(parsed.squad)
      ? parsed.squad.filter((id): id is string => typeof id === "string").slice(0, 3)
      : [],
    repairKits: clampCarry(parsed.repairKits, CONSUMABLE_LAW.repairKit.maxCarry),
    aerials: clampCarry(parsed.aerials, CONSUMABLE_LAW.aerial.maxCarry),
    stats: parseCareer(parsed.stats),
    achievements: parseAchievements(parsed.achievements),
    modules: parseModules(parsed.modules),
  };
}

export function loadGarage(): Garage {
  if (typeof localStorage === "undefined") return emptyGarage();
  try {
    const raw = localStorage.getItem(XP_LAW.storageKey);
    if (!raw) return emptyGarage();
    return parseGarage(JSON.parse(raw));
  } catch {
    return emptyGarage();
  }
}

function clampCarry(n: unknown, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

export function buyRepairKit(garage: Garage): Garage {
  if (garage.repairKits >= CONSUMABLE_LAW.repairKit.maxCarry) return garage;
  if (garage.credits < CONSUMABLE_LAW.repairKit.cost) return garage;
  return {
    ...garage,
    credits: garage.credits - CONSUMABLE_LAW.repairKit.cost,
    repairKits: garage.repairKits + 1,
  };
}

export function buyAerial(garage: Garage): Garage {
  if (garage.aerials >= CONSUMABLE_LAW.aerial.maxCarry) return garage;
  if (garage.credits < CONSUMABLE_LAW.aerial.cost) return garage;
  return {
    ...garage,
    credits: garage.credits - CONSUMABLE_LAW.aerial.cost,
    aerials: garage.aerials + 1,
  };
}

export function saveGarage(garage: Garage): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(XP_LAW.storageKey, JSON.stringify(garage));
}
