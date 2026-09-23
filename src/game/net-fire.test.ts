import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWorld,
  guestPilotInput,
  noteRemoteInput,
  stepWorld,
  type PilotInput,
  type World,
} from "./sim.ts";
import { applyWorldSnap, serializeWorld } from "./net-snap.ts";

const idle = { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 0, hasAim: false };

/** Host world where the dummy is a human guest parked facing the player. */
function hostDuel(enemy = "t-28"): World {
  const w = createWorld("m2a4", 0, "ap", "range", {
    enemyIds: [enemy],
    pilots: { player: "human", dummy: "human" },
  });
  w.player.x = 0;
  w.player.y = 0;
  w.dummy.x = 0;
  w.dummy.y = 20;
  w.dummyReload = 0;
  return w;
}

function guestAim(w: World, extra: Partial<PilotInput> = {}): PilotInput {
  return {
    throttle: 0,
    steer: 0,
    fire: false,
    justFire: false,
    aimX: w.player.x,
    aimY: w.player.y,
    hasAim: true,
    fireSeq: 0,
    ...extra,
  };
}

/** Let the guest's turret swing onto the player. */
function settle(w: World, steps = 240) {
  noteRemoteInput(w, "dummy", guestAim(w));
  for (let i = 0; i < steps; i++) stepWorld(w, idle, 1 / 60);
}

describe("multiplayer guest fire", () => {
  it("a press survives a later non-firing packet", () => {
    const w = hostDuel();
    settle(w);
    noteRemoteInput(w, "dummy", guestAim(w, { justFire: true, fireSeq: 1 }));
    // The next packet arrives before the host steps: justFire is false again.
    noteRemoteInput(w, "dummy", guestAim(w, { justFire: false, fireSeq: 1 }));
    stepWorld(w, idle, 1 / 60);
    assert.equal(w.shotSeq.dummy, 1);
    assert.ok(w.tracers.some((t) => t.fromId === "dummy" && !t.mg), "guest tracer spawned");
  });

  it("a lost press is recovered from any later packet's fireSeq", () => {
    const w = hostDuel();
    settle(w);
    // Packet with justFire:true was dropped; only the follow-up arrives.
    noteRemoteInput(w, "dummy", guestAim(w, { justFire: false, fireSeq: 1 }));
    stepWorld(w, idle, 1 / 60);
    assert.equal(w.shotSeq.dummy, 1);
  });

  it("guest fire respects reload", () => {
    const w = hostDuel();
    settle(w);
    noteRemoteInput(w, "dummy", guestAim(w, { justFire: true, fireSeq: 1 }));
    stepWorld(w, idle, 1 / 60);
    assert.ok((w.humanReload.dummy ?? 0) > 1, "reload started");
    for (let i = 2; i < 12; i++) {
      noteRemoteInput(w, "dummy", guestAim(w, { justFire: true, fireSeq: i }));
      stepWorld(w, idle, 1 / 60);
    }
    assert.equal(w.shotSeq.dummy, 1, "spamming fire does not beat the reload");
  });

  it("guest uses the round it asked for", () => {
    const w = hostDuel();
    settle(w);
    noteRemoteInput(w, "dummy", guestAim(w, { justFire: true, fireSeq: 1, round: "apcr" }));
    stepWorld(w, idle, 1 / 60);
    const tr = w.tracers.find((t) => t.fromId === "dummy" && !t.mg);
    assert.equal(tr?.round, "apcr");
    assert.equal(w.shotRound.dummy, "apcr");
  });

  it("guest artillery can lob", () => {
    const w = hostDuel("m7-priest");
    settle(w);
    noteRemoteInput(
      w,
      "dummy",
      guestAim(w, { justFire: true, fireSeq: 1, arty: "lob", aimX: 0, aimY: -10 }),
    );
    stepWorld(w, idle, 1 / 60);
    assert.equal(w.shotSeq.dummy, 1);
    assert.ok(w.tracers.some((t) => t.fromId === "dummy" && t.lob), "lob shell in flight");
  });
});

describe("guest snapshot", () => {
  it("never copies the host's reload or credits", () => {
    const host = hostDuel();
    host.credits = 99_999;
    host.reload = 3;
    settle(host);
    const guest = createWorld("m2a4", 1_000, "ap", "range", {
      enemyIds: ["t-28"],
      selfId: "dummy",
      pilots: { player: "human", dummy: "human" },
    });
    applyWorldSnap(guest, serializeWorld(host));
    assert.equal(guest.credits, 1_000);
    assert.equal(guest.reload, 0);
  });

  it("charges the guest once per confirmed premium shot", () => {
    const host = hostDuel();
    settle(host);
    const guest = createWorld("m2a4", 1_000, "apcr", "range", {
      enemyIds: ["t-28"],
      selfId: "dummy",
      pilots: { player: "human", dummy: "human" },
    });
    const pkt = guestPilotInput(guest, { ...idle, fire: false, justFire: true, aimX: 0, aimY: 0, hasAim: true }, 1, 1 / 60);
    assert.equal(pkt.round, "apcr");
    noteRemoteInput(host, "dummy", { ...pkt, aimX: host.player.x, aimY: host.player.y });
    stepWorld(host, idle, 1 / 60);
    const snap = serializeWorld(host);
    applyWorldSnap(guest, snap);
    applyWorldSnap(guest, snap);
    assert.ok(guest.credits < 1_000, "apcr was paid for");
    const paid = 1_000 - guest.credits;
    applyWorldSnap(guest, serializeWorld(host));
    assert.equal(1_000 - guest.credits, paid, "repeat snapshots do not charge again");
    assert.ok(guest.reload > 1, "guest sees its own reload");
  });

  it("a broke guest asks for AP", () => {
    const guest = createWorld("m2a4", 0, "apcr", "range", { selfId: "dummy" });
    const pkt = guestPilotInput(guest, { ...idle, fire: false }, 0, 1 / 60);
    assert.equal(pkt.round, "ap");
  });
});
