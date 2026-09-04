import { HULL_CLASSES, NATIONS, type HullClass, type NationId } from "./enums.ts";
import type { HullBlueprint } from "./hull.ts";
import { ARTILLERY_LAW } from "./artillery.ts";

export const NATION_NAME: Record<NationId, string> = {
  usa: "USA",
  ussr: "USSR",
  germany: "Germany",
};

export const TANK_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type TankTier = (typeof TANK_TIERS)[number];

type LineSpec = { hullId: string | null; class: HullClass };

/**
 * TREE LAW — Expert freeze v15 compiled 2026-09-04.
 *
 * Three nations. T1 playable. T2–T10 XP-gated. Artillery is a free-play
 * casemate side branch (Priest / SU-76 / Wespe). Germany T5 is Jagdpanther.
 */
export const TREE_LAW = {
  version: 15,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  nations: NATIONS,
  hullClasses: HULL_CLASSES,
  lockedClasses: [] as const,
  artillery: {
    hullId: ARTILLERY_LAW.hullId,
    researchCost: null,
    canPlay: true,
  },
  maxUnlockedTier: 1,
  emptyT2: false,
  starter: {
    usa: { hullId: "m2a4", tier: 1, class: "light" as HullClass },
    ussr: { hullId: "t-28", tier: 1, class: "medium" as HullClass },
    germany: { hullId: "tiger-i", tier: 1, class: "heavy" as HullClass },
  },
  t2: {
    usa: { hullId: "m3-stuart", class: "light" as HullClass },
    ussr: { hullId: "t-28e", class: "medium" as HullClass },
    germany: { hullId: "tiger-ii", class: "heavy" as HullClass },
  },
  t3: {
    usa: { hullId: "m5-stuart", class: "light" as HullClass },
    ussr: { hullId: "t-34", class: "medium" as HullClass },
    germany: { hullId: "panther", class: "medium" as HullClass },
  },
  t4: {
    usa: { hullId: "m24-chaffee", class: "light" as HullClass },
    ussr: { hullId: "t-34-85", class: "medium" as HullClass },
    germany: { hullId: "panther-g", class: "medium" as HullClass },
  },
  t5: {
    usa: { hullId: "m4a3-sherman", class: "medium" as HullClass },
    ussr: { hullId: "t-44", class: "medium" as HullClass },
    germany: { hullId: "jagdpanther", class: "heavy" as HullClass },
  },
  t6: {
    usa: { hullId: "m4a3e8", class: "medium" as HullClass },
    ussr: { hullId: "t-44-100", class: "medium" as HullClass },
    germany: { hullId: "panther-f", class: "medium" as HullClass },
  },
  t7: {
    usa: { hullId: "m26-pershing", class: "medium" as HullClass },
    ussr: { hullId: "t-54", class: "medium" as HullClass },
    germany: { hullId: "e-50", class: "medium" as HullClass },
  },
  t8: {
    usa: { hullId: "m46-patton", class: "medium" as HullClass },
    ussr: { hullId: "t-54b", class: "medium" as HullClass },
    germany: { hullId: "e-75", class: "heavy" as HullClass },
  },
  t9: {
    usa: { hullId: "m47-patton", class: "medium" as HullClass },
    ussr: { hullId: "t-62", class: "medium" as HullClass },
    germany: { hullId: "standardpanzer", class: "medium" as HullClass },
  },
  t10: {
    usa: { hullId: "m48-patton", class: "medium" as HullClass },
    ussr: { hullId: "t-64a", class: "medium" as HullClass },
    germany: { hullId: "leopard-1", class: "medium" as HullClass },
  },
  artilleryHulls: ARTILLERY_LAW.hulls,
  deferred: [
    "Premium / collector tanks",
    "Crew / modules as research",
    "Silver purchase of hulls",
    "M3A1 hydraulic + gyro",
    "Porsche turret / Jagdtiger",
    "Super-heavy class",
    "Indirect artillery map-click",
  ],
} as const;

export type TreeNode = {
  hullId: string | null;
  nation: NationId;
  tier: number;
  class: HullClass;
  unlocked: boolean;
};

const TIER_LINE: Record<number, Record<NationId, LineSpec>> = {
  2: TREE_LAW.t2,
  3: TREE_LAW.t3,
  4: TREE_LAW.t4,
  5: TREE_LAW.t5,
  6: TREE_LAW.t6,
  7: TREE_LAW.t7,
  8: TREE_LAW.t8,
  9: TREE_LAW.t9,
  10: TREE_LAW.t10,
};

