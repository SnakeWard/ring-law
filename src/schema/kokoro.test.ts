import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BRIEFS, KOKORO_LAW, unbakedBriefs } from "./audio.ts";
import { KOKORO_BAKED } from "./kokoro-baked.ts";

describe("KOKORO LAW v1", () => {
  it("voices unbaked briefs in a British male Kokoro voice, at bake time only", () => {
    assert.match(KOKORO_LAW.voice, /^bm_/);
    assert.equal(KOKORO_LAW.modelId, "onnx-community/Kokoro-82M-v1.0-ONNX");
    assert.equal(KOKORO_LAW.dtype, "q8");
    assert.equal(KOKORO_LAW.live, false);
  });

  it("keeps the model out of the app: kokoro-js is a devDependency nothing in src imports", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.equal(pkg.dependencies?.["kokoro-js"], undefined);
    assert.ok(pkg.devDependencies?.["kokoro-js"]);
    // git grep exits 1 when nothing matches, which is the passing case.
    const grep = spawnSync(
      "git",
      ["grep", "--untracked", "-lE", "(from|import\\()\\s*[\"']kokoro-js", "--", "src"],
      {
        encoding: "utf8",
      },
    );
    assert.equal(grep.stdout.trim(), "", "src must not import kokoro-js");
  });

  it("every artillery card now has a clip", () => {
    for (const id of ["m12-gmc", "m43-hmc", "su-122", "isu-152", "hummel", "sturmtiger"]) {
      assert.ok(KOKORO_BAKED.includes(id), id);
    }
    assert.deepEqual(unbakedBriefs(), []);
  });

  it("every Kokoro-baked id has its clip on disk and plays it", () => {
    for (const id of KOKORO_BAKED) {
      assert.ok(existsSync(`public/audio/briefs/${id}.mp3`), id);
      assert.equal(BRIEFS.find((b) => b.hullId === id)?.src, `/audio/briefs/${id}.mp3`);
    }
  });

  it("anything without a clip has a real script for the browser voice", () => {
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
    assert.equal(
      spokenBrief("Sd.Kfz. 165 Hummel. 15 cm sFH 18/1"),
      "Sonderkraftfahrzeug 165 Hummel. 15 centimetre s F H 18 stroke 1",
    );
    assert.equal(
      spokenBrief("Sturmtiger (38 cm RW 61). Next"),
      "Sturmtiger, 38 centimetre R W 61. Next",
    );
    assert.equal(spokenBrief("ISU-152 and SU-122"), "I S U 152 and S U 122");
  });
});
