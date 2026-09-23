import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUEST_LAW, withinTierCap } from "./guest.ts";
import { specAt } from "./tree.ts";
import { applyWin, canDeploy, canPlay, emptyGarage, isResearched, type Garage } from "./xp.ts";

const cap = GUEST_LAW.maxTier;
const t4 = specAt("usa", 4).hullId!;
const t5 = specAt("usa", 5).hullId!;

function researchedThrough(tier: number): Garage {
  const g = emptyGarage();
  for (let t = 1; t <= tier; t++) g.researched[specAt("usa", t).hullId!] = true;
  return g;
}

describe("GUEST LAW v1", () => {
  it("caps guests at tier 4", () => {
    assert.equal(cap, 4);
    assert.ok(withinTierCap(t4, cap));
    assert.ok(!withinTierCap(t5, cap));
    assert.ok(withinTierCap(t5, undefined), "no cap for signed-in players");
    assert.ok(withinTierCap("not-a-hull", cap), "hulls outside the tree are not capped");
  });

  it("a researched T5 stays locked for a guest but not for an account", () => {
    const g = researchedThrough(5);
    assert.ok(canPlay(g, t4, cap));
    assert.ok(!canPlay(g, t5, cap));
    assert.ok(!canDeploy(g, t5, cap));
    assert.ok(canPlay(g, t5));
  });

  it("guest wins bank XP but never research past the cap", () => {
    const g = researchedThrough(4);
    const r = applyWin(g, t4, undefined, undefined, 0, cap);
    assert.equal(isResearched(r.garage, t5), false);
    assert.equal(r.researchedHullId, null);
    assert.ok(r.garage.xp > g.xp, "XP kept for after sign-in");
    const signedIn = applyWin(r.garage, t4);
    assert.equal(isResearched(signedIn.garage, t5), true, "signing in unlocks with the banked XP");
  });

  it("guest research still works below the cap", () => {
    const g = researchedThrough(3);
    const r = applyWin(g, specAt("usa", 3).hullId!, undefined, undefined, 0, cap);
    assert.equal(isResearched(r.garage, t4), true);
  });
});
