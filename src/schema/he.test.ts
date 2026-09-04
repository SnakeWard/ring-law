import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HE_LAW,
  M2A4,
  T28,
  TIGER_I,
  applyWin,
  emptyGarage,
  heChip,
  instantiateHull,
  isResearched,
  resolveHe,
  resolveHit,
  spendRound,
} from "./index.ts";

function ap(bp: { weapons: { kind: string; penMm: number; damageHp: number; caliberMm: number }[] }) {
  const g = bp.weapons.find((w) => w.kind === "main_gun")!;
  return { penMm: g.penMm, damageHp: g.damageHp, caliberMm: g.caliberMm };
}

describe("HE LAW freeze", () => {
  it("is cheap silver, not XP, never pens", () => {
    assert.equal(HE_LAW.version, 1);
    assert.equal(HE_LAW.shotCost, 80);
    assert.ok(HE_LAW.shotCost < 250);
    assert.equal(HE_LAW.researchCost, null);
    assert.equal(HE_LAW.chipMul, 0.2);
  });

  it("chips bounce HP and never pens or overmatches Tiger front", () => {
    const tiger = instantiateHull(TIGER_I, { id: "t", x: 0, y: 0, yawDeg: 180 });
    const t28 = instantiateHull(T28, { id: "m", x: 0, y: 0, yawDeg: 180 });
    const m2 = ap(M2A4);
    const he = resolveHe(t28, T28.armor, T28.lengthM, 0, -2.2, m2.damageHp);
    assert.equal(he.kind, "bounce");
    assert.equal(he.damage, heChip(m2.damageHp));
    assert.ok(he.damage > 0);
    const apPen = resolveHit(t28, T28.armor, T28.lengthM, 0, -2.2, 0, 1, m2);
    assert.equal(apPen.kind, "pen");
    const tigerHe = resolveHe(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, m2.damageHp);
    assert.equal(tigerHe.kind, "bounce");
    assert.ok(tigerHe.damage < m2.damageHp);
  });

  it("spend is credits; XP research is untouched; broke falls back", () => {
    const g = applyWin(emptyGarage(), "m2a4").garage;
    assert.equal(isResearched(g, "he"), false);
    const paid = spendRound(g.credits, "he");
    assert.equal(paid.round, "he");
    assert.equal(paid.credits, 5000 - 80);
    const broke = spendRound(0, "he");
    assert.equal(broke.round, "ap");
  });
});
