import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOT_LAW,
  botGoal,
  flankSign,
  nearestBush,
  pickBotStance,
  type BotView,
} from "./bot.ts";

function view(over: Partial<BotView> = {}): BotView {
  return {
    id: "ally-0",
    x: 0,
    y: -20,
    class: "medium",
    hpRatio: 1,
    onFire: false,
    south: true,
    arenaM: 36,
    inCover: false,
    seen: null,
    lastKnown: null,
    arty: null,
    bushes: [],
    ...over,
  };
}

describe("BOT LAW", () => {
  it("maps classes to roles", () => {
    assert.equal(BOT_LAW.roles.light, "scout");
    assert.equal(BOT_LAW.roles.medium, "brawler");
    assert.equal(BOT_LAW.roles.heavy, "assault");
    assert.equal(BOT_LAW.roles.artillery, "battery");
  });

  it("lights scout, then hunt artillery, then fall back when thin", () => {
    assert.equal(pickBotStance(view({ class: "light" })), "scout");
    assert.equal(
      pickBotStance(view({ class: "light", arty: { x: 4, y: 10 } })),
      "hunt_arty",
    );
    assert.equal(pickBotStance(view({ class: "light", hpRatio: 0.2 })), "fallback");
  });

  it("heavies assault a seen plate and cover when hurt", () => {
    assert.equal(pickBotStance(view({ class: "heavy" })), "advance");
    assert.equal(
      pickBotStance(view({ class: "heavy", seen: { x: 0, y: 0 } })),
      "brawl",
    );
    assert.equal(
      pickBotStance(view({ class: "heavy", seen: { x: 0, y: 0 }, hpRatio: 0.35 })),
      "cover",
    );
  });

  it("always yields a goal so bots never idle in place", () => {
    const g = botGoal(view({ class: "medium" }));
    assert.ok(g.y > -20, "south medium pushes north with no contact");
    const scout = botGoal(view({ class: "light", id: "ally-1" }));
    assert.notEqual(scout.x, 0);
  });

  it("cover stance sits in a bush instead of the threat", () => {
    const g = botGoal(
      view({
        class: "medium",
        hpRatio: 0.4,
        seen: { x: 0, y: 8 },
        bushes: [{ x: -6, y: -12 }],
      }),
    );
    assert.equal(g.x, -6);
    assert.equal(g.hold, true);
  });

  it("nearestBush skips bushes on top of the threat", () => {
    assert.equal(
      nearestBush(view({ bushes: [{ x: 0, y: 8 }] }), 0, 8),
      null,
    );
  });

  it("flank signs differ by id", () => {
    assert.notEqual(flankSign("ally-0"), flankSign("ally-1"));
  });
});
