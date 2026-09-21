import type { BattleRecord } from "../game/battle-report.ts";
import type { CareerStats } from "./career.ts";
import { MODULE_SLOTS } from "./modules.ts";
import { nodeByHull } from "./tree.ts";

export type AchievementDef = {
  id: string;
  name: string;
  blurb: string;
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first-blood", name: "First blood", blurb: "Destroy a plate." },
  { id: "first-win", name: "Ring held", blurb: "Win a range trial." },
  { id: "ten-sorties", name: "Ten sorties", blurb: "Fight 10 battles." },
  { id: "fifty-sorties", name: "Veteran", blurb: "Fight 50 battles." },
  { id: "ace", name: "Ace", blurb: "Three kills in one fight." },
  { id: "butcher", name: "Butcher", blurb: "50 career kills." },
  { id: "steel-pen", name: "Steel pen", blurb: "25 penetrations." },
  { id: "hundred-pen", name: "Aperture", blurb: "100 penetrations." },
  { id: "track-rat", name: "Track rat", blurb: "Break 10 tracks." },
  { id: "spotter", name: "Spotter", blurb: "15 first spots." },
  { id: "ten-k", name: "Ten thousand", blurb: "Bank 10,000 career score." },
  { id: "fifty-k", name: "Ledger", blurb: "Bank 50,000 career score." },
  { id: "line-usa", name: "Stuart line", blurb: "Research M3 Stuart." },
  { id: "line-ussr", name: "Kharkov", blurb: "Research T-34." },
  { id: "line-ger", name: "König", blurb: "Research Tiger II." },
  { id: "module-one", name: "Fitter", blurb: "Research a hull module." },
  { id: "fully-fitted", name: "Field workshop", blurb: "Fit all four modules on one hull." },
  { id: "priest-win", name: "Howitzer mass", blurb: "Win in artillery." },
  { id: "marksman", name: "Marksman", blurb: "70% hits on 8+ shots in one fight." },
  { id: "silver-stack", name: "Paymaster", blurb: "Hold 25,000 silver." },
] as const;

export function parseAchievements(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(input as Record<string, unknown>)) {
    if (typeof at === "number" && at > 0) out[id] = at;
  }
  return out;
}

export function evaluateAchievements(opts: {
  researched: Record<string, boolean>;
  modules: Record<string, string[]>;
  achievements: Record<string, number>;
  credits: number;
  stats: CareerStats;
  hullId: string;
  won: boolean;
  rec?: BattleRecord;
}): string[] {
  const unlocked = new Set(Object.keys(opts.achievements));
  const fresh: string[] = [];
  const rec = opts.rec;
  const stats = opts.stats;
  const node = nodeByHull(opts.hullId);
  const mark = (id: string, ok: boolean) => {
    if (!ok || unlocked.has(id)) return;
    unlocked.add(id);
    fresh.push(id);
  };
  mark("first-blood", stats.kills >= 1);
  mark("first-win", stats.wins >= 1);
  mark("ten-sorties", stats.battles >= 10);
  mark("fifty-sorties", stats.battles >= 50);
  mark("ace", (rec?.kills ?? 0) >= 3);
  mark("butcher", stats.kills >= 50);
  mark("steel-pen", stats.penetrations >= 25);
  mark("hundred-pen", stats.penetrations >= 100);
  mark("track-rat", stats.tracks >= 10);
  mark("spotter", stats.spots >= 15);
  mark("ten-k", stats.score >= 10000);
  mark("fifty-k", stats.score >= 50000);
  mark("line-usa", opts.researched["m3-stuart"] === true);
  mark("line-ussr", opts.researched["t-34"] === true);
  mark("line-ger", opts.researched["tiger-ii"] === true);
  const anyMod = Object.values(opts.modules).some((s) => s.length > 0);
  mark("module-one", anyMod);
  mark(
    "fully-fitted",
    Object.values(opts.modules).some((s) => MODULE_SLOTS.every((slot) => s.includes(slot))),
  );
  mark("priest-win", opts.won && node?.class === "artillery");
  mark("marksman", !!rec && rec.shots >= 8 && rec.hits / rec.shots >= 0.7);
  mark("silver-stack", opts.credits >= 25000);
  return fresh;
}

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
