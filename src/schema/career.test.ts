import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyBattleRecord } from "../game/battle-report.ts";
import { emptyCareer, recordCareer } from "./career.ts";
import { applyFit, moduleCost, parseModules } from "./modules.ts";
import { evaluateAchievements } from "./achievements.ts";
import { applyWin, emptyGarage, researchModule } from "./xp.ts";
import { M2A4 } from "./catalog.ts";

describe("career + modules", () => {
  it("records a win onto career and hull ledgers", () => {
    const rec = emptyBattleRecord();
    rec.kills = 1;
    rec.damageDealt = 400;
    rec.shots = 5;
    rec.hits = 4;
    rec.penetrations = 3;
    const stats = recordCareer(emptyCareer(), "m2a4", true, 800, rec, 1000, 5000, 90);
    assert.equal(stats.battles, 1);
    assert.equal(stats.wins, 1);
    assert.equal(stats.kills, 1);
    assert.equal(stats.byHull.m2a4.wins, 1);
    assert.equal(stats.playSeconds, 90);
  });

  it("module cost scales with tier and fit buffs yaw", () => {
    assert.equal(moduleCost("m2a4"), 400);
    assert.equal(moduleCost("m5-stuart"), 1200);
    const fitted = applyFit(M2A4, ["tracks"]);
    assert.ok(fitted.hullYawRateDegPerSec > M2A4.hullYawRateDegPerSec);
  });

  it("researchModule spends XP and stamps Fitter", () => {
    let g = applyWin(emptyGarage(), "m2a4").garage;
    g = { ...g, xp: g.xp + 400 };
    g = researchModule(g, "m2a4", "tracks");
    assert.deepEqual(g.modules.m2a4, ["tracks"]);
    assert.ok(g.achievements["module-one"]);
    assert.equal(g.xp, 0);
  });

  it("parseModules drops junk slots", () => {
    assert.deepEqual(parseModules({ m2a4: ["tracks", "laser", "gun"] }), {
      m2a4: ["tracks", "gun"],
    });
  });

  it("first win unlocks Ring held", () => {
    const r = applyWin(emptyGarage(), "m2a4");
    assert.ok(r.newMarks.includes("first-win"));
    const again = evaluateAchievements({
      researched: r.garage.researched,
      modules: r.garage.modules,
      achievements: r.garage.achievements,
      credits: r.garage.credits,
      stats: r.garage.stats,
      hullId: "m2a4",
      won: true,
    });
    assert.deepEqual(again, []);
  });
});
