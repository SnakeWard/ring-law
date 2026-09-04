import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APCR_LAW,
  M2A4,
  T28E,
  TIGER_I,
  TIGER_II,
  applyWin,
  emptyGarage,
  instantiateHull,
  isResearched,
  resolveHit,
  roundShot,
  spendApcr,
} from "./index.ts";

function ap(bp: { weapons: { kind: string; penMm: number; damageHp: number; caliberMm: number }[] }) {
  const g = bp.weapons.find((w) => w.kind === "main_gun")!;
  return { penMm: g.penMm, damageHp: g.damageHp, caliberMm: g.caliberMm };
}

describe("APCR LAW freeze", () => {
  it("is silver, not XP, assumed 1.35 pen", () => {
    assert.equal(APCR_LAW.version, 1);
    assert.equal(APCR_LAW.shotCost, 250);
    assert.equal(APCR_LAW.researchCost, null);
    assert.equal(APCR_LAW.penMul, 1.35);
    assert.equal(APCR_LAW.dummyRound, "ap");
  });

  it("M2 APCR pens T-28E front; AP still bounces", () => {
    const e = instantiateHull(T28E, { id: "e", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, roundShot(ap(M2A4), "ap"));
    assert.equal(bounce.kind, "bounce");
    const pen = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, roundShot(ap(M2A4), "apcr"));
    assert.equal(pen.kind, "pen");
  });

  it("Tiger I APCR pens Tiger II front", () => {
    const k = instantiateHull(TIGER_II, { id: "k", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(k, TIGER_II.armor, TIGER_II.lengthM, 0, -3, 0, 1, roundShot(ap(TIGER_I), "ap"));
    assert.equal(bounce.kind, "bounce");
    const pen = resolveHit(k, TIGER_II.armor, TIGER_II.lengthM, 0, -3, 0, 1, roundShot(ap(TIGER_I), "apcr"));
    assert.equal(pen.kind, "pen");
  });

  it("spend is credits; XP research is untouched; broke falls back", () => {
    const g = applyWin(emptyGarage(), "m2a4").garage;
    assert.equal(isResearched(g, "apcr"), false);
    const paid = spendApcr(g.credits, "apcr");
    assert.equal(paid.round, "apcr");
    assert.equal(paid.credits, 5000 - 250);
    const broke = spendApcr(0, "apcr");
    assert.equal(broke.round, "ap");
    assert.equal(broke.credits, 0);
  });
});
