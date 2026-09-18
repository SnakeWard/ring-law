import { TREE_LAW, nextOnLine, nodeByHull } from "./tree.ts";
import { CREDIT_LAW } from "./credits.ts";
import { REPAIR_LAW } from "./repair.ts";
import type { RoundKind } from "./apcr.ts";
import { MAP_IDS, MAP_LAW, isCustomMapId, type MapId } from "./maps.ts";
import { CONSUMABLE_LAW } from "./consumable.ts";
import type { MatchFormat } from "./squad.ts";

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
  };
}

export type WinPayout = {
  garage: Garage;
  gained: number;
  creditsGained: number;
  researchedHullId: string | null;
};

export type LossPayout = {
  garage: Garage;
  creditsGained: number;
  repairDue: number;
  hullId: string;
};

export function isResearched(garage: Garage, hullId: string): boolean {
  return garage.researched[hullId] === true;
}

export function researchCost(tier: number): number | null {
  if (tier >= 1 && tier <= 10) return 1000;
  return null;
}

function tryBuy(garage: Garage, hullId: string, tier: number): boolean {
  if (garage.researched[hullId]) return false;
  const cost = researchCost(tier);
  if (cost == null || garage.xp < cost) return false;
  garage.xp -= cost;
  garage.researched[hullId] = true;
  return true;
}

export function canPlay(garage: Garage, hullId: string): boolean {
  if ((TREE_LAW.lockedClasses as readonly string[]).includes(hullId)) return false;
  const node = nodeByHull(hullId);
  if (!node?.hullId) return false;
  if (node.class === "artillery") return node.unlocked;
  if (node.tier === 1) return true;
  return isResearched(garage, hullId);
}

export function hullNeedsRepair(garage: Garage, hullId: string): boolean {
  return garage.needsRepair[hullId] === true;
}

export function canDeploy(garage: Garage, hullId: string): boolean {
  if (!canPlay(garage, hullId)) return false;
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

export function applyLoss(garage: Garage, hullId: string): LossPayout {
  return {
    garage: {
      ...garage,
      researched: { ...garage.researched },
      needsRepair: { ...garage.needsRepair, [hullId]: true },
      squad: [...(garage.squad ?? [])],
    },
    creditsGained: CREDIT_LAW.lossCredits,
    repairDue: REPAIR_LAW.lossCost,
    hullId,
  };
}

export function applyWin(garage: Garage, hullId: string): WinPayout {
  const next: Garage = {
    xp: garage.xp + XP_LAW.winXp,
    credits: garage.credits + CREDIT_LAW.winCredits,
    researched: { ...garage.researched },
    needsRepair: { ...garage.needsRepair },
    round: garage.round,
    mapId: garage.mapId,
    match: garage.match ?? "1v1",
    squad: [...(garage.squad ?? [])],
    repairKits: garage.repairKits ?? 0,
    aerials: garage.aerials ?? 0,
  };
  let researchedHullId: string | null = null;
  const node = nodeByHull(hullId);
  if (node?.hullId && node.class !== "artillery" && tryBuy(next, node.hullId, node.tier)) {
    researchedHullId = node.hullId;
  }
  const nxt = nextOnLine(hullId);
  if (nxt?.hullId && isResearched(next, hullId) && tryBuy(next, nxt.hullId, nxt.tier)) {
    researchedHullId = nxt.hullId;
  }
  return {
    garage: next,
    gained: XP_LAW.winXp,
    creditsGained: CREDIT_LAW.winCredits,
    researchedHullId,
  };
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
    match: parsed.match === "2v2" || parsed.match === "3v3" ? parsed.match : "1v1",
    squad: Array.isArray(parsed.squad)
      ? parsed.squad.filter((id): id is string => typeof id === "string").slice(0, 2)
      : [],
    repairKits: clampCarry(parsed.repairKits, CONSUMABLE_LAW.repairKit.maxCarry),
    aerials: clampCarry(parsed.aerials, CONSUMABLE_LAW.aerial.maxCarry),
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
