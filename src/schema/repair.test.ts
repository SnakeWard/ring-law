import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REPAIR_LAW,
  applyLoss,
  applyWin,
  canDeploy,
  canPlay,
  emptyGarage,
  tryRepair,
} from "./index.ts";

describe("REPAIR LAW freeze", () => {
  it("is a cheap loss sink; wins are free", () => {
    assert.equal(REPAIR_LAW.version, 1);
    assert.equal(REPAIR_LAW.lossCost, 800);
    assert.equal(REPAIR_LAW.winCost, 0);
    assert.equal(REPAIR_LAW.unpaidBlocksDeploy, true);
    assert.ok(REPAIR_LAW.lossCost < 5000);
  });

  it("loss marks the hull; 800 silver clears it; broke stays blocked", () => {
    const lost = applyLoss(emptyGarage(), "m2a4");
    assert.equal(lost.creditsGained, 0);
    assert.equal(lost.repairDue, 800);
    assert.equal(canPlay(lost.garage, "m2a4"), true);
    assert.equal(canDeploy(lost.garage, "m2a4"), false);
    assert.equal(canDeploy(lost.garage, "t-28"), true);
    const paid = tryRepair(lost.garage, "m2a4");
    assert.equal(paid, lost.garage);
    const funded = applyWin(emptyGarage(), "t-28").garage;
    const billed = applyLoss(funded, "m2a4");
    assert.equal(billed.garage.credits, 5000);
    const fixed = tryRepair(billed.garage, "m2a4");
    assert.equal(fixed.credits, 4200);
    assert.equal(canDeploy(fixed, "m2a4"), true);
  });
});
