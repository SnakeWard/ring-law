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

describe("spokenBrief", () => {
  it("rewrites catalog shorthand for the voice", async () => {
    const { spokenBrief } = await import("./audio.ts");
    assert.equal(spokenBrief("155 mm gun. HE rules."), "155 millimetre gun. high-explosive rules.");
    assert.equal(spokenBrief("Sd.Kfz. 165 Hummel. 15 cm sFH 18/1"), "Sonderkraftfahrzeug 165 Hummel. 15 centimetre s F H 18 stroke 1");
    assert.equal(spokenBrief("Sturmtiger (38 cm RW 61). Next"), "Sturmtiger, 38 centimetre R W 61. Next");
    assert.equal(spokenBrief("ISU-152 and SU-122"), "I S U 152 and S U 122");
  });
});