export function specAt(nation: NationId, tier: number): LineSpec {
  if (tier === 1) {
    const s = TREE_LAW.starter[nation];
    return { hullId: s.hullId, class: s.class };
  }
  return TIER_LINE[tier]?.[nation] ?? { hullId: null, class: "medium" };
}

export const STARTER_TREE: TreeNode[] = NATIONS.flatMap((nation) => {
  const tanks: TreeNode[] = TANK_TIERS.map((tier) => {
    const spec = specAt(nation, tier);
    return {
      hullId: spec.hullId,
      nation,
      tier,
      class: spec.class,
      unlocked: tier === 1,
    };
  });
  const artId = TREE_LAW.artilleryHulls[nation];
  tanks.push({
    hullId: artId,
    nation,
    tier: 0,
    class: "artillery",
    unlocked: true,
  });
  return tanks;
});

export function nodesFor(nation: NationId): TreeNode[] {
  return STARTER_TREE.filter((n) => n.nation === nation);
}

export function tankNodesFor(nation: NationId): TreeNode[] {
  return nodesFor(nation).filter((n) => n.class !== "artillery");
}

export function artilleryNode(nation: NationId): TreeNode | undefined {
  return nodesFor(nation).find((n) => n.class === "artillery");
}

export function nodeByHull(hullId: string): TreeNode | undefined {
  return STARTER_TREE.find((n) => n.hullId === hullId);
}

export function nextOnLine(hullId: string): TreeNode | undefined {
  const n = nodeByHull(hullId);
  if (!n || n.class === "artillery") return undefined;
  return STARTER_TREE.find(
    (x) => x.nation === n.nation && x.tier === n.tier + 1 && x.class !== "artillery",
  );
}

export function assertTreeLaws(hulls: HullBlueprint[]): string[] {
  const errors: string[] = [];
  const byId = new Map(hulls.map((h) => [h.id, h]));
  for (const nation of NATIONS) {
    const tanks = tankNodesFor(nation);
    if (tanks.length !== 10) errors.push(`${nation}: T1–T10 slot`);
    for (const tier of TANK_TIERS) {
      const node = tanks.find((n) => n.tier === tier);
      const want = specAt(nation, tier);
      if (!node) {
        errors.push(`${nation}: missing T${tier}`);
        continue;
      }
      if (tier === 1) {
        if (!node.hullId || !node.unlocked) errors.push(`${nation}: T1 must be a live hull`);
      } else if (node.unlocked) {
        errors.push(`${nation}: T${tier} starts locked`);
      }
      if (node.hullId !== want.hullId) {
        errors.push(`${nation}: T${tier} hull ${node.hullId} ≠ ${want.hullId}`);
      }
      if (want.hullId) {
        const hull = byId.get(want.hullId);
        if (!hull) errors.push(`${nation}: missing T${tier} hull ${want.hullId}`);
        else {
          if (hull.nation !== nation) errors.push(`${want.hullId}: nation mismatch`);
          if (hull.class !== node.class) errors.push(`${want.hullId}: class mismatch`);
        }
      }
    }
    const art = artilleryNode(nation);
    const artId = TREE_LAW.artilleryHulls[nation];
    if (!art?.hullId || art.hullId !== artId) errors.push(`${nation}: artillery hull ${artId}`);
    if (!art?.unlocked) errors.push(`${nation}: artillery is free-play this freeze`);
    if (art && art.class !== "artillery") errors.push(`${nation}: artillery class`);
    const artHull = artId ? byId.get(artId) : undefined;
    if (!artHull) errors.push(`${nation}: missing artillery hull ${artId}`);
    else if (artHull.class !== "artillery") errors.push(`${artId}: class mismatch`);
  }
  if (STARTER_TREE.some((n) => n.class !== "artillery" && n.tier > TREE_LAW.maxUnlockedTier && n.unlocked)) {
    errors.push("no free-play tank above T1");
  }
  if (TREE_LAW.artillery.hullId !== "m7-priest") errors.push("canonical artillery is Priest");
  if (TREE_LAW.artillery.researchCost != null) errors.push("artillery has no cost");
  if (!TREE_LAW.artillery.canPlay) errors.push("artillery can play");
  return errors;
}
