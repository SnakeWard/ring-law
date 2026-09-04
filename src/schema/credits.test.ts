import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CREDIT_LAW,
  applyWin,
  canPlay,
  emptyGarage,
  isResearched,
} from "./index.ts";

describe("CREDIT LAW freeze", () => {
  it("is silver from a win; T2 is not a silver cost", () => {
    assert.equal(CREDIT_LAW.version, 1);
    assert.equal(CREDIT_LAW.winCredits, 5000);
    assert.equal(CREDIT_LAW.lossCredits, 0);
    assert.equal(CREDIT_LAW.t2Cost, null);
  });

  it("win banks credits and still spends XP for T2", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    assert.equal(a.creditsGained, 5000);
    assert.equal(a.garage.credits, 5000);
    assert.equal(a.garage.xp, 0);
    assert.equal(isResearched(a.garage, "m3-stuart"), false);
    const b = applyWin(a.garage, "m2a4");
    assert.equal(b.garage.credits, 10000);
    assert.equal(b.garage.xp, 0);
    assert.equal(isResearched(b.garage, "m3-stuart"), true);
  });

  it("silver alone cannot play T2", () => {
    const rich = { xp: 0, credits: 99_000, researched: {}, needsRepair: {}, round: "ap" as const, mapId: "range" as const };
    assert.equal(canPlay(rich, "m3-stuart"), false);
    assert.equal(canPlay(rich, "t-28e"), false);
    assert.equal(canPlay(rich, "tiger-ii"), false);
  });
});
