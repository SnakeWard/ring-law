import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCORE_LAW, plateScore, silverFromScore, xpFromScore } from "./score.ts";
import { mapAllowsFormat } from "./squad.ts";

describe("SCORE LAW", () => {
  it("rewards pens, damage, kills, spots and tracks", () => {
    const n = plateScore(
      { penetrations: 2, damageDealt: 100, kills: 1, spots: 1, tracks: 1 },
      true,
    );
    assert.equal(n, 2 * 15 + 100 + 200 + 80 + 60 + SCORE_LAW.winBonus);
    assert.ok(xpFromScore(n, true) >= SCORE_LAW.minXpWin);
    assert.ok(silverFromScore(n, true) >= SCORE_LAW.minSilverWin);
  });

  it("loss still pays a floor of XP", () => {
    assert.ok(xpFromScore(0, false) >= SCORE_LAW.minXpLoss);
  });
});

describe("map format band", () => {
  it("dirt range is 1v1 only; theaters take 2v2+", () => {
    assert.equal(mapAllowsFormat(36, "1v1"), true);
    assert.equal(mapAllowsFormat(36, "2v2"), false);
    assert.equal(mapAllowsFormat(64, "3v3"), true);
    assert.equal(mapAllowsFormat(64, "4v4"), true);
  });
});
