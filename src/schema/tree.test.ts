import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_HULLS,
  HULL_CLASSES,
  STARTER_TREE,
  TREE_LAW,
  assertTreeLaws,
  nodeByHull,
} from "./index.ts";

describe("TREE LAW freeze", () => {
  it("is three nations, T1–T10, artillery live", () => {
    assert.equal(TREE_LAW.version, 15);
    assert.equal(TREE_LAW.t5.usa.hullId, "m4a3-sherman");
    assert.equal(TREE_LAW.t5.ussr.hullId, "t-44");
    assert.equal(TREE_LAW.t5.germany.hullId, "jagdpanther");
    assert.equal(TREE_LAW.t6.usa.hullId, "m4a3e8");
    assert.equal(TREE_LAW.t6.ussr.hullId, "t-44-100");
    assert.equal(TREE_LAW.t10.germany.hullId, "leopard-1");
    assert.equal(TREE_LAW.artillery.hullId, "m7-priest");
    assert.equal(TREE_LAW.artillery.researchCost, null);
    assert.equal(TREE_LAW.artillery.canPlay, true);
    assert.equal(TREE_LAW.t2.usa.hullId, "m3-stuart");
    assert.equal(TREE_LAW.t2.ussr.hullId, "t-28e");
    assert.equal(TREE_LAW.t2.germany.hullId, "tiger-ii");
    assert.deepEqual([...TREE_LAW.nations], ["usa", "ussr", "germany"]);
    assert.deepEqual([...TREE_LAW.hullClasses], [...HULL_CLASSES]);
    assert.deepEqual([...TREE_LAW.lockedClasses], []);
    assert.equal(TREE_LAW.maxUnlockedTier, 1);
    assert.equal(TREE_LAW.starter.usa.hullId, "m2a4");
    assert.equal(TREE_LAW.starter.ussr.hullId, "t-28");
    assert.equal(TREE_LAW.starter.germany.hullId, "tiger-i");
  });

  it("starter catalog sits on the tree", () => {
    assert.equal(STARTER_TREE.length, 33);
    assert.deepEqual(assertTreeLaws(CATALOG_HULLS), []);
    assert.equal(nodeByHull("m2a4")?.nation, "usa");
    assert.equal(nodeByHull("m3-stuart")?.tier, 2);
    assert.equal(nodeByHull("m5-stuart")?.tier, 3);
    assert.equal(nodeByHull("m5-stuart")?.unlocked, false);
    assert.equal(nodeByHull("m5-stuart")?.class, "light");
    assert.equal(nodeByHull("t-34")?.tier, 3);
    assert.equal(nodeByHull("t-34")?.unlocked, false);
    assert.equal(nodeByHull("t-34")?.class, "medium");
    assert.equal(nodeByHull("panther")?.tier, 3);
    assert.equal(nodeByHull("panther")?.unlocked, false);
    assert.equal(nodeByHull("panther")?.class, "medium");
    assert.equal(nodeByHull("m24-chaffee")?.tier, 4);
    assert.equal(nodeByHull("m24-chaffee")?.unlocked, false);
    assert.equal(nodeByHull("m24-chaffee")?.class, "light");
    assert.equal(nodeByHull("t-34-85")?.tier, 4);
    assert.equal(nodeByHull("t-34-85")?.unlocked, false);
    assert.equal(nodeByHull("t-34-85")?.class, "medium");
    assert.equal(nodeByHull("panther-g")?.tier, 4);
    assert.equal(nodeByHull("panther-g")?.unlocked, false);
    assert.equal(nodeByHull("panther-g")?.class, "medium");
    assert.equal(nodeByHull("m4a3-sherman")?.tier, 5);
    assert.equal(nodeByHull("m4a3-sherman")?.unlocked, false);
    assert.equal(nodeByHull("m4a3-sherman")?.class, "medium");
    assert.equal(nodeByHull("t-44")?.tier, 5);
    assert.equal(nodeByHull("t-44")?.unlocked, false);
    assert.equal(nodeByHull("t-44")?.class, "medium");
    assert.equal(nodeByHull("jagdpanther")?.tier, 5);
    assert.equal(nodeByHull("jagdpanther")?.class, "heavy");
    assert.equal(nodeByHull("m4a3e8")?.tier, 6);
    assert.equal(nodeByHull("t-44-100")?.tier, 6);
    assert.equal(nodeByHull("t-64a")?.tier, 10);
    assert.equal(nodeByHull("m7-priest")?.class, "artillery");
    assert.equal(nodeByHull("m7-priest")?.unlocked, true);
    assert.equal(nodeByHull("su-76")?.unlocked, true);
    assert.equal(nodeByHull("wespe")?.unlocked, true);
    assert.equal(nodeByHull("m3-stuart")?.unlocked, false);
    assert.equal(nodeByHull("t-28e")?.tier, 2);
    assert.equal(nodeByHull("tiger-ii")?.tier, 2);
    assert.equal(nodeByHull("tiger-ii")?.unlocked, false);
    assert.equal(nodeByHull("t-28")?.class, "medium");
  });
});