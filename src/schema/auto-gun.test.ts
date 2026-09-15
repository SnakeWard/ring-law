import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_GUN_LAW,
  autoGunTurrets,
  autoGunWeapon,
  hullById,
  instantiateHull,
  leadPoint,
  tryMgTrack,
} from "./index.ts";

describe("AUTO GUN LAW", () => {
  it("T-28 has two independent MG rings", () => {
    assert.equal(AUTO_GUN_LAW.version, 1);
    assert.equal(AUTO_GUN_LAW.damageHp, 0);
    const t28 = instantiateHull(hullById("t-28")!, { id: "p", x: 0, y: 0, yawDeg: 0 });
    const auto = autoGunTurrets(t28);
    assert.equal(auto.length, 2);
    assert.ok(auto.every((t) => t.role !== "main"));
    assert.ok(auto.every((t) => autoGunWeapon(t28, t)));
  });

  it("leads a crossing target and can pin a track", () => {
    const lead = leadPoint(0, 0, 0, 40, 10, 0, 80);
    assert.ok(lead.x > 0);
    assert.equal(lead.y, 40);
    const host = { tracked: false };
    let pinned = 0;
    for (let i = 0; i < 400; i++) {
      const h = { tracked: false };
      if (tryMgTrack(h, () => i / 400)) pinned++;
      if (tryMgTrack(host, () => 0)) {
        /* already tracked */
      }
    }
    assert.ok(pinned > 20 && pinned < 60, `track hits ${pinned}`);
    assert.equal(host.tracked, true);
  });
});
