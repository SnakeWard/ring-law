import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { XP_LAW, applyWin, canPlay, emptyGarage, isResearched } from "./index.ts";

describe("XP LAW freeze", () => {
  it("one win researches T1; T2 costs a second win", () => {
    assert.equal(XP_LAW.version, 6);
    assert.equal(XP_LAW.t10Cost, 1000);
    assert.equal(XP_LAW.t4Cost, 1000);
    assert.equal(XP_LAW.t3Cost, 1000);
    assert.equal(XP_LAW.winXp, 1000);
    assert.equal(XP_LAW.t1Cost, 1000);
    assert.equal(XP_LAW.t2Cost, 1000);
    assert.equal(XP_LAW.lossXp, 0);
  });

  it("first win on M2A4 spends XP and marks researched", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    assert.equal(a.gained, 1000);
    assert.equal(a.researchedHullId, "m2a4");
    assert.equal(a.garage.xp, 0);
    assert.equal(isResearched(a.garage, "m2a4"), true);
    assert.equal(isResearched(a.garage, "m3-stuart"), false);
    assert.equal(canPlay(a.garage, "m2a4"), true);
    assert.equal(canPlay(a.garage, "m3-stuart"), false);
  });

  it("second USA win researches M3; second USSR win researches T-28E", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    const b = applyWin(a.garage, "m2a4");
    assert.equal(b.researchedHullId, "m3-stuart");
    assert.equal(canPlay(b.garage, "m3-stuart"), true);
    const c = applyWin(emptyGarage(), "t-28");
    const d = applyWin(c.garage, "t-28");
    assert.equal(d.researchedHullId, "t-28e");
    assert.equal(canPlay(d.garage, "t-28e"), true);
    assert.equal(d.garage.xp, 0);
    const e = applyWin(emptyGarage(), "tiger-i");
    const f = applyWin(e.garage, "tiger-i");
    assert.equal(f.researchedHullId, "tiger-ii");
    assert.equal(canPlay(f.garage, "tiger-ii"), true);
  });

  it("third USA win on M3 researches M5; third USSR win on T-28E researches T-34", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    const b = applyWin(a.garage, "m2a4");
    assert.equal(canPlay(b.garage, "m5-stuart"), false);
    const c = applyWin(b.garage, "m3-stuart");
    assert.equal(c.researchedHullId, "m5-stuart");
    assert.equal(canPlay(c.garage, "m5-stuart"), true);
    const d = applyWin(emptyGarage(), "t-28");
    const e = applyWin(d.garage, "t-28");
    assert.equal(canPlay(e.garage, "t-34"), false);
    const f = applyWin(e.garage, "t-28e");
    assert.equal(f.researchedHullId, "t-34");
    assert.equal(canPlay(f.garage, "t-34"), true);
    const g = applyWin(emptyGarage(), "tiger-i");
    const h = applyWin(g.garage, "tiger-i");
    assert.equal(canPlay(h.garage, "panther"), false);
    const i = applyWin(h.garage, "tiger-ii");
    assert.equal(i.researchedHullId, "panther");
    assert.equal(canPlay(i.garage, "panther"), true);
  });

  it("fourth USA win on M5 researches M24; fourth USSR win on T-34 researches T-34-85", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    const b = applyWin(a.garage, "m2a4");
    const c = applyWin(b.garage, "m3-stuart");
    assert.equal(canPlay(c.garage, "m24-chaffee"), false);
    const d = applyWin(c.garage, "m5-stuart");
    assert.equal(d.researchedHullId, "m24-chaffee");
    assert.equal(canPlay(d.garage, "m24-chaffee"), true);
    const e = applyWin(emptyGarage(), "t-28");
    const f = applyWin(e.garage, "t-28");
    const g = applyWin(f.garage, "t-28e");
    assert.equal(canPlay(g.garage, "t-34-85"), false);
    const h = applyWin(g.garage, "t-34");
    assert.equal(h.researchedHullId, "t-34-85");
    assert.equal(canPlay(h.garage, "t-34-85"), true);
    const i = applyWin(emptyGarage(), "tiger-i");
    const j = applyWin(i.garage, "tiger-i");
    const k = applyWin(j.garage, "tiger-ii");
    assert.equal(canPlay(k.garage, "panther-g"), false);
    const l = applyWin(k.garage, "panther");
    assert.equal(l.researchedHullId, "panther-g");
    assert.equal(canPlay(l.garage, "panther-g"), true);
  });

  it("fifth USA win on M24 researches M4A3; fifth USSR win on T-34-85 researches T-44", () => {
    const a = applyWin(emptyGarage(), "m2a4");
    const b = applyWin(a.garage, "m2a4");
    const c = applyWin(b.garage, "m3-stuart");
    const d = applyWin(c.garage, "m5-stuart");
    assert.equal(canPlay(d.garage, "m4a3-sherman"), false);
    const e = applyWin(d.garage, "m24-chaffee");
    assert.equal(e.researchedHullId, "m4a3-sherman");
    assert.equal(canPlay(e.garage, "m4a3-sherman"), true);
    const f = applyWin(emptyGarage(), "t-28");
    const g = applyWin(f.garage, "t-28");
    const h = applyWin(g.garage, "t-28e");
    const i = applyWin(h.garage, "t-34");
    assert.equal(canPlay(i.garage, "t-44"), false);
    const j = applyWin(i.garage, "t-34-85");
    assert.equal(j.researchedHullId, "t-44");
    assert.equal(canPlay(j.garage, "t-44"), true);
    const k = applyWin(emptyGarage(), "tiger-i");
    const l = applyWin(k.garage, "tiger-i");
    const m = applyWin(l.garage, "tiger-ii");
    const n = applyWin(m.garage, "panther");
    const o = applyWin(n.garage, "panther-g");
    assert.equal(o.researchedHullId, "jagdpanther");
    assert.equal(canPlay(o.garage, "jagdpanther"), true);
  });
});
