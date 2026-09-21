import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { INTRO_BRIEF, cueIndexAt, cueWeight } from "./intro-brief.ts";

describe("intro briefing", () => {
  it("has the baked mp3 and a full cue list", () => {
    assert.ok(existsSync("public" + INTRO_BRIEF.src), INTRO_BRIEF.src);
    assert.ok(INTRO_BRIEF.cues.length > 80);
    assert.ok(INTRO_BRIEF.cues.some((c) => c.text.includes("RING LAW")));
    assert.ok(INTRO_BRIEF.cues.some((c) => c.text.includes("Deploy")));
  });

  it("maps playback time across the cue list", () => {
    const cues = INTRO_BRIEF.cues;
    assert.equal(cueIndexAt(0, 100, cues), 0);
    const last = cueIndexAt(100, 100, cues);
    assert.equal(last, cues.length - 1);
    const mid = cueIndexAt(50, 100, cues);
    assert.ok(mid > 10 && mid < cues.length - 10, "mid " + mid);
    assert.ok(cueWeight(cues[0]) >= 3);
  });
});
