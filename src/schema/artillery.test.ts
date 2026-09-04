import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTILLERY_LAW,
  CATALOG_HULLS,
  TREE_LAW,
  applyWin,
  assertArtilleryLaws,
  canPlay,
  canResearchArtillery,
  emptyGarage,
} from "./index.ts";

describe("ARTILLERY LAW freeze", () => {
  it("is unlocked, Priest is the hull, cannot research", () => {
    assert.equal(ARTILLERY_LAW.version, 2);
    assert.equal(ARTILLERY_LAW.locked, false);
    assert.equal(ARTILLERY_LAW.hullId, "m7-priest");
    assert.equal(ARTILLERY_LAW.researchCost, null);
    assert.equal(ARTILLERY_LAW.canPlay, true);
    assert.equal(ARTILLERY_LAW.isTurret, false);
    assert.equal(canResearchArtillery(), false);
    assert.deepEqual([...TREE_LAW.lockedClasses], []);
    assert.deepEqual(assertArtilleryLaws(CATALOG_HULLS), []);
  });

  it("Priest is free-play; wins do not buy the tank line", () => {
    assert.equal(canPlay(emptyGarage(), "m7-priest"), true);
    assert.equal(canPlay(emptyGarage(), "su-76"), true);
    assert.equal(canPlay(emptyGarage(), "wespe"), true);
    let g = emptyGarage();
    g = applyWin(g, "m7-priest").garage;
    assert.equal(g.researched["m3-stuart"], undefined);
    assert.equal(canPlay(g, "m3-stuart"), false);
  });
});