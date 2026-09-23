import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { BRIEFS, KOKORO_LAW, unbakedBriefs } from "./audio.ts";
import { KOKORO_BAKED } from "./kokoro-baked.ts";

describe("KOKORO LAW v1", () => {
  it("voices unbaked briefs in a British male Kokoro voice", () => {
    assert.match(KOKORO_LAW.voice, /^bm_/);
    assert.equal(KOKORO_LAW.modelId, "onnx-community/Kokoro-82M-v1.0-ONNX");
    assert.equal(KOKORO_LAW.dtype, "q8");
  });

  it("every Kokoro-baked id has its clip on disk and plays it", () => {
    for (const id of KOKORO_BAKED) {
      assert.ok(existsSync(`public/audio/briefs/${id}.mp3`), id);
      assert.equal(BRIEFS.find((b) => b.hullId === id)?.src, `/audio/briefs/${id}.mp3`);
    }
  });

  it("anything without a clip is left for live Kokoro, with a real script", () => {
    for (const b of unbakedBriefs()) {
      assert.ok(!KOKORO_BAKED.includes(b.hullId), b.hullId);
      assert.ok(b.script.length > 80, b.hullId);
    }
  });
});
