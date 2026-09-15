import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSUMABLE_LAW,
  buyAerial,
  buyRepairKit,
  emptyGarage,
} from "./index.ts";

describe("CONSUMABLE LAW", () => {
  it("buys kits and recon from silver and respects carry caps", () => {
    assert.equal(CONSUMABLE_LAW.version, 1);
    let g = { ...emptyGarage(), credits: 10000 };
    g = buyRepairKit(g);
    g = buyRepairKit(g);
    g = buyAerial(g);
    assert.equal(g.repairKits, 2);
    assert.equal(g.aerials, 1);
    assert.equal(g.credits, 10000 - 700 * 2 - 1600);
    for (let i = 0; i < 5; i++) g = buyRepairKit(g);
    assert.equal(g.repairKits, CONSUMABLE_LAW.repairKit.maxCarry);
    const broke = buyAerial({ ...emptyGarage(), credits: 10 });
    assert.equal(broke.aerials, 0);
    assert.equal(broke.credits, 10);
  });
});
