import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  M2A4,
  M3_STUART,
  M5_STUART,
  M24_CHAFFEE,
  M4A3_SHERMAN,
  T28,
  T28E,
  T34,
  T34_85,
  T44,
  TIGER_I,
  TIGER_II,
  PANTHER,
  PANTHER_G,
  PEN_LAW,
  instantiateHull,
  resolveHit,
  formatHit,
} from "./index.ts";

function shot(bp: { weapons: { kind: string; penMm: number; damageHp: number; caliberMm: number }[] }) {
  const g = bp.weapons.find((w) => w.kind === "main_gun")!;
  return { penMm: g.penMm, damageHp: g.damageHp, caliberMm: g.caliberMm };
}

describe("PEN LAW freeze", () => {
  it("is catalog v2 assumed 100 m AP", () => {
    assert.equal(PEN_LAW.version, 2);
    assert.equal(PEN_LAW.rangeM, 100);
    assert.equal(PEN_LAW.autoBounceDeg, 70);
    assert.equal(PEN_LAW.evidence, "assumed");
  });

  it("M2A4 37 mm pens T-28 hull front, bounces Tiger front", () => {
    const t28 = instantiateHull(T28, { id: "t", x: 0, y: 0, yawDeg: 180 });
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const s = shot(M2A4);
    const pen = resolveHit(t28, T28.armor, T28.lengthM, 0, -2.2, 0, 1, s);
    assert.equal(pen.kind, "pen");
    assert.equal(pen.facet, "hull_front");
    assert.ok(pen.damage > 0);
    const bounce = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, s);
    assert.equal(bounce.kind, "bounce");
    assert.equal(bounce.damage, 0);
  });

  it("Tiger 88 overmatches M2A4 25 mm", () => {
    const m2 = instantiateHull(M2A4, { id: "m", x: 0, y: 0, yawDeg: 180 });
    const s = shot(TIGER_I);
    const r = resolveHit(m2, M2A4.armor, M2A4.lengthM, 0, -1.8, 0, 1, s);
    assert.equal(r.kind, "overmatch");
    assert.ok(r.damage > 0);
    assert.match(formatHit(r), /OVERMATCH/);
  });

  it("KT-28 does not pen Tiger front", () => {
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const s = shot(T28);
    const r = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, s);
    assert.equal(r.kind, "bounce");
  });

  it("T-28E front stops M2A4 and takes M3", () => {
    const e = instantiateHull(T28E, { id: "e", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, shot(M2A4));
    assert.equal(bounce.kind, "bounce");
    const pen = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, shot(M3_STUART));
    assert.equal(pen.kind, "pen");
    const m5 = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, shot(M5_STUART));
    assert.equal(m5.kind, "pen");
  });

  it("M5 glacis is sloped; M2 still bounces Tiger, M5 pens T-28", () => {
    const t28 = instantiateHull(T28, { id: "t", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(t28, T28.armor, T28.lengthM, 0, -2.2, 0, 1, shot(M5_STUART));
    assert.equal(pen.kind, "pen");
    assert.equal(M5_STUART.armor.hullFront.slopeDeg, 48);
  });

  it("M24 75 mm pens T-34 glacis and Tiger I; bounces Panther", () => {
    const t34 = instantiateHull(T34, { id: "n", x: 0, y: 0, yawDeg: 180 });
    const a = resolveHit(t34, T34.armor, T34.lengthM, 0, -2.4, 0, 1, shot(M24_CHAFFEE));
    assert.equal(a.kind, "pen");
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const b = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, shot(M24_CHAFFEE));
    assert.equal(b.kind, "pen");
    const p = instantiateHull(PANTHER, { id: "p", x: 0, y: 0, yawDeg: 180 });
    const c = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(M24_CHAFFEE));
    assert.equal(c.kind, "bounce");
  });

  it("M4A3 glacis stops F-34; 75 mm pens T-34-85 glacis and bounces Panther", () => {
    const s = instantiateHull(M4A3_SHERMAN, { id: "s", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(s, M4A3_SHERMAN.armor, M4A3_SHERMAN.lengthM, 0, -2.6, 0, 1, shot(T34));
    assert.equal(bounce.kind, "bounce");
    const t85 = instantiateHull(T34_85, { id: "e", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(t85, T34_85.armor, T34_85.lengthM, 0, -2.6, 0, 1, shot(M4A3_SHERMAN));
    assert.equal(pen.kind, "pen");
    const p = instantiateHull(PANTHER, { id: "p", x: 0, y: 0, yawDeg: 180 });
    const face = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(M4A3_SHERMAN));
    assert.equal(face.kind, "bounce");
  });

  it("T-34 glacis stops M3; F-34 pens T-28E and bounces Tiger front", () => {
    const t34 = instantiateHull(T34, { id: "n", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(t34, T34.armor, T34.lengthM, 0, -2.4, 0, 1, shot(M3_STUART));
    assert.equal(bounce.kind, "bounce");
    const e = instantiateHull(T28E, { id: "e", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(e, T28E.armor, T28E.lengthM, 0, -2.2, 0, 1, shot(T34));
    assert.equal(pen.kind, "pen");
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const face = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, shot(T34));
    assert.equal(face.kind, "bounce");
  });

  it("T-34-85 pens Tiger I; bounces Panther and Tiger II", () => {
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, shot(T34_85));
    assert.equal(pen.kind, "pen");
    const p = instantiateHull(PANTHER, { id: "p", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(T34_85));
    assert.equal(bounce.kind, "bounce");
    const k = instantiateHull(TIGER_II, { id: "k", x: 0, y: 0, yawDeg: 180 });
    const face = resolveHit(k, TIGER_II.armor, TIGER_II.lengthM, 0, -3, 0, 1, shot(T34_85));
    assert.equal(face.kind, "bounce");
  });

  it("T-44 glacis stops Tiger I and KwK 42; same 85 mm still bounces Panther", () => {
    const t = instantiateHull(T44, { id: "t", x: 0, y: 0, yawDeg: 180 });
    const ti = resolveHit(t, T44.armor, T44.lengthM, 0, -2.8, 0, 1, shot(TIGER_I));
    assert.equal(ti.kind, "bounce");
    const kwk = resolveHit(t, T44.armor, T44.lengthM, 0, -2.8, 0, 1, shot(PANTHER));
    assert.equal(kwk.kind, "bounce");
    const p = instantiateHull(PANTHER, { id: "p", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(T44));
    assert.equal(bounce.kind, "bounce");
  });

  it("Panther glacis stops Tiger I and T-34; KwK 42 pens Tiger I, bounces Tiger II", () => {
    const p = instantiateHull(PANTHER, { id: "p", x: 0, y: 0, yawDeg: 180 });
    const t34 = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(T34));
    assert.equal(t34.kind, "bounce");
    const ti = resolveHit(p, PANTHER.armor, PANTHER.lengthM, 0, -2.6, 0, 1, shot(TIGER_I));
    assert.equal(ti.kind, "bounce");
    const tiger = instantiateHull(TIGER_I, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, shot(PANTHER));
    assert.equal(pen.kind, "pen");
    const k = instantiateHull(TIGER_II, { id: "k", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(k, TIGER_II.armor, TIGER_II.lengthM, 0, -3, 0, 1, shot(PANTHER));
    assert.equal(bounce.kind, "bounce");
  });

  it("Panther G keeps the glacis and KwK 42; sides are 50 mm", () => {
    const g = instantiateHull(PANTHER_G, { id: "g", x: 0, y: 0, yawDeg: 180 });
    const ti = resolveHit(g, PANTHER_G.armor, PANTHER_G.lengthM, 0, -2.6, 0, 1, shot(TIGER_I));
    assert.equal(ti.kind, "bounce");
    const tiger = instantiateHull(TIGER_I, { id: "t", x: 0, y: 0, yawDeg: 180 });
    const pen = resolveHit(tiger, TIGER_I.armor, TIGER_I.lengthM, 0, -3, 0, 1, shot(PANTHER_G));
    assert.equal(pen.kind, "pen");
    assert.equal(PANTHER_G.armor.hullSide.mm, 50);
  });

  it("Tiger I bounces Tiger II front; KwK 43 overmatches M2A4", () => {
    const k = instantiateHull(TIGER_II, { id: "k", x: 0, y: 0, yawDeg: 180 });
    const bounce = resolveHit(k, TIGER_II.armor, TIGER_II.lengthM, 0, -3, 0, 1, shot(TIGER_I));
    assert.equal(bounce.kind, "bounce");
    const m2 = instantiateHull(M2A4, { id: "m", x: 0, y: 0, yawDeg: 180 });
    const om = resolveHit(m2, M2A4.armor, M2A4.lengthM, 0, -1.8, 0, 1, shot(TIGER_II));
    assert.equal(om.kind, "overmatch");
  });

  it("extreme impact auto-bounces unless overmatch", () => {
    const t28 = instantiateHull(T28, { id: "t", x: 0, y: 0, yawDeg: 0 });
    const s = shot(M2A4);
    const r = resolveHit(t28, T28.armor, T28.lengthM, 1.4, 0, 0.05, 1, s);
    assert.equal(r.kind, "bounce");
  });
});
