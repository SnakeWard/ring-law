import assert from "node:assert/strict";
import { it } from "node:test";
import { newLayoutWorld } from "./quarry-world.ts";
import { QUARRY_COVER, QUARRY_STARTS } from "./quarry.ts";
import { pointInCover } from "../schema/cover.ts";
import { stepWorld, STEP } from "./sim.ts";

it("combat starts remain clear and do not mutate the accepted map", () => {
  const original = JSON.stringify(QUARRY_COVER);
  for (let i = 0; i < QUARRY_STARTS.length; i++) {
    const w = newLayoutWorld(true, i);
    for (const h of [w.player, w.dummy])
      assert.ok(!w.cover.some(c => c.kind === "wreck" && pointInCover(c, h.x, h.y, 1.7)));
    w.cover[0].x = 999;
  }
  assert.equal(JSON.stringify(QUARRY_COVER), original);
});

it("live quarry combat fires, deals damage, ends and resets independently", () => {
  const w = newLayoutWorld(true);
  let outgoing = false, incoming = false;
  for (let i = 0; i < 60 * 120 && !w.complete; i++) {
    stepWorld(w, { throttle: 0, steer: 0, justFire: true, hasAim: false, aimX: 0, aimY: 0 }, STEP);
    outgoing ||= w.playerMuzzleAt >= 0;
    incoming ||= w.dummyMuzzleAt >= 0;
  }
  assert.ok(outgoing && incoming, "both combatants must fire");
  assert.ok(w.complete, "fight must reach a real destruction outcome");
  assert.ok(w.player.hp <= 0 || w.dummy.hp <= 0);
  assert.deepEqual(w.cover, QUARRY_COVER);
  const fresh = newLayoutWorld(true);
  assert.equal(fresh.complete, false);
  assert.equal(fresh.player.hp, fresh.player.hpMax);
  assert.equal(fresh.dummy.hp, fresh.dummy.hpMax);
  assert.equal(fresh.tracers.length, 0);
});
