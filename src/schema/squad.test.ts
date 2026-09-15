import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MATCH_LAW,
  countArtillery,
  formatSize,
  hullTier,
  pickEnemyIds,
  squadReady,
  teamSpawns,
  validateSquad,
} from "./index.ts";

describe("MATCH LAW", () => {
  it("sizes and artillery caps", () => {
    assert.equal(MATCH_LAW.version, 1);
    assert.equal(formatSize("1v1"), 1);
    assert.equal(formatSize("2v2"), 2);
    assert.equal(formatSize("3v3"), 3);
    assert.equal(MATCH_LAW.maxArty["3v3"], 1);
    assert.equal(MATCH_LAW.maxArty["2v2"], 2);
  });

  it("2v2 allows any mix including two SPGs; 3v3 allows only one", () => {
    const play = () => true;
    assert.equal(validateSquad("m2a4", ["m7-priest"], "2v2", play).length, 0);
    assert.equal(validateSquad("m7-priest", ["wespe"], "2v2", play).length, 0);
    const twoArty = validateSquad("m7-priest", ["wespe", "su-76"], "3v3", play);
    assert.ok(twoArty.some((e) => /artillery/.test(e)));
    assert.equal(validateSquad("m2a4", ["t-28", "m7-priest"], "3v3", play).length, 0);
    assert.equal(squadReady("m2a4", [], "1v1", play), true);
    assert.equal(squadReady("m2a4", [], "2v2", play), false);
  });

  it("refuses a teammate more than one tier up", () => {
    const play = () => true;
    const err = validateSquad("m2a4", ["m5-stuart"], "2v2", play);
    assert.ok(err.some((e) => /tier/.test(e)));
    assert.equal(hullTier("m2a4"), 1);
    assert.equal(hullTier("m3-stuart"), 2);
    assert.equal(validateSquad("m2a4", ["m3-stuart"], "2v2", play).length, 0);
    assert.equal(hullTier("m7-priest"), 1);
  });

  it("ignores leftover squad members in 1v1", () => {
    const play = () => true;
    assert.equal(validateSquad("m2a4", ["t-28"], "1v1", play).length, 0);
  });

  it("picks the same number of enemies and mirrors spawn x", () => {
    const ids = pickEnemyIds("t-28", ["m2a4"], "2v2", (id) =>
      id === "t-28" ? "m2a4" : "tiger-i",
    );
    assert.equal(ids.length, 2);
    const south = teamSpawns(14, 2, "south");
    const north = teamSpawns(14, 2, "north");
    assert.equal(south[0].x, 0);
    assert.equal(north[0].x, 0);
    assert.equal(south[1].x, -north[1].x);
    assert.equal(countArtillery(["m7-priest", "t-28"]), 1);
  });

  it("3v3 enemy fill keeps at most one artillery", () => {
    const ids = pickEnemyIds("m2a4", ["t-28", "m3-stuart"], "3v3", () => "m7-priest");
    assert.equal(ids.length, 3);
    assert.ok(countArtillery(ids) <= 1);
  });
});
