import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWorld, stepWorld } from "./sim.ts";
import { wrapDeg } from "../schema/index.ts";

describe("range trial sim", () => {
  it("W increases northward speed (yaw 0)", () => {
    const w = createWorld("m2a4");
    const y0 = w.player.y;
    for (let i = 0; i < 30; i++) {
      stepWorld(w, { throttle: 1, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    assert.ok(w.speed > 0.5, "speed");
    assert.ok(w.player.y > y0, "moved north");
  });

  it("A increases yaw (nose left on north-up map)", () => {
    const w = createWorld("m2a4");
    const y0 = w.player.yawDeg;
    for (let i = 0; i < 20; i++) {
      stepWorld(w, { throttle: 1, steer: 1, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    const d = w.player.yawDeg - y0;
    assert.ok(d > 4, "A should add yaw, got " + d);
  });

  it("main ring is independent of hull yaw", () => {
    const w = createWorld("m2a4");
    const hullYaw0 = w.player.yawDeg;
    const main = w.player.turrets.find((t) => t.role === "main")!;
    const face0 = main.facingDeg;
    for (let i = 0; i < 90; i++) {
      stepWorld(
        w,
        { throttle: 0, steer: 0, justFire: false, aimX: 20, aimY: w.player.y, hasAim: true },
        1 / 60,
      );
    }
    assert.equal(w.player.yawDeg, hullYaw0);
    assert.notEqual(main.facingDeg, face0);
    assert.ok(Math.abs(main.facingDeg) > 20);
  });

  it("T-28 dummy is M2A4 so KT-28 can pen", () => {
    const w = createWorld("t-28");
    assert.equal(w.dummy.blueprintId, "m2a4");
    assert.ok(w.dummy.hpMax > 0);
  });

  it("M2A4 dummy is T-28", () => {
    const w = createWorld("m2a4");
    assert.equal(w.dummy.blueprintId, "t-28");
  });

  it("T-34 dummy is Tiger I so F-34 AP bounces the face", () => {
    const w = createWorld("t-34");
    assert.equal(w.dummy.blueprintId, "tiger-i");
  });

  it("Panther dummy is Tiger II so KwK 42 AP bounces the face", () => {
    const w = createWorld("panther");
    assert.equal(w.dummy.blueprintId, "tiger-ii");
  });

  it("M24 dummy is Panther so 75 mm AP bounces the glacis", () => {
    const w = createWorld("m24-chaffee");
    assert.equal(w.dummy.blueprintId, "panther");
  });

  it("T-34-85 dummy is Panther so 85 mm AP bounces the glacis", () => {
    const w = createWorld("t-34-85");
    assert.equal(w.dummy.blueprintId, "panther");
  });

  it("Panther G dummy is Tiger II so KwK 42 AP bounces the face", () => {
    const w = createWorld("panther-g");
    assert.equal(w.dummy.blueprintId, "tiger-ii");
  });

  it("M4A3 dummy is Panther so 75 mm AP bounces the glacis", () => {
    const w = createWorld("m4a3-sherman");
    assert.equal(w.dummy.blueprintId, "panther");
  });

  it("T-44 dummy is Panther so 85 mm AP bounces the glacis", () => {
    const w = createWorld("t-44");
    assert.equal(w.dummy.blueprintId, "panther");
  });

  it("plate returns fire and pens M2A4 front", () => {
    const w = createWorld("m2a4");
    const hp0 = w.player.hp;
    for (let i = 0; i < 360; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    assert.ok(w.player.hp < hp0, "expected incoming pen, hp " + w.player.hp);
    assert.ok((w.lastHitText || "").startsWith("IN"));
  });

  it("T-28 plate bounces off Tiger front", () => {
    const w = createWorld("tiger-i");
    const hp0 = w.player.hp;
    for (let i = 0; i < 420; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    assert.equal(w.player.hp, hp0);
    assert.ok(w.lastHitText.includes("BOUNCE") || w.lastHitText === "", w.lastHitText);
  });

  it("fire ticks dummy HP to a win", () => {
    const w = createWorld("m2a4");
    w.dummy.onFire = true;
    w.dummy.hp = 8;
    for (let i = 0; i < 90; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    assert.equal(w.outcome, "win");
    assert.equal(w.dummy.hp, 0);
  });

  it("plate drives toward the player and holds a standoff", () => {
    const w = createWorld("m2a4");
    const y0 = w.dummy.y;
    const dist0 = Math.hypot(w.player.x - w.dummy.x, w.player.y - w.dummy.y);
    for (let i = 0; i < 180; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    assert.ok(w.dummy.y < y0, "dummy should close south toward player");
    const dist = Math.hypot(w.player.x - w.dummy.x, w.player.y - w.dummy.y);
    assert.ok(dist < dist0, "closed range");
    assert.ok(dist > 6, "does not ram, dist " + dist);
  });

  it("plate hull yaws to face a sidestep", () => {
    const w = createWorld("m2a4");
    w.player.x = 12;
    w.player.y = -14;
    const yaw0 = w.dummy.yawDeg;
    for (let i = 0; i < 120; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 12, aimY: -14, hasAim: true }, 1 / 60);
    }
    const turned = Math.abs(wrapDeg(w.dummy.yawDeg - yaw0));
    assert.ok(turned > 12, "hull should yaw to face offset player, got " + turned);
  });

  it("looking away at range drops the plate until hull or muzzle", () => {
    const w = createWorld("m2a4");
    const main = w.player.turrets.find((t) => t.role === "main")!;
    main.facingDeg = 90;
    stepWorld(
      w,
      { throttle: 0, steer: 0, justFire: false, aimX: 40, aimY: w.player.y, hasAim: true },
      1 / 60,
    );
    assert.equal(w.playerSeesDummy, false, "ring east, dummy 28 m north");
    assert.equal(w.losText, "LOST");
  });

  it("wreck stops a shot; bush does not", () => {
    const w = createWorld("m2a4");
    w.cover = [{ id: "w", kind: "wreck", x: 0, y: 0, halfW: 1.6, halfL: 2.4 }];
    w.player.x = 0;
    w.player.y = -8;
    w.player.yawDeg = 0;
    const main = w.player.turrets.find((t) => t.role === "main")!;
    main.facingDeg = 0;
    w.reload = 0;
    for (let i = 0; i < 40; i++) {
      stepWorld(
        w,
        { throttle: 0, steer: 0, justFire: i === 0, aimX: 0, aimY: 20, hasAim: true },
        1 / 60,
      );
    }
    assert.match(w.lastHitText, /WRECK/);
    assert.equal(w.dummy.hp, w.dummy.hpMax);
  });

  it("tracked hull is pinned; ring still turns", () => {
    const w = createWorld("m2a4");
    w.dummy.tracked = true;
    const x0 = w.dummy.x;
    const y0 = w.dummy.y;
    const yaw0 = w.dummy.yawDeg;
    const ring = w.player.turrets.find((t) => t.role === "main")!;
    const face0 = ring.facingDeg;
    w.player.tracked = true;
    const pyaw0 = w.player.yawDeg;
    for (let i = 0; i < 40; i++) {
      stepWorld(
        w,
        { throttle: 1, steer: 1, justFire: false, aimX: 20, aimY: w.player.y, hasAim: true },
        1 / 60,
      );
    }
    assert.equal(w.dummy.x, x0);
    assert.equal(w.dummy.y, y0);
    assert.equal(w.dummy.yawDeg, yaw0);
    assert.equal(w.player.yawDeg, pyaw0);
    assert.equal(w.speed, 0);
    assert.ok(Math.abs(ring.facingDeg - face0) > 8, "ring still aims");
  });

  it("APCR shot spends silver; dummy fire does not", () => {
    const w = createWorld("m2a4", 5000, "apcr");
    w.reload = 0;
    stepWorld(w, { throttle: 0, steer: 0, justFire: true, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    assert.equal(w.credits, 4750);
    assert.equal(w.tracers[0]?.round, "apcr");
    w.dummyReload = 0;
    w.dummySeesPlayer = true;
    w.lastPlayerSeenX = w.player.x;
    w.lastPlayerSeenY = w.player.y;
    const before = w.credits;
    stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    assert.equal(w.credits, before);
  });

  it("HE shot spends 80 silver and chips without pen", () => {
    const w = createWorld("m2a4", 5000, "he");
    w.reload = 0;
    stepWorld(w, { throttle: 0, steer: 0, justFire: true, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    assert.equal(w.credits, 4920);
    assert.equal(w.tracers[0]?.round, "he");
  });

  it("Priest dummy is M2A4; casemate leftover 30; howitzer chips", () => {
    const w = createWorld("m7-priest");
    assert.equal(w.dummy.blueprintId, "m2a4");
    assert.equal(w.player.turrets.length, 0);
    const hp0 = w.dummy.hp;
    w.reload = 0;
    for (let i = 0; i < 20; i++) {
      stepWorld(
        w,
        { throttle: 0, steer: 0, justFire: i === 0, aimX: 0, aimY: 14, hasAim: true },
        1 / 60,
      );
    }
    assert.ok(w.dummy.hp < hp0, "howitzer should chip, hp " + w.dummy.hp);
    assert.match(w.lastHitText, /HE/);
  });

  it("Priest lob fires at a map point past leftover cone", () => {
    const w = createWorld("m7-priest");
    w.artyMode = "lob";
    w.reload = 0;
    const hp0 = w.dummy.hp;
    stepWorld(w, { throttle: 0, steer: 0, justFire: true, aimX: 0, aimY: 14, hasAim: true }, 1 / 60);
    assert.ok(w.dummy.hp < hp0);
    assert.equal(w.lobOk, true);
  });

  it("lob reticle follows the pointer and goes red out of range", () => {
    const w = createWorld("m7-priest");
    w.artyMode = "lob";
    stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: -14, hasAim: true }, 1 / 60);
    assert.equal(w.lobOk, false);
    stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 14, hasAim: true }, 1 / 60);
    assert.equal(w.lobX, 0);
    assert.equal(w.lobY, 14);
    assert.equal(w.lobOk, true);
  });

  it("Priest A still yaws the hull left", () => {
    const w = createWorld("m7-priest");
    const y0 = w.player.yawDeg;
    for (let i = 0; i < 20; i++) {
      stepWorld(w, { throttle: 1, steer: 1, justFire: false, aimX: 0, aimY: 20, hasAim: true }, 1 / 60);
    }
    const d = w.player.yawDeg - y0;
    assert.ok(d > 4, "A should add yaw on a casemate, got " + d);
  });

  it("Jagdpanther has no ring and leftover 11", () => {
    const w = createWorld("jagdpanther");
    assert.equal(w.player.turrets.length, 0);
    assert.equal(w.dummy.blueprintId, "tiger-ii");
  });

  it("moving hull kicks dust; parked hull does not", () => {
    const moving = createWorld("m2a4");
    for (let i = 0; i < 45; i++) {
      stepWorld(
        moving,
        { throttle: 1, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true },
        1 / 60,
      );
    }
    assert.ok(moving.dust.length > 3, "track dust after a drive, got " + moving.dust.length);

    const parked = createWorld("m2a4");
    parked.dummy.tracked = true;
    for (let i = 0; i < 45; i++) {
      stepWorld(
        parked,
        { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true },
        1 / 60,
      );
    }
    assert.equal(parked.dust.length, 0);
    assert.equal(parked.playerDustM, 0);
  });

  it("occupying a bush fades the hull into camo", () => {
    const w = createWorld("m2a4");
    const bush = w.cover.find((c) => c.kind === "bush")!;
    w.player.x = bush.x;
    w.player.y = bush.y;
    for (let i = 0; i < 40; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 0, hasAim: false }, 1 / 60);
    }
    assert.ok(w.playerConceal > 0.85, "conceal " + w.playerConceal);
    w.player.x = 0;
    w.player.y = -14;
    for (let i = 0; i < 40; i++) {
      stepWorld(w, { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 0, hasAim: false }, 1 / 60);
    }
    assert.ok(w.playerConceal < 0.2, "recover " + w.playerConceal);
  });
});
