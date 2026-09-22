import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { AUDIO_LAW, BRIEFS, assertBriefsCoverCatalog, briefFor } from "./index.ts";

describe("AUDIO LAW v1", () => {
  it("covers every catalog hull with a unique script", () => {
    assert.equal(AUDIO_LAW.runtimeTtsApi, false);
    assert.equal(AUDIO_LAW.playBakedMp3, true);
    assert.equal(AUDIO_LAW.bake, "once");
    assertBriefsCoverCatalog();
    const ids = new Set(BRIEFS.map((b) => b.hullId));
    assert.equal(ids.size, BRIEFS.length);
    assert.ok((briefFor("m2a4")?.script.length ?? 0) > 80);
    assert.ok((briefFor("m7-priest")?.script.length ?? 0) > 80);
    assert.ok((briefFor("leopard-1")?.script.length ?? 0) > 80);
  });

  it("has a baked clip or an explicit browser-voice script", () => {
    for (const b of BRIEFS) {
      if (b.src) assert.ok(existsSync("public" + b.src), b.src);
      else { assert.equal(AUDIO_LAW.fallbackSpeech, true); assert.ok(b.script.length > 80); }
    }
  });
});
